import { env } from "cloudflare:workers";
import type { ProviderId } from "./product";

// A single conditional INSERT makes reservations atomic across concurrent Worker requests.
export const RESERVE_SQL = `INSERT INTO events (id,folder_id,user_id,type,data,created_at)
SELECT ?,?,?,'checkpoint.reserved',?,? WHERE
(SELECT COUNT(*) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=?) < ?
AND (SELECT COUNT(*) FROM events WHERE type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.ipHash')=?) < ?
AND (?=0 OR ((SELECT COUNT(*) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.platform')=1) < ?
AND COALESCE((SELECT SUM(json_extract(data,'$.inputChars')) FROM events WHERE user_id=? AND type='checkpoint.reserved' AND created_at>=? AND json_extract(data,'$.platform')=1),0)+? <= ?
AND COALESCE((SELECT SUM(json_extract(data,'$.costMicroUsd')) FROM events WHERE type='checkpoint.reserved' AND created_at>=?),0)+? <= ?))`;

/**
 * Prices used to reserve platform-key spend before a call. Defaults are deliberately conservative (input is counted
 * in characters, not tokens); override per provider with <PREFIX>_INPUT_USD_PER_MILLION / _OUTPUT_USD_PER_MILLION.
 */
const PRICE_DEFAULTS: Record<ProviderId, { prefix: string; input: number; output: number }> = {
  gemini: { prefix: "GEMINI", input: 1, output: 5 },
  claude: { prefix: "ANTHROPIC", input: 4, output: 20 },
  openai: { prefix: "OPENAI", input: 5, output: 25 },
  perplexity: { prefix: "PERPLEXITY", input: 3, output: 15 },
};

export class PlatformLimitError extends Error {}

export async function reserveCheckpoint(userId: string, folderId: string, chars: number, platform: boolean, request: Request, usage: { provider?: ProviderId; maxOutputTokens?: number; calls?: number } = {}) {
  if (!env.DB) throw new Error("Database unavailable. Keep your paste and try again.");
  const runtime = env as unknown as Record<string,string>;
  const number = (name:string,fallback:number) => Number(runtime[name])>0?Number(runtime[name]):fallback;
  const day = new Date(); day.setUTCHours(0,0,0,0);
  const minute = new Date(Date.now()-60000).toISOString();
  const salt = runtime.PROVIDER_CREDENTIAL_MASTER_KEY || "solvane-ip-rate-limit";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${salt}:${day.toISOString()}:${request.headers.get("cf-connecting-ip")||userId}`));
  const ipHash = Array.from(new Uint8Array(digest),(n)=>n.toString(16).padStart(2,"0")).join("");
  const provider = usage.provider ?? "gemini";
  const price = PRICE_DEFAULTS[provider];
  // A checkpoint reserves both possible Gemini calls (extraction + one repair); provider billing caps are a second guard.
  const calls = usage.calls ?? 2;
  const maxOutput = usage.maxOutputTokens ?? number("CHECKPOINT_MAX_OUTPUT_TOKENS",2000);
  const cost = platform?Math.ceil(calls*(chars*number(`${price.prefix}_INPUT_USD_PER_MILLION`,price.input)+maxOutput*number(`${price.prefix}_OUTPUT_USD_PER_MILLION`,price.output))):0;
  // One daily cap covers every platform-key call, whichever provider serves it.
  const dailySpendUsd = number("PLATFORM_DAILY_SPEND_USD", number("GEMINI_DAILY_SPEND_USD",2));
  const result=await env.DB.prepare(RESERVE_SQL).bind(crypto.randomUUID(),folderId,userId,JSON.stringify({ipHash,inputChars:chars,costMicroUsd:cost,platform,provider}),new Date().toISOString(),userId,minute,number("CHECKPOINT_USER_PER_MINUTE",10),minute,ipHash,number("CHECKPOINT_IP_PER_MINUTE",30),platform?1:0,userId,day.toISOString(),number("GEMINI_DAILY_LIMIT",20),userId,day.toISOString(),chars,number("GEMINI_DAILY_INPUT_CHARS",400000),day.toISOString(),cost,dailySpendUsd*1000000).run();
  if(!result.meta.changes) throw new PlatformLimitError("Processing limit reached. Wait a minute or paste a SOLVANE_UPDATE block. For daily free limits, try tomorrow or connect your own Gemini key.");
}
