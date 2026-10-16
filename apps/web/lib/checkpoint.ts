import type { RelaySnapshot } from "./product";

export const CHECKPOINT_SCHEMA_VERSION = 1 as const;
export const DEFAULT_CHECKPOINT_TOKEN_BUDGET = 1_500;

export type CheckpointChange = {
  field: string;
  from: string;
  to: string;
  source_excerpt?: string;
};

export type CheckpointPatch = {
  decisions_add: string[];
  done_add: string[];
  open_questions_add: string[];
  open_questions_resolve: string[];
  constraints_add: string[];
  next_step: string;
  changes: CheckpointChange[];
};

export type CheckpointDiffItem = {
  key: string;
  kind: "added" | "changed" | "removed";
  field: string;
  text: string;
  from?: string;
  to?: string;
  autoApplicable: boolean;
  contradiction?: boolean;
  sourceExcerpt?: string;
  pinned?: boolean;
};

const LIST_LIMIT = 10;
const ITEM_LIMIT = 240;
const SCALAR_FIELDS = ["objective", "currentTask", "nextAction"] as const;
// Ordered by trimming priority: the capsule budget drops old completed work first.
const LIST_FIELDS = ["completed", "doNotRepeat", "openQuestions", "artifacts", "sources", "decisions", "constraints"] as const;
type ScalarField = (typeof SCALAR_FIELDS)[number];
type ListField = (typeof LIST_FIELDS)[number];
const VALID_FIELDS = new Set([
  "objective",
  "currentTask",
  "nextAction",
  "next_step",
  "constraints",
  "decisions",
  "completed",
  "openQuestions",
  "doNotRepeat",
  "artifacts",
  "sources",
]);

function cleanText(value: unknown, limit = ITEM_LIMIT): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const text = cleanText(item);
    const key = text.toLocaleLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= LIST_LIMIT) break;
  }
  return result;
}

export function validateCheckpointPatch(value: unknown):
  | { ok: true; patch: CheckpointPatch }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "The update is not a JSON object." };
  }
  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add", "next_step", "changes"]);
  const unknownKey = Object.keys(record).find((key) => !allowedKeys.has(key));
  if (unknownKey) return { ok: false, error: `Unknown patch field: ${unknownKey}.` };
  for (const key of ["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add"]) {
    if (record[key] !== undefined && !Array.isArray(record[key])) return { ok: false, error: `${key} must be an array.` };
    if (Array.isArray(record[key]) && record[key].some((item) => typeof item !== "string")) return { ok: false, error: `${key} must contain only text.` };
  }
  if (record.next_step !== undefined && typeof record.next_step !== "string") return { ok: false, error: "next_step must be a string." };
  const changesValue = record.changes;
  if (changesValue !== undefined && !Array.isArray(changesValue)) {
    return { ok: false, error: "The changes field must be an array." };
  }
  const changes: CheckpointChange[] = [];
  for (const item of Array.isArray(changesValue) ? changesValue.slice(0, 8) : []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: "Each change must have field, from, and to." };
    }
    const change = item as Record<string, unknown>;
    if (typeof change.field !== "string" || typeof change.from !== "string" || typeof change.to !== "string") {
      return { ok: false, error: "Each change must have string field, from, and to values." };
    }
    const field = cleanText(change.field, 40);
    if (!VALID_FIELDS.has(field)) {
      return { ok: false, error: `Unknown change field: ${field || "blank"}.` };
    }
    changes.push({ field, from: cleanText(change.from), to: cleanText(change.to), ...(typeof change.source_excerpt === "string" ? { source_excerpt: cleanText(change.source_excerpt, 400) } : {}) });
  }
  return {
    ok: true,
    patch: {
      decisions_add: cleanList(record.decisions_add),
      done_add: cleanList(record.done_add),
      open_questions_add: cleanList(record.open_questions_add),
      open_questions_resolve: cleanList(record.open_questions_resolve),
      constraints_add: cleanList(record.constraints_add),
      next_step: cleanText(record.next_step, 300),
      changes,
    },
  };
}

