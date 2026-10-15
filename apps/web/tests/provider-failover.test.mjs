import {test} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {harness} from "./route-harness.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));

test("actual API route fails over after 429 with the same approved state, replays safely, and reports all failing",async()=>{
  const h=harness(),route=h.load(path.join(root,"app/api/chat/route.ts"));
  const request=(turnId)=>new Request("http://test/api/chat",{method:"POST",body:JSON.stringify({folderId:"project",content:"Continue Project X",approvedSnapshotVersion:0,turnId})});
  let response=await route.POST(request("t1"));let data=await response.json();assert.equal(response.status,200);assert.equal(data.provider,"gemini");assert.equal(data.failovers[0].from,"claude");assert.equal(data.failovers[0].to,"gemini");assert.equal(h.providerCalls.length,2);
  response=await route.POST(request("t1"));data=await response.json();assert.equal(data.replayed,true);assert.equal(h.providerCalls.length,2);
  assert.equal(h.sqlite.prepare("SELECT COUNT(*) n FROM events WHERE type='provider.failover'").get().n,1);
  h.setStatuses([429,429,429]);response=await route.POST(request("t2"));assert.equal(response.status,424);data=await response.json();assert.match(data.error,/No configured provider/);
  h.setUser({userId:"bob"});response=await route.POST(request("t3"));assert.equal(response.status,404);assert.equal(h.providerCalls.length,5);
});

test("real reservation SQL limits across folders and holds the configured spend cap",async()=>{
  const h=harness(),limits=h.load(path.join(root,"lib/checkpoint-limits.ts"));const request=new Request("http://test",{headers:{"cf-connecting-ip":"192.0.2.1"}});
  await limits.reserveCheckpoint("alice","project",1000,true,request);await limits.reserveCheckpoint("alice","project",1000,true,request);
  await assert.rejects(limits.reserveCheckpoint("alice","project",1000,true,request),/Processing limit reached/);
  h.env.CHECKPOINT_USER_PER_MINUTE="20";h.env.GEMINI_DAILY_SPEND_USD="0.000001";
  await assert.rejects(limits.reserveCheckpoint("alice","project",1000,true,request),/Processing limit reached/);
});

const turn=(turnId)=>new Request("http://test/api/chat",{method:"POST",body:JSON.stringify({folderId:"project",content:"Continue Project X",approvedSnapshotVersion:0,turnId})});

test("a rejected key, a retired model or a refusal hands the turn to the next connected provider",async()=>{
  const h=harness(),route=h.load(path.join(root,"app/api/chat/route.ts"));
  h.setStatuses([401,200]);
  let data=await (await route.POST(turn("rejected-key"))).json();
  assert.equal(data.provider,"gemini");
  assert.equal(data.failovers[0].reason,"provider_rejected");
  h.setStatuses([{status:200,body:{stop_reason:"refusal",content:[]}},200]);
  data=await (await route.POST(turn("refusal"))).json();
  assert.equal(data.provider,"gemini");
  h.setStatuses([404,400,400]);
  const response=await route.POST(turn("all-rejected"));
  assert.equal(response.status,424);
  data=await response.json();
  assert.equal(data.attempts.length,4);
  assert.match(data.error,/Claude doesn't recognize the model\. Gemini rejected the request\. ChatGPT rejected the request\./);
});

test("Claude requests use the current model's effort and server-side refusal fallback, and older models stay plain",async()=>{
  const h=harness(),route=h.load(path.join(root,"app/api/chat/route.ts"));
  let model="claude-opus-5-5";
  h.setCredential((provider)=>provider==="claude"?{apiKey:"fixture-key",model,source:"user"}:null);
  h.setStatuses([{status:200,body:{stop_reason:"end_turn",content:[{type:"text",text:"Continuing."}]}}]);
  assert.equal((await route.POST(turn("opus"))).status,200);
  let sent=h.requests.at(-1);
  assert.equal(sent.body.model,"claude-opus-5-5");
  assert.equal(sent.body.fallbacks,"default");
  assert.deepEqual(sent.body.output_config,{effort:"medium"});
  assert.equal(sent.headers["anthropic-beta"],"server-side-fallback-2026-07-01");
  assert.equal(sent.body.max_tokens,8000);
  model="claude-haiku-4-5";
  h.setStatuses([{status:200,body:{stop_reason:"end_turn",content:[{type:"text",text:"Continuing."}]}}]);
  assert.equal((await route.POST(turn("older"))).status,200);
  sent=h.requests.at(-1);
  assert.equal(sent.body.fallbacks,undefined);
  assert.equal(sent.body.output_config,undefined);
  assert.equal(sent.headers["anthropic-beta"],undefined);
});

test("platform keys on every provider are reserved against the daily caps before calling",async()=>{
  const h=harness(),route=h.load(path.join(root,"app/api/chat/route.ts"));
  h.setCredential((provider)=>provider==="claude"?{apiKey:"platform-key",model:"claude-opus-5-5",source:"platform"}:null);
  h.setStatuses([{status:200,body:{stop_reason:"end_turn",content:[{type:"text",text:"Continuing."}]}}]);
  assert.equal((await route.POST(turn("platform"))).status,200);
  const reserved=h.sqlite.prepare("SELECT data FROM events WHERE type='checkpoint.reserved'").all().map((row)=>JSON.parse(row.data));
  assert.equal(reserved.length,1);
  assert.equal(reserved[0].provider,"claude");
  assert.ok(reserved[0].costMicroUsd>=8000*20,"reserves the full output bound at Claude prices");
  h.env.PLATFORM_DAILY_SPEND_USD="0.000001";
  const calls=h.requests.length;
  const response=await route.POST(turn("over-cap"));
  assert.equal(response.status,424);
  assert.match((await response.json()).error,/rate-limited or out of quota/);
  assert.equal(h.requests.length,calls,"no provider call once the cap is reached");
});

test("Gemini extraction picks its thinking control by model generation",async()=>{
  const h=harness(),route=h.load(path.join(root,"app/api/checkpoint/route.ts"));
  h.setCredential((provider)=>provider==="gemini"?{apiKey:"platform-key",model:"gemini-3.8-flash",source:"platform"}:null);
  const empty={decisions_add:[],done_add:[],open_questions_add:[],open_questions_resolve:[],constraints_add:[],next_step:"",changes:[]};
  const reply={status:200,body:{candidates:[{content:{parts:[{text:JSON.stringify(empty)}]}}]}};
  const preview=(text)=>route.POST(new Request("http://test/api/checkpoint",{method:"POST",body:JSON.stringify({folderId:"project",text,mode:"preview"})}));
  h.setStatuses([reply]);
  assert.equal((await preview("We finished the login tests.")).status,200);
  let sent=h.requests.at(-1);
  assert.match(sent.url,/models\/gemini-3\.5-flash-lite:generateContent/);
  assert.deepEqual(sent.body.generationConfig.thinkingConfig,{thinkingLevel:"LOW"});
  h.env.CHECKPOINT_GEMINI_MODEL="gemini-2.5-flash-lite";
  h.setStatuses([reply]);
  assert.equal((await preview("We finished the signup tests.")).status,200);
  sent=h.requests.at(-1);
  assert.deepEqual(sent.body.generationConfig.thinkingConfig,{thinkingBudget:0});
});
