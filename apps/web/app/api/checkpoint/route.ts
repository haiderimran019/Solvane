import { and, desc, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../db";
import { events, folders, snapshots } from "../../../db/schema";
import { callProvider, ProviderCallError } from "../../../lib/providers";
import {
  applyCheckpointPatch,
  fitCapsuleBudget,
  capsuleBudgetRemovals,
  DEFAULT_CHECKPOINT_TOKEN_BUDGET,
  diffCheckpoint,
  estimatePatchTokens,
  parseSolvaneUpdateBlock,
  redactSecrets,
  validateCheckpointPatch,
  type CheckpointPatch,
} from "../../../lib/checkpoint";
import { reserveCheckpoint } from "../../../lib/checkpoint-limits";
import { extractCheckpoint, CheckpointReadError } from "../../../lib/checkpoint-engine";
import { EMPTY_SNAPSHOT, normalizeSnapshot, type RelaySnapshot } from "../../../lib/product";
import { apiUser, resolveProviderCredential, unauthorized } from "../../../lib/server";
import { extensionOptions, withExtensionCors } from "../../../lib/extension-cors";

type CheckpointPayload = {
  folderId?: string;
  text?: string;
  mode?: "preview" | "commit";
  patch?: unknown;
  acceptedKeys?: unknown[];
  pinnedFields?: unknown[];
  checkpointHash?: string;
  baseVersion?: number;
  tokenBudget?: number;
  editedItems?: Record<string, string>;
};

export function OPTIONS(request: Request) {
  return extensionOptions(request);
}

function parsePinned(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 24) : [];
}

function parseAccepted(value: unknown): Set<string> {
  return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 80) : []);
}

function errorMessage(error: unknown) {
  if (error instanceof ProviderCallError) {
    if (error.status === 429) return "Gemini is rate-limited right now. Try again shortly or paste a SOLVANE_UPDATE block.";
    if (error.status === 0) return "Gemini did not respond within 10 seconds. Try again or paste a SOLVANE_UPDATE block.";
    return "Gemini could not process this checkpoint. Try again or edit the capsule manually.";
  }
  return error instanceof Error ? error.message : "Gemini could not process this checkpoint.";
}

async function latestSnapshot(folderId: string, userId: string) {
  const [row] = await getDb()
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, userId)))
    .orderBy(desc(snapshots.version))
    .limit(1);
  return row;
}

function snapshotState(row: typeof snapshots.$inferSelect | undefined): RelaySnapshot {
  return row ? normalizeSnapshot(JSON.parse(row.state) as Partial<RelaySnapshot>) : normalizeSnapshot(EMPTY_SNAPSHOT);
}

