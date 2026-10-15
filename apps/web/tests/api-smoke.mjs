import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
const origin="http://127.0.0.1:5175";
// Port 5175 is a dedicated disposable clone/database. Never run delete-all on the user's port 5173.
const user="solvane-test-"+crypto.randomUUID();
const headers={"content-type":"application/json",cookie:"__sites_local_auth=1"};
let checks=0;
async function api(path,body,method=body?"POST":"GET",extra={}){const response=await fetch(origin+path,{method,headers:{...headers,...extra},body:body?JSON.stringify(body):undefined});const text=await response.text();let data;try{data=JSON.parse(text);}catch{throw Error(`${path}: ${response.status} ${text.slice(0,160)}`);}return {status:response.status,...data};}
const patch={decisions_add:["Use PostgreSQL"],done_add:["Added login"],open_questions_add:[],open_questions_resolve:[],constraints_add:[],next_step:"Test login",changes:[]};
const wrap=p=>`<<<SOLVANE_UPDATE v1\n${JSON.stringify(p)}\nSOLVANE_UPDATE>>>`;
try{
  let r=await api("/api/bootstrap");assert.equal(r.status,200);checks++;
  const created=await api("/api/folders",{name:user,description:"Disposable acceptance test"});assert.equal(created.status,201);checks++;
  const folderId=created.folder.id;
  const start=performance.now();let preview=await api("/api/checkpoint",{folderId,text:wrap(patch),mode:"preview"});assert.equal(preview.status,200);assert.equal(preview.source,"update_block");checks++;
  const blockLatency=performance.now()-start;
  const selected=preview.diff.filter(item=>item.field!=="completed").map(item=>item.key);
  const decisionKey=preview.diff.find(item=>item.field==="decisions").key;
  const commit={folderId,text:wrap(patch),mode:"commit",patch:preview.patch,checkpointHash:preview.checkpointHash,baseVersion:preview.baseVersion,acceptedKeys:selected,editedItems:{[decisionKey]:"Use SQLite for this demo"}};
  r=await api("/api/checkpoint",commit);assert.equal(r.status,200);assert.equal(r.snapshot.version,1);assert.deepEqual(r.snapshot.state.completed,[]);assert.deepEqual(r.snapshot.state.decisions,["Use SQLite for this demo"]);checks++;
  const repeated=await api("/api/checkpoint",commit);assert.equal(repeated.status,200);assert.equal(repeated.idempotent,true);assert.equal(repeated.snapshot.version,1);checks++;
  const history=await api(`/api/snapshots?folderId=${folderId}`);assert.equal(history.snapshots.length,1);assert.ok(history.snapshots[0].pinnedFields.some(pin=>pin.startsWith("decisions#")));checks++;
  for(const target of ["claude","openai","gemini","perplexity"]){r=await api("/api/handoffs",{folderId,target,mode:"browser",snapshotVersion:1});assert.equal(r.status,200);checks++;}
  r=await api("/api/checkpoint",{folderId,text:wrap(patch),mode:"preview"},"POST",{cookie:""});assert.equal(r.status,401);checks++;
  r=await api("/api/checkpoint",{folderId,text:"x".repeat(41000),mode:"preview"});assert.equal(r.status,413);checks++;
  r=await api("/api/checkpoint",{folderId,text:"<<<SOLVANE_UPDATE v1 {broken} SOLVANE_UPDATE>>>"});assert.equal(r.status,400);checks++;
  r=await api("/api/checkpoint",{folderId,text:"",mode:"preview"});assert.equal(r.status,400);checks++;
  const ordinary=await api("/api/checkpoint",{folderId,text:"We completed login tests.",mode:"preview"});assert.ok([200,424].includes(ordinary.status));checks++;
  const otherPatch={...patch,done_add:["Another progress fact"]};const otherText=wrap(otherPatch);preview=await api("/api/checkpoint",{folderId,text:otherText,mode:"preview"});
  const restore=await api("/api/snapshots",{folderId,state:history.snapshots[0].state});assert.equal(restore.snapshot.version,2);checks++;
  r=await api("/api/checkpoint",{folderId,text:otherText,mode:"commit",patch:preview.patch,checkpointHash:preview.checkpointHash,baseVersion:1,acceptedKeys:preview.diff.map(item=>item.key)});assert.equal(r.status,409);checks++;
  r=await api("/api/chat",{folderId,content:"Test",turnId:crypto.randomUUID()});assert.equal(r.status,424);checks++;
  r=await api("/api/export");assert.equal(r.status,200);checks++;
  r=await api("/api/metrics");assert.equal(r.status,403);checks++;
  r=await api("/api/account/delete-all",undefined,"DELETE");assert.equal(r.deleted,true);checks++;
  r=await api(`/api/snapshots?folderId=${folderId}`);assert.equal(r.snapshots.length,0);checks++;
  r=await api("/api/account");assert.equal(r.counts.projects,0);assert.equal(r.counts.messages,0);assert.equal(r.counts.apiConnections,0);checks++;
  console.log(JSON.stringify({checks,validBlockPreviewMs:Math.round(blockLatency),gemini:ordinary.status===424?"not configured":"live response",identity:user,deletedSyntheticData:true},null,2));
}finally{await api("/api/account/delete-all",undefined,"DELETE").catch(()=>{});}
