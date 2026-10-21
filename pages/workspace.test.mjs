import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blank, initialWorkspace, commitVersion, current, validateWorkspace, persistWorkspace, loadWorkspace, snapshotDiff } from './workspace.mjs';
const state = { ...blank(), objective:'Build a portfolio', nextAction:'Write the first case study', decisions:['Keep it readable'] };
test('reviewed save survives a JSON backup round trip with history intact', () => {
  const workspace=initialWorkspace(); workspace.projects[0]=commitVersion(workspace.projects[0],state);
  const restored=validateWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.deepEqual(current(restored.projects[0]),state);
  assert.equal(restored.projects[0].versions.length,1);
});
test('restoring an older state appends a version and preserves previous state', () => {
  let project=initialWorkspace().projects[0]; project=commitVersion(project,state);
  project=commitVersion(project,{ ...state,nextAction:'Deploy the portfolio' });
  project=commitVersion(project,project.versions[0].state,'Restore version 1');
  assert.equal(project.versions.length,3); assert.equal(project.versions[1].state.nextAction,'Deploy the portfolio'); assert.deepEqual(current(project),state);
});
test('failed storage write does not mutate the previous workspace', () => {
  const original=initialWorkspace(); const next=structuredClone(original); next.projects[0]=commitVersion(next.projects[0],state);
  assert.throws(() => persistWorkspace({ setItem(){ throw new DOMException('Full','QuotaExceededError'); } },next));
  assert.equal(original.projects[0].versions.length,0);
});
test('corrupt or hostile imports are rejected while text remains ordinary data', () => {
  for (const value of [null,{}, {schema:1,projects:[]}, {schema:1,projects:[{id:'x',name:'x',versions:[{state:{}}]}]}]) assert.throws(() => validateWorkspace(value));
  const workspace=initialWorkspace(); workspace.projects[0]=commitVersion(workspace.projects[0],{...state,objective:'<img src=x onerror=alert(1)>'});
  assert.equal(validateWorkspace(workspace).projects[0].versions[0].state.objective,'<img src=x onerror=alert(1)>');
  assert.throws(() => loadWorkspace({getItem:()=>'{broken'}));
  const duplicated=structuredClone(workspace); duplicated.projects.push(duplicated.projects[0]); assert.throws(() => validateWorkspace(duplicated));
});
test('diff exposes additions and removals independently and rejects no-op versions', () => {
  const before={...state,decisions:['Old decision']}; const after={...state,decisions:['New decision']};
  assert.deepEqual(snapshotDiff(before,after).map(item=>item.kind),['added','removed']);
  const project=commitVersion(initialWorkspace().projects[0],state); assert.throws(()=>commitVersion(project,state),/No changes/);
});