export function parseSolvaneUpdateBlock(text: string):
  | { ok: true; patch: CheckpointPatch }
  | { ok: false; present: boolean; error?: string } {
  const matches = [...text.matchAll(/<<<SOLVANE_UPDATE\s+v1\s*([\s\S]*?)\s*SOLVANE_UPDATE>>>/gi)];
  const match = matches.at(-1);
  if (!match) return { ok: false, present: /<<<SOLVANE_UPDATE/i.test(text), error: "The update block is incomplete or has an unsupported version. Paste the complete v1 block." };
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    const result = validateCheckpointPatch(parsed);
    return result.ok ? result : { ok: false, present: true, error: result.error };
  } catch {
    return { ok: false, present: true, error: "The SOLVANE_UPDATE block contains invalid JSON." };
  }
}

export function redactSecrets(text: string): { text: string; count: number } {
  let count = 0;
  const replace = (value: string, pattern: RegExp) => value.replace(pattern, () => {
    count += 1;
    return "[REDACTED_SECRET]";
  });
  let redacted = text;
  redacted = replace(redacted, /\b(?:sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16})\b/g);
  redacted = replace(redacted, /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi);
  redacted = replace(redacted, /(^|\n)\s*[A-Z][A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY)\s*=\s*(?!\[REDACTED_SECRET\])[^\n]+/g);
  redacted = replace(redacted, /(^|\n)\s*\.env(?:\.[A-Za-z0-9_-]+)?\s*[:=]\s*[^\n]+/gi);
  redacted = replace(redacted, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g);
  redacted = replace(redacted, /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g);
  return { text: redacted, count };
}

function hashKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function checkpointTextHash(value: string) {
  return hashKey(value);
}

function additionKey(field: string, text: string) {
  return `add:${field}:${hashKey(text.toLocaleLowerCase())}`;
}

function resolveKey(text: string) {
  return `remove:openQuestions:${hashKey(text.toLocaleLowerCase())}`;
}

function isListField(field: string): field is ListField {
  return (LIST_FIELDS as readonly string[]).includes(field);
}

function sameText(left: string, right: string) {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

function cleanEdit(value: unknown) {
  return typeof value === "string" ? redactSecrets(value).text.trim().slice(0, 300) : "";
}

/**
 * Pins protect what a person wrote from automatic changes. A scalar field pins by name;
 * a list item pins as `field#hash`. A bare list-field name is a legacy whole-field pin.
 */
export function itemPinKey(field: string, text: string) {
  return `${field}#${hashKey(text.trim().toLocaleLowerCase())}`;
}

export function isPinned(pins: readonly string[], field: string, text?: string) {
  if (pins.includes(field)) return true;
  return text !== undefined && isListField(field) && pins.includes(itemPinKey(field, text));
}

/** Turns legacy whole-field list pins into pins on the items present now, and drops pins whose item is gone. */
export function normalizePins(pins: unknown, state: RelaySnapshot): string[] {
  const result = new Set<string>();
  for (const pin of Array.isArray(pins) ? pins : []) {
    if (typeof pin !== "string") continue;
    if ((SCALAR_FIELDS as readonly string[]).includes(pin)) result.add(pin);
    else if (isListField(pin)) state[pin].forEach((item) => result.add(itemPinKey(pin, item)));
    else if (LIST_FIELDS.some((field) => state[field].some((item) => itemPinKey(field, item) === pin))) result.add(pin);
  }
  return [...result];
}

/** Pins only what a person changed by hand: edited scalar fields and new or reworded list items. */
export function pinsForManualEdit(before: RelaySnapshot, after: RelaySnapshot): string[] {
  const pins: string[] = SCALAR_FIELDS.filter((field) => after[field] !== before[field]);
  for (const field of LIST_FIELDS) {
    for (const item of after[field]) if (!before[field].some((old) => sameText(old, item))) pins.push(itemPinKey(field, item));
  }
  return pins;
}

/** Pins after a reviewed save: "Edit & pin" pins the edited text; accepting a model value over a pinned field releases that pin. */
export function pinsAfterReview(
  pins: readonly string[],
  diff: CheckpointDiffItem[],
  acceptedKeys: Set<string>,
  editedItems: Record<string, string>,
  after: RelaySnapshot,
): string[] {
  const next = new Set(pins);
  for (const item of diff) {
    if (!acceptedKeys.has(item.key)) continue;
    const edited = cleanEdit(editedItems[item.key]);
    if (isListField(item.field)) {
      if (edited && item.kind !== "removed") next.add(itemPinKey(item.field, edited));
    } else if (edited) next.add(item.field);
    else next.delete(item.field);
  }
  return normalizePins([...next], after);
}

function findListItem(items: string[], text: string) {
  if (!text.trim()) return undefined;
  return items.find((item) => sameText(item, text)) ?? items.find((item) => nearDuplicateFact(item, text));
}

function replaceItem(items: string[], from: string, to: string) {
  const index = items.findIndex((item) => sameText(item, from));
  const replaced = index < 0 ? [...items, to] : items.map((item, position) => (position === index ? to : item));
  return replaced.filter((item, position) => replaced.findIndex((other) => sameText(other, item)) === position);
}

function factTokens(value: string) {
  const stopWords = new Set([
    "a", "an", "and", "are", "be", "been", "being", "decide", "decided", "for", "has", "have",
    "is", "it", "must", "need", "needs", "of", "on", "our", "project", "required", "requires",
    "should", "the", "this", "to", "use", "used", "uses", "using", "we", "will",
  ]);
  return new Set(value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/).filter((token) => token && !stopWords.has(token)));
}

