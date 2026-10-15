// Loads real route modules in a VM against an in-memory SQLite database migrated from drizzle/.
import {readFileSync,readdirSync} from "node:fs";
import {createRequire} from "node:module";
import vm from "node:vm";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {DatabaseSync} from "node:sqlite";
import ts from "typescript";
import {drizzle} from "drizzle-orm/d1";
const root=fileURLToPath(new URL("../",import.meta.url)),require=createRequire(import.meta.url);
export function harness(){
  const sqlite=new DatabaseSync(":memory:");sqlite.exec("PRAGMA foreign_keys=ON");
  for(const name of readdirSync(path.join(root,"drizzle")).filter(name=>name.endsWith(".sql")).sort())sqlite.exec(readFileSync(path.join(root,"drizzle",name),"utf8"));
  const d1={prepare(sql){return {params:[],bind(...params){this.params=params;return this;},async run(){const result=sqlite.prepare(sql).run(...this.params);return {success:true,results:[],meta:{changes:Number(result.changes)}};},async all(){return {results:sqlite.prepare(sql).all(...this.params)};},async raw(){const statement=sqlite.prepare(sql);statement.setReturnArrays(true);return statement.all(...this.params);}};},async batch(queries){sqlite.exec("BEGIN");try{const results=[];for(const query of queries)results.push(await query.run());sqlite.exec("COMMIT");return results;}catch(error){sqlite.exec("ROLLBACK");throw error;}}};
  const db=drizzle(d1),env={DB:d1,CHECKPOINT_USER_PER_MINUTE:"2",GEMINI_DAILY_SPEND_USD:"1"};
  const cache=new Map();const providerCalls=[],requests=[];let statuses=[429,200],user={userId:"alice"};
  // Default credentials: personal (BYOK) keys for every provider except Perplexity. Tests can swap in platform keys.
  let credential=(provider)=>provider==="perplexity"?null:{apiKey:"fixture-key",model:provider,source:"user"};
  function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const compiledModule={exports:{}};cache.set(file,compiledModule);
    const localRequire=(specifier)=>{if(specifier==="cloudflare:workers")return {env};if(specifier.endsWith("lib/server")||specifier.endsWith("lib/server.ts"))return {apiUser:async()=>user,unauthorized:()=>Response.json({error:"Sign in"},{status:401}),resolveProviderCredential:async(_id,provider)=>credential(provider)};if(/^(\.\.\/)+db$/.test(specifier))return {getDb:()=>db};if(specifier.startsWith("."))return load(path.resolve(path.dirname(file),specifier)+(path.extname(specifier)?"":".ts"));return require(specifier);};
    // Each scripted response is a status, or {status, body} when a test needs a specific provider payload.
    const fakeFetch=async(url,init={})=>{providerCalls.push(String(url));requests.push({url:String(url),headers:{...(init.headers||{})},body:init.body?JSON.parse(init.body):null});const next=statuses.shift()??500;const {status,body}=typeof next==="number"?{status:next}:next;return Response.json(body??(status===200?{candidates:[{content:{parts:[{text:"Project X: continue with tests"}]}}]}:{error:"rate limited"}),{status});};
    const code=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{module:compiledModule,exports:compiledModule.exports,require:localRequire,fetch:fakeFetch,Response,Request,Headers,URL,crypto,TextEncoder,TextDecoder,AbortController,DOMException,setTimeout,clearTimeout,console,structuredClone},{filename:file});return compiledModule.exports;
  }
  sqlite.prepare("INSERT INTO folders(id,user_id,name,provider_order,created_at,updated_at) VALUES('project','alice','Project X','[\"claude\",\"gemini\",\"openai\",\"perplexity\"]',?,?)").run(new Date().toISOString(),new Date().toISOString());
  return {sqlite,db,d1,env,load,providerCalls,requests,setStatuses:value=>{statuses=value;},setUser:value=>{user=value;},setCredential:value=>{credential=value;}};
}