async function buildGeminiPatch(userId: string, folderId: string, current: RelaySnapshot, text: string, request: Request) {
  const credential = await resolveProviderCredential(userId, "gemini");
  if (!credential) {
    throw new Error("Gemini is not connected. Paste a SOLVANE_UPDATE block or connect Gemini in API mode.");
  }
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const budget = Math.max(300, Number(runtimeEnv.CHECKPOINT_TOKEN_BUDGET || DEFAULT_CHECKPOINT_TOKEN_BUDGET));
  await reserveCheckpoint(userId, folderId, text.length + JSON.stringify(current).length, credential.source === "platform", request);
  return extractCheckpoint({ text, current, budget, timeoutMs: Math.max(500, Number(runtimeEnv.CHECKPOINT_TIMEOUT_MS || 8500)), generate: async (args) => {
    const result = await callProvider({ provider: "gemini", apiKey: credential.apiKey, model: runtimeEnv.CHECKPOINT_GEMINI_MODEL || (credential.source === "platform" ? "gemini-2.5-flash-lite" : credential.model), system: args.system, messages: [{ role: "user", content: args.content }], responseSchema: args.schema, maxTokens: Number(runtimeEnv.CHECKPOINT_MAX_OUTPUT_TOKENS || 2000), timeoutMs: args.timeoutMs });
    return result.text;
  } });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return withExtensionCors(unauthorized(), request);
  let payload: CheckpointPayload;
  try {
    const reader=request.body?.getReader(),decoder=new TextDecoder();let body="",bytes=0;
    if(!reader)throw new Error();
    for(;;){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>140000){await reader.cancel();return withExtensionCors(Response.json({error:"That request is too large. Use a shorter excerpt."},{status:413}),request);}body+=decoder.decode(chunk.value,{stream:true});}
    body+=decoder.decode();payload=JSON.parse(body);if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error();
  } catch { return withExtensionCors(Response.json({error:"Couldn't read that request. Keep your paste and try again."},{status:400}),request); }
  const folderId = typeof payload.folderId === "string" ? payload.folderId.trim() : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const mode = payload.mode ?? "preview";
  if (!["preview","commit"].includes(mode)) return withExtensionCors(Response.json({error:"Choose preview or commit."},{status:400}),request);
  if (!folderId) return withExtensionCors(Response.json({ error: "Choose a project before saving a checkpoint." }, { status: 400 }), request);
  if (!text) return withExtensionCors(Response.json({ error: "Paste a recent chat or update block first." }, { status: 400 }), request);
  const runtimeEnv = env as unknown as Record<string, string | undefined>;
  const maxInputChars = Math.max(5_000, Number(runtimeEnv.CHECKPOINT_MAX_INPUT_CHARS || 40_000));
  if (text.length > maxInputChars) return withExtensionCors(Response.json({ error: `That paste is too large. Paste the most recent useful section (under ${maxInputChars.toLocaleString()} characters).` }, { status: 413 }), request);
  const db = getDb();
  const [folder] = await db.select().from(folders).where(and(eq(folders.id, folderId), eq(folders.userId, user.userId))).limit(1);
  if (!folder || folder.archived) return withExtensionCors(Response.json({ error: "Project not found." }, { status: 404 }), request);
  const currentRow = await latestSnapshot(folderId, user.userId);
  const current = snapshotState(currentRow);
  const redacted = redactSecrets(text);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(redacted.text))),(n)=>n.toString(16).padStart(2,"0")).join("");
  const block = parseSolvaneUpdateBlock(redacted.text);
  const budget = Math.min(Number(runtimeEnv.CHECKPOINT_TOKEN_BUDGET || 1500), Math.max(300, Number(payload.tokenBudget) || 1500));
  if (!block.ok && block.present) return withExtensionCors(Response.json({ error: block.error || "The SOLVANE_UPDATE block is invalid. Ask the model to output a fresh v1 block." }, { status: 400 }), request);

  let patch: CheckpointPatch;
  let source: "update_block" | "gemini" = "update_block";
  try {
    if (mode === "commit") {
      const reviewed = validateCheckpointPatch(payload.patch);
      if (!reviewed.ok) return withExtensionCors(Response.json({error:"The reviewed patch is invalid. Review again."},{status:400}),request);
      patch = reviewed.patch;
    } else patch = block.ok ? block.patch : await buildGeminiPatch(user.userId, folderId, current, redacted.text, request);
    if (!block.ok) source = "gemini";
  } catch (error) {
    const message = errorMessage(error);
    const status = message.includes("limit reached") || message.includes("budget reached") ? 429 : message.includes("not connected") ? 424 : 502;
    return withExtensionCors(Response.json({ error: message, ...(error instanceof CheckpointReadError ? { rawPatch: error.rawPatch } : {}) }, { status }), request);
  }

  let storedPinned: unknown = [];
  try { storedPinned = currentRow?.pinnedFields ? JSON.parse(currentRow.pinnedFields) : []; } catch { storedPinned = []; }
  const pinnedFields = parsePinned(storedPinned);
  const diff = diffCheckpoint(current, patch, pinnedFields);
  if (mode === "preview") {
    const defaults=new Set(diff.filter((item)=>item.autoApplicable).map((item)=>item.key));
    const uncompressed=applyCheckpointPatch(current,patch,defaults,pinnedFields);
    try {diff.push(...capsuleBudgetRemovals(uncompressed,fitCapsuleBudget(uncompressed,pinnedFields,budget)));}catch(error){return withExtensionCors(Response.json({error:(error as Error).message},{status:422}),request);}
    return withExtensionCors(Response.json({ checkpointHash: hash, baseVersion: currentRow?.version ?? 0, source, redactedCount: redacted.count, patch, diff, current, tokenEstimate: estimatePatchTokens(patch), pinnedFields }), request);
  }
  const validation = validateCheckpointPatch(payload.patch);
  if (!validation.ok) return withExtensionCors(Response.json({ error: "The reviewed checkpoint is no longer valid. Run Save checkpoint again." }, { status: 400 }), request);
  if (payload.checkpointHash && payload.checkpointHash !== hash) return withExtensionCors(Response.json({ error: "This checkpoint changed before saving. Run Save checkpoint again." }, { status: 409 }), request);
  const [existing] = await db.select().from(snapshots).where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, user.userId), eq(snapshots.sourceHash, hash))).limit(1);
  if (existing) return withExtensionCors(Response.json({ idempotent: true, snapshot: { version: existing.version, state: normalizeSnapshot(JSON.parse(existing.state) as Partial<RelaySnapshot>), createdAt: existing.createdAt }, previousState: current, source, redactedCount: redacted.count, diff }), request);
  if (payload.baseVersion !== undefined && payload.baseVersion !== (currentRow?.version ?? 0)) return withExtensionCors(Response.json({error:"The project changed on another device. Review this checkpoint again."},{status:409}),request);
  const acceptedKeys = parseAccepted(payload.acceptedKeys);
  let nextState: RelaySnapshot;
  try {
    const before=applyCheckpointPatch(current, validation.patch, acceptedKeys, pinnedFields, payload.editedItems);
    nextState=fitCapsuleBudget(before,pinnedFields,budget);
    if(capsuleBudgetRemovals(before,nextState).some((item)=>!acceptedKeys.has(item.key))) return withExtensionCors(Response.json({error:"Fitting this capsule requires removing old items. Accept the budget removals in the review, or shorten your edits and review again."},{status:422}),request);
  }
  catch (error) { return withExtensionCors(Response.json({error:(error as Error).message},{status:422}),request); }
  const version = (currentRow?.version ?? 0) + 1;
  const createdAt = new Date().toISOString();
  const nextPinnedFields = [...new Set([...pinnedFields, ...diff.filter((item) => acceptedKeys.has(item.key) && payload.editedItems?.[item.key]).map((item) => item.field)])];
  try { await db.batch([
    db.insert(snapshots).values({ id: crypto.randomUUID(), folderId, userId: user.userId, version, schemaVersion: 1, state: JSON.stringify(nextState), pinnedFields: JSON.stringify(nextPinnedFields), sourceHash: hash, sourceMessageCount: 0, createdAt }),
    db.insert(events).values({ id: crypto.randomUUID(), folderId, userId: user.userId, type: "checkpoint.saved", data: JSON.stringify({ version, source, hash, redactedCount: redacted.count, acceptedCount: acceptedKeys.size }), createdAt }),
    db.update(folders).set({ updatedAt: createdAt }).where(and(eq(folders.id, folderId), eq(folders.userId, user.userId))),
  ]);
  } catch { return withExtensionCors(Response.json({error:"Another save arrived at the same time. Review again; your text is still here."},{status:409}),request); }
  return withExtensionCors(Response.json({ idempotent: false, snapshot: { version, state: nextState, createdAt }, previousState: current, source, redactedCount: redacted.count, diff }), request);
}