function nearDuplicateFact(left: string, right: string) {
  const a = factTokens(left);
  const b = factTokens(right);
  if (!a.size || !b.size) return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(a.size, b.size) >= 0.8;
}

function additionPriority(field: string, value: string) {
  if (field === "constraints" && /\b(must|never|cannot|can't|only|under|limit|required|without)\b/i.test(value)) return 5;
  if (field === "completed" && /\b(done|complete|completed|built|implemented|finished|fixed|shipped|tested)\b/i.test(value)) return 4;
  if (field === "decisions") return 3;
  if (field === "constraints") return 2;
  return 1;
}

export function checkpointFieldLabel(field: string) {
  const labels: Record<string, string> = {
    objective: "Goal",
    currentTask: "Current task",
    nextAction: "Next step",
    decisions: "Decision",
    constraints: "Constraint",
    completed: "Completed work",
    openQuestions: "Open question",
    doNotRepeat: "Do not repeat",
    artifacts: "Artifact",
    sources: "Source",
  };
  return labels[field] ?? field.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase());
}

export function diffCheckpoint(
  current: RelaySnapshot,
  patch: CheckpointPatch,
  pinnedFields: string[] = [],
): CheckpointDiffItem[] {
  const diff: CheckpointDiffItem[] = [];
  const additions = [
    ...patch.decisions_add.map((value) => ({ field: "decisions", value })),
    ...patch.done_add.map((value) => ({ field: "completed", value })),
    ...patch.open_questions_add.map((value) => ({ field: "openQuestions", value })),
    ...patch.constraints_add.map((value) => ({ field: "constraints", value })),
  ];
  const selectedAdditions: typeof additions = [];
  for (const candidate of additions) {
    const duplicateIndex = selectedAdditions.findIndex((existing) => nearDuplicateFact(existing.value, candidate.value));
    if (duplicateIndex < 0) selectedAdditions.push(candidate);
    else if (additionPriority(candidate.field, candidate.value) > additionPriority(selectedAdditions[duplicateIndex].field, selectedAdditions[duplicateIndex].value)) selectedAdditions[duplicateIndex] = candidate;
  }
  // Additions never overwrite anything, so they stay pre-selected even beside pinned items.
  for (const { field, value } of selectedAdditions) {
    if (isListField(field) && !current[field].some((item) => sameText(item, value))) {
      diff.push({ key: additionKey(field, value), kind: "added", field, text: value, autoApplicable: true });
    }
  }
  const seen = new Set(diff.map((item) => item.key));
  for (const change of patch.changes) {
    const field = change.field === "next_step" ? "nextAction" : change.field;
    if (!change.to) continue;
    if (isListField(field)) {
      // A list change replaces the one item it names, never the whole list.
      const target = findListItem(current[field], change.from);
      if (target ? sameText(target, change.to) : current[field].some((item) => sameText(item, change.to))) continue;
      const key = target ? `change:${field}:${hashKey(target.toLocaleLowerCase())}` : additionKey(field, change.to);
      if (seen.has(key)) continue;
      seen.add(key);
      // With no matching item there is nothing to replace, so the value is offered as an unselected new item.
      diff.push(target
        ? { key, kind: "changed", field, text: checkpointFieldLabel(field), from: target, to: change.to, autoApplicable: false, sourceExcerpt: change.source_excerpt, pinned: isPinned(pinnedFields, field, target) }
        : { key, kind: "added", field, text: change.to, autoApplicable: false, contradiction: Boolean(change.from), sourceExcerpt: change.source_excerpt });
      continue;
    }
    const key = `change:${field}`;
    const actual = String(current[field as ScalarField] ?? "");
    if (seen.has(key) || change.to === actual) continue;
    seen.add(key);
    diff.push({ key, kind: "changed", field, text: checkpointFieldLabel(field), from: actual, to: change.to, autoApplicable: false, contradiction: Boolean(change.from && actual !== change.from), sourceExcerpt: change.source_excerpt, pinned: pinnedFields.includes(field) });
  }
  // A source-backed replacement in changes[] wins over next_step so one field never renders twice.
  if (patch.next_step && patch.next_step !== current.nextAction && !seen.has("change:nextAction")) {
    diff.push({ key: "change:nextAction", kind: "changed", field: "nextAction", text: checkpointFieldLabel("nextAction"), from: current.nextAction, to: patch.next_step, autoApplicable: false, pinned: pinnedFields.includes("nextAction") });
  }
  for (const value of patch.open_questions_resolve) {
    const target = current.openQuestions.find((item) => sameText(item, value));
    if (target) diff.push({ key: resolveKey(value), kind: "removed", field: "openQuestions", text: target, autoApplicable: false, pinned: isPinned(pinnedFields, "openQuestions", target) });
  }
  return diff;
}

function addUnique(items: string[], additions: string[]) {
  const result = [...items];
  for (const item of additions) {
    if (!result.some((existing) => existing.toLocaleLowerCase() === item.toLocaleLowerCase())) result.push(item);
  }
  return result.slice(0, 30);
}

export function applyCheckpointPatch(
  current: RelaySnapshot,
  patch: CheckpointPatch,
  acceptedKeys: Set<string>,
  pinnedFields: string[] = [],
  editedItems: Record<string, string> = {},
): RelaySnapshot {
  const diff = diffCheckpoint(current, patch, pinnedFields);
  const next: RelaySnapshot = { ...current };
  // An accepted item is always applied, pinned or not: pins stop automatic changes, not the user's own choice.
  for (const item of diff) {
    if (!acceptedKeys.has(item.key)) continue;
    const value = cleanEdit(editedItems[item.key]) || (item.kind === "changed" ? item.to ?? "" : item.text);
    if (!isListField(item.field)) {
      if (item.kind === "changed" && value) next[item.field as ScalarField] = value;
    } else if (item.kind === "added") next[item.field] = addUnique(next[item.field], [value]);
    else if (item.kind === "changed" && item.from && value) next[item.field] = replaceItem(next[item.field], item.from, value);
    else if (item.kind === "removed") next[item.field] = next[item.field].filter((existing) => !sameText(existing, item.text));
  }
  return next;
}

export function compressCheckpointPatch(patch: CheckpointPatch, tokenBudget = DEFAULT_CHECKPOINT_TOKEN_BUDGET): CheckpointPatch {
  const normalized = validateCheckpointPatch(patch);
  if (!normalized.ok) return { decisions_add: [], done_add: [], open_questions_add: [], open_questions_resolve: [], constraints_add: [], next_step: "", changes: [] };
  let output = normalized.patch;
  const limit = Math.max(600, tokenBudget * 4);
  const estimate = () => JSON.stringify(output).length;
  while (estimate() > limit && (output.changes.length || output.open_questions_add.length || output.done_add.length || output.decisions_add.length || output.constraints_add.length)) {
    if (output.changes.length) output = { ...output, changes: output.changes.slice(0, -1) };
    else if (output.open_questions_add.length) output = { ...output, open_questions_add: output.open_questions_add.slice(0, -1) };
    else if (output.done_add.length) output = { ...output, done_add: output.done_add.slice(0, -1) };
    else if (output.decisions_add.length) output = { ...output, decisions_add: output.decisions_add.slice(0, -1) };
    else output = { ...output, constraints_add: output.constraints_add.slice(0, -1) };
  }
  return output;
}

export function estimatePatchTokens(patch: CheckpointPatch) {
  return Math.ceil(JSON.stringify(patch).length / 4);
}

/** Budget the resulting capsule, not merely the incoming patch. Pinned fields survive intact. */
export function capsuleBudgetRemovals(before: RelaySnapshot, after: RelaySnapshot): CheckpointDiffItem[] {
  return LIST_FIELDS.flatMap((field) => before[field].filter((item)=>!after[field].includes(item)).map((text)=>({key:`budget:${field}:${hashKey(text)}`,kind:"removed" as const,field,text:`${text} (trimmed to fit capsule budget)`,autoApplicable:false})));
}

export function fitCapsuleBudget(state: RelaySnapshot, pinned: readonly string[], budget = 1500): RelaySnapshot {
  const next = structuredClone(state);
  const size = () => Math.ceil(JSON.stringify(next).length / 4);
  // Oldest unpinned items go first; pinned items are skipped, never trimmed.
  for (const field of LIST_FIELDS) {
    let index = 0;
    while (size() > budget && index < next[field].length) {
      if (isPinned(pinned, field, next[field][index])) index += 1;
      else next[field].splice(index, 1);
    }
  }
  if (size() > budget) throw new Error("Your pinned capsule exceeds the token budget. Unpin or shorten some items, or increase the budget, then save again.");
  return next;
}

export const PROJECT_INSTRUCTION = `After meaningful progress, output a complete update block using only explicit project facts, with no secrets. Keep next_step to one concrete action. Put replacements in changes; include a verbatim source_excerpt for each replacement. Never overwrite user-pinned facts. Use this exact format:\n<<<SOLVANE_UPDATE v1\n{"decisions_add":[],"done_add":[],"open_questions_add":[],"open_questions_resolve":[],"constraints_add":[],"next_step":"","changes":[]}\nSOLVANE_UPDATE>>>`;

export type CapsulePrivacy = { includeDecisions: boolean; includeConstraints: boolean; includeArtifacts: boolean; excludeCode: boolean };
export const DEFAULT_CAPSULE_PRIVACY: CapsulePrivacy = { includeDecisions: true, includeConstraints: true, includeArtifacts: true, excludeCode: false };

/** The one handoff text that the dashboard, the extension and handoff.md all send, with the person's privacy choices applied. */
export function buildCapsulePrompt(input: { projectName?: string; state: RelaySnapshot; privacy?: Partial<CapsulePrivacy> | null }): string {
  const privacy = { ...DEFAULT_CAPSULE_PRIVACY, ...(input.privacy ?? {}) };
  const { state } = input;
  const clean = (value: string) => (privacy.excludeCode ? value.replace(/```[\s\S]*?```/g, "[code intentionally excluded]") : value);
  const section = (title: string, items: string[]) => (items.length ? [`${title}:\n${items.map((item) => `- ${clean(item)}`).join("\n")}`] : []);
  return [
    "SOLVANE CONTINUITY CAPSULE",
    ...(input.projectName ? [`Project: ${input.projectName}`] : []),
    `Objective: ${clean(state.objective)}`,
    `Current task: ${clean(state.currentTask)}`,
    ...(privacy.includeDecisions ? section("Decisions", state.decisions) : []),
    ...(privacy.includeConstraints ? section("Constraints", state.constraints) : []),
    ...section("Completed", state.completed),
    ...section("Open questions", state.openQuestions),
    ...section("Do not repeat", state.doNotRepeat),
    ...(privacy.includeArtifacts ? [...section("Artifacts", state.artifacts), ...section("Sources", state.sources)] : []),
    `NEXT STEP: ${clean(state.nextAction)}`,
    "Continue from this state. Do not claim access to hidden reasoning or missing chat history. Ask only for information that truly blocks the next step.",
    "First restate the goal, current task and next step to confirm understanding, then continue.",
    PROJECT_INSTRUCTION,
  ].join("\n\n");
}

export const CHECKPOINT_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add", "next_step", "changes"],
  properties: Object.fromEntries([
    ...["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add"].map((key) => [key, { type: "array", items: { type: "string" }, maxItems: 10 }]),
    ["next_step", { type: "string" }],
    ["changes", { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["field", "from", "to", "source_excerpt"], properties: { field: { type: "string", enum: [...VALID_FIELDS] }, from: { type: "string" }, to: { type: "string" }, source_excerpt: { type: "string" } } } }],
  ]),
};
