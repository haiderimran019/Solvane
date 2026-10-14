import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import {drizzle} from "drizzle-orm/d1";
const root=fileURLToPath(new URL("../",import.meta.url)),require=createRequire(import.meta.url);

function harness(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(path.join(root,"drizzle")).filter(name=>name.endsWith(".sql")).sort())sqlite.exec(readFileSync(path.join(root,"drizzle",name),"utf8"));
  const d1={prepare(sql){return {params:[],bind(...params){this.params=params;return this;},async run(){const result=sqlite.prepare(sql).run(...this.params);return {success:true,results:[],meta:{changes:Number(result.changes)}};},async all(){return {results:sqlite.prepare(sql).all(...this.params)};},async raw(){const statement=sqlite.prepare(sql);statement.setReturnArrays(true);return statement.all(...this.params);}};},async batch(queries){sqlite.exec("BEGIN");try{const results=[];for(const query of queries)results.push(await query.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
  const db=drizzle(d1),env={DB:d1,CHECKPOINT_USER_PER_MINUTE:"2",GEMINI_DAILY_SPEND_USD:"1"};
  const cache=new Map();const providerCalls=[];let statuses=[429,200],user={userId:"alice"};
  function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const compiledModule={exports:{}};cache.set(file,compiledModule);
    const localRequire=(specifier)=>{if(specifier==="cloudflare:workers")return {env};if(specifier.endsWith("lib/server")||specifier.endsWith("lib/server.ts"))return {apiUser:async()=>user,unauthorized:()=>Response.json({error:"Sign in"},{status:401}),resolveProviderCredential:async(_id,provider)=>provider==="perplexity"?null:{apiKey:"fixture-key",model:provider,source:"user"}};if(specifier==="../../../db"||specifier==="../db")return {getDb:()=>db};if(specifier.startsWith("."))return load(path.resolve(path.dirname(file),specifier)+(path.extname(specifier)?"":".ts"));return require(specifier);};
    const fakeFetch=async(url)=>{providerCalls.push(String(url));const status=statuses.shift()??500;return Response.json(status===200?{candidates:[{content:{parts:[{text:"Project X: continue with tests"}]}}]}:{error:"rate limited"},{status});};
    const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:localRequire,fetch:fakeFetch,Response,Request,Headers,URL,crypto,TextEncoder,AbortController,DOMException,setTimeout,clearTimeout,console,structuredClone},{filename:file});return compiledModule.exports;
  }
  sqlite.prepare("INSERT INTO folders(id,user_id,name,provider_order,created_at,updated_at) VALUES('project','alice','Project X','[\"claude\",\"gemini\",\"openai\",\"perplexity\"]',?,?)").run(new Date().toISOString(),new Date().toISOString());
  return {sqlite,db,d1,env,load,providerCalls,setStatuses:value=>{statuses=value;},setUser:value=>{user=value;}};
}

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
