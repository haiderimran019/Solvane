import { env } from "cloudflare:workers";

// A single conditional INSERT makes reservations atomic across concurrent Worker requests.
export const RESERVE_SQL = `INSERT INTO events (id,folder_id,user_id,type,data,created_at)
SELECT ?,?,?,'checkpoint.reserved',?,? WHERE
(SELECT COUNT(*) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=?) < ?
AND (SELECT COUNT(*) FROM events WHERE type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.ipHash')=?) < ?
AND (?=0 OR ((SELECT COUNT(*) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.platform')=1) < ?
AND COALESCE((SELECT SUM(json_extract(data,'$.inputChars')) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.platform')=1),0)+? <= ?
AND COALESCE((SELECT SUM(json_extract(data,'$.costMicroUsd')) FROM events WHERE type='checkpoint.reserved' AND created_at>=?),0)+? <= ?))`;

export async function reserveCheckpoint(userId: string, folderId: string, chars: number, platform: boolean, request: Request) {
  if (!env.DB) throw new Error("Database unavailable. Keep your paste and try again.");
  const runtime = env as unknown as Record<string,string>;
  const number = (name:string,fallback:number) => Number(runtime[name])>0?Number(runtime[name]):fallback;
  const day = new Date(); day.setUTCHours(0,0,0,0);
  const minute = new Date(Date.now()-60000).toISOString();
  const salt = runtime.PROVIDER_CREDENTIAL_MASTER_KEY || "solvane-ip-rate-limit";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${salt}:${day.toISOString()}:${request.headers.get("cf-connecting-ip")||userId}`));
  const ipHash = Array.from(new Uint8Array(digest),(n)=>n.toString(16).padStart(2,"0")).join("");
  // Reserve both possible calls at conservative configured prices; Google billing caps are a second guard.
  const cost = platform?Math.ceil(2*(chars*number("GEMINI_INPUT_USD_PER_MILLION",1)+number("CHECKPOINT_MAX_OUTPUT_TOKENS",2000)*number("GEMINI_OUTPUT_USD_PER_MILLION",5))):0;
  const result=await env.DB.prepare(RESERVE_SQL).bind(crypto.randomUUID(),folderId,userId,JSON.stringify({ipHash,inputChars:chars,costMicroUsd:cost,platform}),new Date().toISOString(),userId,minute,number("CHECKPOINT_USER_PER_MINUTE",10),minute,ipHash,number("CHECKPOINT_IP_PER_MINUTE",30),platform?1:0,userId,day.toISOString(),number("GEMINI_DAILY_LIMIT",20),userId,day.toISOString(),chars,number("GEMINI_DAILY_INPUT_CHARS",400000),day.toISOString(),cost,number("GEMINI_DAILY_SPEND_USD",2)*1000000).run();
  if(!result.meta.changes) throw new Error("Processing limit reached. Wait a minute or paste a SOLVANE_UPDATE block. For daily free limits, try tomorrow or connect your own Gemini key.");
}
