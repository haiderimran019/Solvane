export const STORAGE_KEY = 'solvane-pages-v1';
export const FIELDS = {
  objective: 'Objective', currentTask: 'Current task', nextAction: 'Next step',
  decisions: 'Decisions', constraints: 'Constraints', completed: 'Completed',
  openQuestions: 'Open questions', doNotRepeat: 'Do not repeat', artifacts: 'Artifacts', sources: 'Sources',
};
export const LIST_FIELDS = Object.keys(FIELDS).slice(3);
export const blank = () => Object.fromEntries(Object.keys(FIELDS).map(key => [key, LIST_FIELDS.includes(key) ? [] : '']));
const fail = () => { throw new Error('This backup is invalid. Choose a Solvane workspace JSON export.'); };

export function validateSnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  const state = blank();
  for (const key of Object.keys(FIELDS)) {
    const field = value[key];
    if (LIST_FIELDS.includes(key)) {
      if (!Array.isArray(field) || field.length > 100 || field.some(item => typeof item !== 'string' || item.length > 4000)) return fail();
      state[key] = [...field];
    } else {
      if (typeof field !== 'string' || field.length > 4000) return fail();
      state[key] = field;
    }
  }
  return state;
}

export function newProject(name = 'Untitled project') {
  return { id: crypto.randomUUID(), name: name.trim().slice(0, 80) || 'Untitled project', versions: [], handoffs: [] };
}
export function current(project) { return project.versions.at(-1)?.state || blank(); }
export function commitVersion(project, state, reason = 'Saved progress') {
  const clean = validateSnapshot(state);
  if (JSON.stringify(current(project)) === JSON.stringify(clean)) throw new Error('No changes to save. Your current version is already up to date.');
  return { ...project, versions: [...project.versions, { id: crypto.randomUUID(), at: new Date().toISOString(), reason, state: clean }] };
}
export function initialWorkspace() {
  const project = newProject('My first project');
  return { schema: 1, active: project.id, projects: [project] };
}
export function validateWorkspace(value) {
  if (!value || value.schema !== 1 || !Array.isArray(value.projects) || !value.projects.length || value.projects.length > 50) return fail();
  const ids = new Set();
  const projects = value.projects.map(project => {
    if (!project || typeof project.id !== 'string' || !project.id || ids.has(project.id) || typeof project.name !== 'string' || !project.name.trim() || project.name.length > 80 || !Array.isArray(project.versions) || project.versions.length > 200) return fail();
    ids.add(project.id);
    const versions = project.versions.map(version => {
      if (!version || typeof version.id !== 'string' || !Number.isFinite(Date.parse(version.at)) || typeof version.reason !== 'string' || version.reason.length > 160) return fail();
      return { id: version.id, at: version.at, reason: version.reason, state: validateSnapshot(version.state) };
    });
    const handoffs = (Array.isArray(project.handoffs) ? project.handoffs : []).slice(-100).filter(item => item && ['claude','openai','gemini','perplexity'].includes(item.provider) && Number.isInteger(item.version) && Number.isFinite(Date.parse(item.at))).map(item => ({ provider: item.provider, version: item.version, at: item.at }));
    return { id: project.id, name: project.name, versions, handoffs };
  });
  if (!ids.has(value.active)) return fail();
  return { schema: 1, active: value.active, projects };
}
export function loadWorkspace(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw ? validateWorkspace(JSON.parse(raw)) : initialWorkspace();
}
export function persistWorkspace(storage, workspace) {
  // Write before updating UI state. A full/blocked store must never claim the save succeeded.
  storage.setItem(STORAGE_KEY, JSON.stringify(validateWorkspace(workspace)));
  return workspace;
}
export function snapshotDiff(before, after) {
  return Object.keys(FIELDS).flatMap(field => {
    if (!LIST_FIELDS.includes(field)) return before[field] === after[field] ? [] : [{ field, kind: before[field] ? 'changed' : 'added', from: before[field], to: after[field] }];
    return [...after[field].filter(item => !before[field].includes(item)).map(to => ({ field, kind: 'added', from: '', to })), ...before[field].filter(item => !after[field].includes(item)).map(from => ({ field, kind: 'removed', from, to: '' }))];
  });
}
