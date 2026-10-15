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
