import {test} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {harness} from "./route-harness.mjs";
const root=fileURLToPath(new URL("../",import.meta.url));

const empty={decisions_add:[],done_add:[],open_questions_add:[],open_questions_resolve:[],constraints_add:[],next_step:"",changes:[]};
const block=(patch)=>`<<<SOLVANE_UPDATE v1\n${JSON.stringify({...empty,...patch})}\nSOLVANE_UPDATE>>>`;
const all=(diff)=>diff.map((item)=>item.key);
const defaults=(diff)=>diff.filter((item)=>item.autoApplicable).map((item)=>item.key);

function app(){
  const h=harness();
  const checkpoint=h.load(path.join(root,"app/api/checkpoint/route.ts"));
  const snapshots=h.load(path.join(root,"app/api/snapshots/route.ts"));
  const {itemPinKey}=h.load(path.join(root,"lib/checkpoint.ts"));
  const call=async(route,body)=>{const response=await route.POST(new Request("http://test/api",{method:"POST",body:JSON.stringify({folderId:"project",...body})}));return {status:response.status,...await response.json()};};
  const preview=(text)=>call(checkpoint,{text,mode:"preview"});
  const commit=(text,review,choose=all,edits={})=>call(checkpoint,{text,mode:"commit",patch:review.patch,acceptedKeys:choose(review.diff),editedItems:edits,checkpointHash:review.checkpointHash,baseVersion:review.baseVersion});
  const save=async(text,choose=all,edits={})=>{const review=await preview(text);assert.equal(review.status,200,review.error);return commit(text,review,choose,edits);};
  const latest=async()=>(await (await snapshots.GET(new Request("http://test/api/snapshots?folderId=project"))).json()).snapshots[0];
  return {snapshots,itemPinKey,call,preview,commit,save,latest};
}

test("Undo restores without pinning anything, so the next accepted save applies in full",async()=>{
  const a=app();
  const first=await a.save(block({decisions_add:["Use Postgres"],next_step:"Write the migration"}));
  assert.equal(first.snapshot.version,1);
  const undo=await a.call(a.snapshots,{restoreVersion:first.previousVersion});
  assert.equal(undo.snapshot.version,2);
  assert.deepEqual(undo.snapshot.pinnedFields,[]);
  const next=await a.save(block({decisions_add:["Add a Redis cache"],next_step:"Ship the login page"}));
  assert.equal(next.snapshot.version,3);
  assert.equal(next.snapshot.state.nextAction,"Ship the login page");
  assert.deepEqual(next.snapshot.state.decisions,["Add a Redis cache"]);
  // Older extensions send Undo as a bare state; that must not pin either.
  const legacyUndo=await a.call(a.snapshots,{state:next.previousState});
  assert.deepEqual(legacyUndo.snapshot.pinnedFields,[]);
});

test("a list change replaces one decision and keeps the others",async()=>{
  const a=app();
  await a.save(block({decisions_add:["Use SQLite","Ship by Friday","Keep the UI minimal"]}));
  const changed=await a.save(block({changes:[{field:"decisions",from:"Use SQLite",to:"Use Postgres, not SQLite",source_excerpt:"x"}]}));
  assert.deepEqual(changed.snapshot.state.decisions,["Use Postgres, not SQLite","Ship by Friday","Keep the UI minimal"]);
});

test("saving the same text again after Undo creates a new version, while a retried request replays",async()=>{
  const a=app();
  const text=block({decisions_add:["Use Stripe for billing"]});
  const review=await a.preview(text);
  const first=await a.commit(text,review);
  assert.equal(first.snapshot.version,1);
  const retry=await a.commit(text,review);
  assert.equal(retry.idempotent,true);
  assert.equal(retry.snapshot.version,1);
  await a.call(a.snapshots,{restoreVersion:0});
  const again=await a.save(text);
  assert.equal(again.status,200);
  assert.equal(again.idempotent,false);
  assert.equal(again.snapshot.version,3);
  assert.deepEqual((await a.latest()).state.decisions,["Use Stripe for billing"]);
});

test("accepting nothing saves no new version",async()=>{
  const a=app();
  await a.save(block({decisions_add:["Use SQLite"]}));
  const nothing=await a.save(block({decisions_add:["Ship by Friday"]}),()=>[]);
  assert.equal(nothing.unchanged,true);
  assert.equal(nothing.snapshot.version,1);
  assert.equal((await a.latest()).version,1);
});

test("manual edits pin only what changed; a pinned item needs an explicit accept, which releases the pin",async()=>{
  const a=app();
  const first=await a.save(block({decisions_add:["Use SQLite","Ship by Friday"],next_step:"Write tests"}));
  const edit=await a.call(a.snapshots,{state:{...first.snapshot.state,nextAction:"Write the login page"},reason:"edit",editedFrom:first.snapshot.state});
  assert.deepEqual(edit.snapshot.pinnedFields,["nextAction"]);
  const text=block({next_step:"Deploy to staging"});
  const review=await a.preview(text);
  const nextStep=review.diff.find((item)=>item.field==="nextAction");
  assert.equal(nextStep.pinned,true);
  assert.equal(nextStep.autoApplicable,false);
  assert.equal((await a.commit(text,review,defaults)).unchanged,true);
  const accepted=await a.commit(text,review);
  assert.equal(accepted.snapshot.state.nextAction,"Deploy to staging");
  assert.deepEqual(accepted.snapshot.pinnedFields,[]);
});

test("pins change on the latest version only, migrate legacy field pins, and travel with a restored version",async()=>{
  const a=app();
  await a.save(block({decisions_add:["Use SQLite","Ship by Friday"],next_step:"Write tests"}));
  const pinned=await a.call(a.snapshots,{version:1,pins:["nextAction","decisions","not-a-field"]});
  assert.deepEqual(pinned.snapshot.pinnedFields.sort(),["nextAction",a.itemPinKey("decisions","Use SQLite"),a.itemPinKey("decisions","Ship by Friday")].sort());
  assert.equal((await a.call(a.snapshots,{version:0,pins:[]})).status,409);
  await a.save(block({decisions_add:["Add a Redis cache"]}));
  const restored=await a.call(a.snapshots,{restoreVersion:1});
  assert.equal(restored.snapshot.version,3);
  assert.deepEqual(restored.snapshot.pinnedFields.sort(),pinned.snapshot.pinnedFields.sort());
});
