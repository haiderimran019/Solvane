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

export function diffCheckpoint(
  current: RelaySnapshot,
  patch: CheckpointPatch,
  pinnedFields: string[] = [],
): CheckpointDiffItem[] {
  const diff: CheckpointDiffItem[] = [];
  const add = (field: string, value: string) => {
    const currentItems = current[field as keyof RelaySnapshot];
    const values = Array.isArray(currentItems) ? currentItems : [];
    if (!values.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      diff.push({ key: additionKey(field, value), kind: "added", field, text: value, autoApplicable: !pinnedFields.includes(field), pinned: pinnedFields.includes(field) });
    }
  };
  for (const value of patch.decisions_add) add("decisions", value);
  for (const value of patch.done_add) add("completed", value);
  for (const value of patch.open_questions_add) add("openQuestions", value);
  for (const value of patch.constraints_add) add("constraints", value);
  if (patch.next_step && patch.next_step !== current.nextAction) {
    diff.push({ key: "change:nextAction:next_step", kind: "changed", field: "nextAction", text: "Next step", from: current.nextAction, to: patch.next_step, autoApplicable: false, contradiction: Boolean(current.nextAction && current.nextAction !== patch.next_step && pinnedFields.includes("nextAction")) });
  }
  patch.changes.forEach((change, index) => {
    const field = change.field === "next_step" ? "nextAction" : change.field;
    const currentValue = current[field as keyof RelaySnapshot];
    const actual = Array.isArray(currentValue) ? currentValue.join(", ") : String(currentValue ?? "");
    if (change.to && change.to !== actual) {
      diff.push({ key: `change:${index}:${field}`, kind: "changed", field, text: field, from: change.from || actual, to: change.to, autoApplicable: false, contradiction: Boolean(change.from && actual !== change.from), sourceExcerpt: change.source_excerpt, pinned: pinnedFields.includes(field) });
    }
  });
  for (const value of patch.open_questions_resolve) {
    if (current.openQuestions.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) {
      diff.push({ key: resolveKey(value), kind: "removed", field: "openQuestions", text: value, autoApplicable: false });
    }
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
  for (const item of diff) {
    if (!acceptedKeys.has(item.key) || pinnedFields.includes(item.field)) continue;
    const edited = typeof editedItems[item.key] === "string" ? redactSecrets(editedItems[item.key]).text.trim().slice(0, 300) : undefined;
    if (item.kind === "added") {
      const field = item.field as "decisions" | "completed" | "constraints" | "openQuestions";
      next[field] = addUnique(next[field], [edited || item.text]);
      continue;
    }
    if (item.kind === "removed" && item.field === "openQuestions") {
      next.openQuestions = next.openQuestions.filter((value) => value.toLocaleLowerCase() !== item.text.toLocaleLowerCase());
      continue;
    }
    if (item.kind !== "changed" || !item.to || pinnedFields.includes(item.field)) continue;
    if (item.field === "objective" || item.field === "currentTask" || item.field === "nextAction") {
      next[item.field] = edited || item.to;
    } else if (Array.isArray(next[item.field as keyof RelaySnapshot])) {
      next[item.field as "constraints" | "decisions" | "completed" | "openQuestions" | "doNotRepeat" | "artifacts" | "sources"] = (edited || item.to).split(",").map((value) => value.trim()).filter(Boolean);
    }
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
  return (["completed","doNotRepeat","openQuestions","artifacts","sources","decisions","constraints"] as const).flatMap((field) => before[field].filter((item)=>!after[field].includes(item)).map((text)=>({key:`budget:${field}:${hashKey(text)}`,kind:"removed" as const,field,text:`${text} (trimmed to fit capsule budget)`,autoApplicable:false})));
}

export function fitCapsuleBudget(state: RelaySnapshot, pinned: string[], budget = 1500): RelaySnapshot {
  const next = structuredClone(state);
  const size = () => Math.ceil(JSON.stringify(next).length / 4);
  for (const field of ["completed", "doNotRepeat", "openQuestions", "artifacts", "sources", "decisions", "constraints"] as const) {
    if (pinned.includes(field)) continue;
    while (size() > budget && next[field].length) next[field].shift();
  }
  if (size() > budget) throw new Error("Your pinned capsule exceeds the token budget. Shorten it manually or increase the budget, then save again.");
  return next;
}

export const PROJECT_INSTRUCTION = `After meaningful progress, output a complete update block using only explicit project facts, with no secrets. Keep next_step to one concrete action. Put replacements in changes; include a verbatim source_excerpt for each replacement. Never overwrite user-pinned facts. Use this exact format:\n<<<SOLVANE_UPDATE v1\n{"decisions_add":[],"done_add":[],"open_questions_add":[],"open_questions_resolve":[],"constraints_add":[],"next_step":"","changes":[]}\nSOLVANE_UPDATE>>>`;

export const CHECKPOINT_RESPONSE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add", "next_step", "changes"],
  properties: Object.fromEntries([
    ...["decisions_add", "done_add", "open_questions_add", "open_questions_resolve", "constraints_add"].map((key) => [key, { type: "array", items: { type: "string" }, maxItems: 10 }]),
    ["next_step", { type: "string" }],
    ["changes", { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["field", "from", "to", "source_excerpt"], properties: { field: { type: "string", enum: [...VALID_FIELDS] }, from: { type: "string" }, to: { type: "string" }, source_excerpt: { type: "string" } } } }],
  ]),
};
