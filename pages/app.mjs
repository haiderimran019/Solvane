import { parseSolvaneUpdateBlock, redactSecrets, diffCheckpoint, applyCheckpointPatch, buildCapsulePrompt, PROJECT_INSTRUCTION, checkpointFieldLabel } from './lib/checkpoint.mjs';
import { PROVIDERS } from './lib/product.mjs';
import { FIELDS, LIST_FIELDS, STORAGE_KEY, blank, newProject, current, commitVersion, initialWorkspace, validateWorkspace, loadWorkspace, persistWorkspace, snapshotDiff } from './workspace.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const el = (tag, text, className) => { const element = document.createElement(tag); if (text !== undefined) element.textContent = text; if (className) element.className = className; return element; };
let workspace;
let recovery = false;
let proposal = null;
let nameAction = 'new';
let view = 'home';
const project = () => workspace.projects.find(item => item.id === workspace.active);
const date = value => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
function notify(text, error = false) { const node = $('#message'); node.hidden = !text; node.textContent = text; node.classList.toggle('error', error); }
function report(error) { notify(error.message || 'This action could not be completed. Your current work has been kept.', true); }
try { workspace = loadWorkspace(localStorage); }
catch { workspace = initialWorkspace(); recovery = true; $('#storage-warning').hidden = false; $('#storage-warning').textContent = 'Your saved workspace could not be read, or browser storage is blocked. Your stored data has not been changed. Export stored data in Your data before clearing the workspace, or allow browser storage and reload.'; }
function persist(next) {
  if (recovery) throw new Error('Storage needs attention. Open Your data to export stored data, then clear the local workspace, or allow storage and reload.');
  try { persistWorkspace(localStorage, next); }
  catch (error) {
    if (error.name === 'QuotaExceededError' || error.name === 'SecurityError') throw new Error('Your browser could not save this workspace. Storage may be full or blocked. Export a backup, free storage or allow site storage, then try again. Your draft is still here.');
    throw error;
  }
  workspace = next;
}
function replaceProject(updated) { persist({ ...workspace, projects: workspace.projects.map(item => item.id === updated.id ? updated : item) }); }
function setView(next, focus = true) {
  if (!['home','save','memory','history','data'].includes(next)) next = 'home';
  view = next;
  $$('.view').forEach(node => { node.hidden = node.id !== `view-${next}`; });
  $$('.sidebar nav [data-view]').forEach(button => { if (button.dataset.view === next) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); });
  if (next === 'save' && !proposal) fillForm();
  render();
  if (focus) $('#main').focus({ preventScroll: true });
}
function fillForm(state = current(project())) {
  for (const key of Object.keys(FIELDS)) $(`#field-${key}`).value = Array.isArray(state[key]) ? state[key].join('\n') : state[key];
}
function inputMode(mode) {
  $('#manual-mode').setAttribute('aria-pressed', String(mode === 'manual'));
  $('#block-mode').setAttribute('aria-pressed', String(mode === 'block'));
  $('#manual-form').hidden = mode !== 'manual';
  $('#block-form').hidden = mode !== 'block';
  $('#review').hidden = true;
  proposal = null;
}
function render() {
  const active = project();
  const state = current(active);
  const version = active.versions.length;
  $('#project-select').replaceChildren(...workspace.projects.map(item => { const option = el('option', item.name); option.value = item.id; return option; }));
  $('#project-select').value = active.id;
  $('#project-title').textContent = active.name;
  $('#version-count').textContent = version;
  $('#save-status').textContent = version ? `Version ${version} · saved ${date(active.versions.at(-1).at)}` : 'Ready for your first save';
  $('#preview-status').textContent = version ? `Version ${version} · reviewed by you` : 'Your important context, reviewed';
  $('#next-step').textContent = state.nextAction || 'Save your project context to set a clear next step.';
  $('#current-task').textContent = state.currentTask || 'Nothing saved yet.';
  $('#decisions-count').textContent = state.decisions.length;
  $('#completed-count').textContent = state.completed.length;
  $('#questions-count').textContent = state.openQuestions.length;
  $('#home-continue').disabled = !version;
  $('#copy-capsule').disabled = !version;
  $('#download-markdown').disabled = !version;
  $('#open-provider').hidden = !version;
  $('#undo-save').disabled = !version;
  $('#memory-version').textContent = version ? `Capsule v${version} · ${date(active.versions.at(-1).at)}` : 'No saved capsule yet.';
  $('#data-counts').textContent = `${workspace.projects.length} project(s), ${workspace.projects.reduce((count, item) => count + item.versions.length, 0)} saved version(s). Export regularly; browser storage is not a cloud backup.`;
  const content = $('#capsule-content'); content.replaceChildren();
  if (!version) {
    const empty = el('div', undefined, 'empty'); empty.append(el('h2', 'Your project memory starts here.'), el('p', 'Save your context, or try the example from Overview.'));
    content.append(empty);
  } else {
    for (const [key, label] of Object.entries(FIELDS)) {
      const field = el('section', undefined, 'capsule-field'); field.append(el('h2', label));
      if (Array.isArray(state[key]) && state[key].length) { const list = el('ul'); state[key].forEach(text => list.append(el('li', text))); field.append(list); }
      else field.append(el('p', Array.isArray(state[key]) ? 'Nothing recorded.' : state[key] || 'Not set.'));
      content.append(field);
    }
  }
  $('#handoff-preview').value = version ? redactSecrets(buildCapsulePrompt({ projectName: active.name, state })).text : '';
  const target = $('#target-provider').value;
  $('#open-provider').href = PROVIDERS[target].webUrl;
  $('#open-provider').textContent = `Open ${PROVIDERS[target].name} ↗`;
  if (view === 'history') renderHistory();
}
function renderHistory() {
  const active = project(); const container = $('#history-list'); container.replaceChildren();
  if (!active.versions.length) { container.append(el('p', 'No versions yet. Save your project context to begin.', 'empty')); return; }
  [...active.versions].reverse().forEach((version, position) => {
    const index = active.versions.length - position;
    const row = el('article', undefined, 'history-row'); const copy = el('div');
    copy.append(el('h2', `Version ${index}${position === 0 ? ' · Current' : ''}`), el('p', `${version.reason} · ${date(version.at)}`));
    const details = el('details'); details.append(el('summary','View capsule'), el('pre', buildCapsulePrompt({ projectName: active.name, state: version.state }))); copy.append(details); row.append(copy);
    if (position !== 0) { const button = el('button', 'Restore', 'quiet'); button.setAttribute('aria-label', `Restore version ${index}`); button.addEventListener('click', () => {
      try { replaceProject(commitVersion(project(), version.state, `Restored version ${index}`)); render(); notify(`Version ${index} restored as version ${project().versions.length}.`); } catch(error) { report(error); }
    }); row.append(button); }
    container.append(row);
  });
}
for (const [key, label] of Object.entries(FIELDS)) {
  const field = el('div', undefined, 'form-field');
  const name = el('label', label); name.htmlFor = `field-${key}`;
  const input = el('textarea'); input.id = `field-${key}`; input.rows = LIST_FIELDS.includes(key) ? 3 : 2; input.maxLength = LIST_FIELDS.includes(key) ? 12000 : 2000; input.dir = 'auto'; input.placeholder = key === 'objective' ? 'What are you trying to achieve?' : key === 'currentTask' ? 'What are you working on now?' : key === 'nextAction' ? 'One concrete thing to do next' : 'One item per line';
  field.append(name,input); $('#manual-fields').append(field);
}
function showReview(items, apply, redactions = 0) {
  if (!items.length) { notify('No new changes found. Edit your context to create a new version.'); return; }
  proposal = { items, apply, projectId: project().id, baseVersion: project().versions.length };
  $('#manual-form').hidden = true; $('#block-form').hidden = true; $('#review').hidden = false;
  $('#review-explanation').textContent = `Only selected changes will be saved.${redactions ? ` Redacted ${redactions} common secret format(s). Check the text before saving.` : ''}`;
  $('#diff-list').replaceChildren();
  items.forEach((item, index) => {
    const row = el('div', undefined, 'diff-row');
    const input = el('input'); input.type = 'checkbox'; input.id = `diff-${index}`; input.checked = item.selected !== false; input.addEventListener('change', updateSelection);
    const label = el('label'); label.htmlFor = input.id; label.append(el('span', `${item.kind[0].toUpperCase()+item.kind.slice(1)} · ${FIELDS[item.field] || checkpointFieldLabel(item.field)}`, 'diff-heading'));
    if (item.from) label.append(el('del', item.from));
    if (item.to) label.append(el('ins', item.to));
    row.append(input,label); $('#diff-list').append(row);
  });
  updateSelection(); $('#review-title').focus();
}
function updateSelection() {
  const count = $$('#diff-list input:checked').length;
  $('#selection-count').textContent = `${count} of ${proposal?.items.length || 0} changes selected`;
  $('#accept-review').disabled = !count;
}
$('#manual-form').addEventListener('submit', event => {
  event.preventDefault(); notify('');
  try {
    const state = blank(); let redactions = 0;
    for (const key of Object.keys(FIELDS)) {
      const result = redactSecrets($(`#field-${key}`).value.trim()); redactions += result.count;
      state[key] = LIST_FIELDS.includes(key) ? [...new Set(result.text.split('\n').map(item => item.trim()).filter(Boolean))] : result.text;
    }
    if (!state.objective || !state.nextAction) throw new Error('Add an objective and a next step so another AI can continue your work.');
    const before = current(project()); const diff = snapshotDiff(before,state);
    showReview(diff, selected => {
      const next = structuredClone(before);
      diff.forEach((item, index) => { if (!selected.has(index)) return;
        if (!LIST_FIELDS.includes(item.field)) next[item.field] = item.to;
        else if (item.kind === 'added') next[item.field].push(item.to);
        else next[item.field] = next[item.field].filter(text => text !== item.from);
      }); return next;
    }, redactions);
  } catch(error) { report(error); }
});
$('#block-form').addEventListener('submit', event => {
  event.preventDefault(); notify('');
  try {
    const redacted = redactSecrets($('#update-block').value); const parsed = parseSolvaneUpdateBlock(redacted.text);
    if (!parsed.ok) throw new Error(parsed.error || 'Paste a complete SOLVANE_UPDATE v1 block. For ordinary chat text, use Write your context.');
    const before = current(project()); const diff = diffCheckpoint(before, parsed.patch);
    showReview(diff.map(item => ({ ...item, from: item.kind === 'removed' ? item.text : item.from || '', to: item.kind === 'changed' ? item.to : item.kind === 'added' ? item.text : '', selected: item.autoApplicable })), selected => applyCheckpointPatch(before, parsed.patch, new Set([...selected].map(index => diff[index].key))), redacted.count);
  } catch(error) { report(error); }
});
$('#accept-review').addEventListener('click', () => {
  try {
    if (!proposal || project().id !== proposal.projectId || project().versions.length !== proposal.baseVersion) throw new Error('The project changed. Review your draft again before saving.');
    const selected = new Set($$('#diff-list input').flatMap((input,index) => input.checked ? [index] : []));
    replaceProject(commitVersion(project(), proposal.apply(selected)));
    proposal = null; $('#review').hidden = true; $('#update-block').value = ''; inputMode('manual'); setView('memory'); notify(`Saved version ${project().versions.length}. Your capsule is ready to carry forward.`);
  } catch(error) { report(error); }
});
$('#cancel-review').addEventListener('click', () => { proposal = null; $('#review').hidden = true; $('#manual-form').hidden = $('#manual-mode').getAttribute('aria-pressed') !== 'true'; $('#block-form').hidden = !$('#manual-form').hidden; });
$('#manual-mode').addEventListener('click', () => inputMode('manual'));
$('#block-mode').addEventListener('click', () => inputMode('block'));
$$('[data-view]').forEach(button => button.addEventListener('click', () => { notify(''); setView(button.dataset.view); }));
$('#home-continue').addEventListener('click', () => { setView('memory'); $('#handoff-title').focus(); $('#handoff-title').scrollIntoView({ block:'center',behavior:'instant' }); });
$('#project-select').addEventListener('change', event => { try { persist({ ...workspace, active:event.target.value }); proposal = null; inputMode('manual'); fillForm(); notify(''); setView('home'); } catch(error) { render(); report(error); } });
function nameDialog(action) { nameAction = action; $('#name-title').textContent = action === 'new' ? 'Create a project' : 'Rename project'; $('#project-name').value = action === 'new' ? '' : project().name; $('#name-dialog').showModal(); $('#project-name').focus(); }
$('#new-project').addEventListener('click', () => nameDialog('new'));
$('#rename-project').addEventListener('click', () => nameDialog('rename'));
$('#cancel-name').addEventListener('click', () => $('#name-dialog').close());
$('#name-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const name = redactSecrets($('#project-name').value.trim()).text; if (!name) return;
    if (nameAction === 'new') { const added = newProject(name); persist({ ...workspace, active:added.id, projects:[...workspace.projects,added] }); proposal=null; inputMode('manual'); }
    else replaceProject({ ...project(), name });
    $('#name-dialog').close(); setView('home'); notify(nameAction === 'new' ? 'Project created. Save your first context.' : 'Project renamed.');
  } catch(error) { $('#name-dialog').close(); report(error); }
});
$('#try-example').addEventListener('click', () => {
  proposal = null; inputMode('manual'); setView('save');
  fillForm({ ...blank(), objective:'Build a personal portfolio that makes my work easy to explore.', currentTask:'Polish the project case studies.', decisions:['Use a separate page for each case study.','Link each project to its working demo and source.'], constraints:['Keep the layout readable on mobile.'], completed:['Selected three projects to feature.'], openQuestions:['Which project should lead the portfolio?'], nextAction:'Write the problem and outcome for the first case study.' });
  notify('Example loaded as a draft. Review the changes to save it to this project.');
});
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}
$('#copy-instruction').addEventListener('click', async () => {
  if (await copyText(PROJECT_INSTRUCTION)) notify('AI instruction copied. Add it to your conversation to get structured update blocks.');
  else { $('#update-block').value = PROJECT_INSTRUCTION; $('#update-block').focus(); $('#update-block').select(); notify('Clipboard access is unavailable. The instruction is selected in the text box; copy it manually. Replace it with the AI’s update block when ready.'); }
});
$('#target-provider').addEventListener('change', render);
$('#copy-capsule').addEventListener('click', async () => {
  const activeId = project().id; const version = project().versions.length; const provider = $('#target-provider').value;
  const copied = await copyText($('#handoff-preview').value);
  if (!copied) { $('#handoff-preview').closest('details').open = true; $('#handoff-preview').focus(); $('#handoff-preview').select(); notify('Clipboard access is unavailable. The capsule is selected below; copy it manually.'); return; }
  notify(`Capsule copied. Open ${PROVIDERS[provider].name}, paste it and press Send when you’re ready.`);
  try { if (project().id === activeId) replaceProject({ ...project(), handoffs:[...project().handoffs,{ provider,version,at:new Date().toISOString() }] }); }
  catch { notify('Capsule copied. The local handoff log could not be saved; your capsule versions are unchanged.'); }
});
function download(text,name,type) {
  const url = URL.createObjectURL(new Blob([text],{type})); const anchor = el('a'); anchor.href=url; anchor.download=name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
$('#download-markdown').addEventListener('click', () => download($('#handoff-preview').value,'handoff.md','text/markdown;charset=utf-8'));
$('#export-workspace').addEventListener('click', () => download(JSON.stringify(workspace,null,2),'solvane-workspace.json','application/json'));
$('#download-raw').addEventListener('click', () => { try { const raw = localStorage.getItem(STORAGE_KEY); if (!raw) { notify('No stored workspace found. Use Export workspace JSON to download the current workspace.'); return; } download(raw,'solvane-stored-data.json','application/json'); } catch(error) { report(error); } });
$('#import-workspace').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('This backup exceeds 2 MB. Choose a smaller workspace backup.');
    const imported = validateWorkspace(JSON.parse(await file.text()));
    // Redact before committing imported content too. Validation runs again during persist.
    const clean = validateWorkspace(JSON.parse(redactSecrets(JSON.stringify(imported)).text));
    if (!confirm('Replace this browser’s Solvane workspace with the imported backup? Export your current workspace first if you want to keep it.')) return;
    persist(clean); proposal=null; inputMode('manual'); setView('home'); notify('Workspace imported. Your projects and version history are ready.');
  } catch(error) { report(error); }
  finally { event.target.value=''; }
});
$('#undo-save').addEventListener('click', () => {
  try {
    const active = project(); if (!active.versions.length) return;
    const state = active.versions.at(-2)?.state || blank(); replaceProject(commitVersion(active,state,`Undo version ${active.versions.length}`)); render(); notify('Previous capsule restored as a new version. Your history is preserved.');
  } catch(error) { report(error); }
});
$('#reset-workspace').addEventListener('click', () => {
  if (!confirm('Clear all Solvane projects and versions saved in this browser? Export a backup first. This cannot be undone without a backup.')) return;
  try { const next=initialWorkspace(); persistWorkspace(localStorage,next); workspace=next; recovery=false; $('#storage-warning').hidden=true; proposal=null; inputMode('manual'); setView('home'); notify('Local workspace cleared. You can start a new project.'); } catch(error) { report(error); }
});
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY) return;
  recovery=true; $('#storage-warning').hidden=false; $('#storage-warning').textContent='The workspace changed in another tab. Reload this page to use the latest version. Your unsaved draft remains here until you reload.';
});
fillForm(); render();
