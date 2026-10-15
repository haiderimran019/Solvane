import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, folders, messages, snapshots } from "../../../db/schema";
import { callProvider } from "../../../lib/providers";
import {
  EMPTY_SNAPSHOT,
  normalizeSnapshot,
  type RelaySnapshot,
} from "../../../lib/product";
import { apiUser, resolveProviderCredential, unauthorized } from "../../../lib/server";
import {extractCheckpoint} from "../../../lib/checkpoint-engine";
import {reserveCheckpoint} from "../../../lib/checkpoint-limits";
import {redactSecrets,diffCheckpoint,applyCheckpointPatch,normalizePins,pinsForManualEdit} from "../../../lib/checkpoint";
import {env} from "cloudflare:workers";
import { extensionOptions, withExtensionCors } from "../../../lib/extension-cors";

type SnapshotPayload = {
  folderId?: string;
  /** A full capsule from the editor ("edit") or, from older clients, an Undo. */
  state?: Partial<RelaySnapshot>;
  reason?: string;
  /** The state the editor started from, so only the person's own changes get pinned. */
  editedFrom?: Partial<RelaySnapshot>;
  /** Copy an earlier version (0 = the empty capsule) into a new version, with that version's pins. */
  restoreVersion?: number;
  /** Replace the pins on the latest version; `version` must still be the latest. */
  pins?: unknown;
  version?: number;
};

export function OPTIONS(request: Request) {
  return extensionOptions(request);
}

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 30)
    : [];
}

function cleanState(value: Partial<RelaySnapshot>): RelaySnapshot {
  return normalizeSnapshot({
    objective: String(value.objective ?? "").trim().slice(0, 300),
    currentTask: String(value.currentTask ?? "").trim().slice(0, 300),
    constraints: cleanList(value.constraints),
    decisions: cleanList(value.decisions),
    completed: cleanList(value.completed),
    openQuestions: cleanList(value.openQuestions),
    nextAction: String(value.nextAction ?? "").trim().slice(0, 300),
    doNotRepeat: cleanList(value.doNotRepeat),
    artifacts: cleanList(value.artifacts),
    sources: cleanList(value.sources),
  });
}

function deterministicSnapshot(
  rows: Array<{ role: "user" | "assistant"; content: string }>,
  previous?: RelaySnapshot,
): RelaySnapshot {
  const userMessages = rows.filter((row) => row.role === "user");
  const first = userMessages[0]?.content ?? "Continue this project.";
  const latest = userMessages.at(-1)?.content ?? first;
  return {
    objective: previous?.objective && previous !== EMPTY_SNAPSHOT ? previous.objective : first.slice(0, 300),
    currentTask: latest.slice(0, 300),
    constraints: previous?.constraints ?? [],
    decisions: previous?.decisions ?? [],
    completed: previous?.completed ?? [],
    openQuestions: previous?.openQuestions ?? [],
    nextAction: "Continue from the latest user request and assistant response.",
    doNotRepeat: previous?.doNotRepeat ?? [],
    artifacts: previous?.artifacts ?? [],
    sources: previous?.sources ?? [],
  };
}

function storedPins(row: { pinnedFields: string | null } | undefined, state: RelaySnapshot): string[] {
  try {
    return normalizePins(JSON.parse(row?.pinnedFields || "[]"), state);
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return withExtensionCors(unauthorized(), request);
  const folderId = new URL(request.url).searchParams.get("folderId")?.trim();
  if (!folderId) return withExtensionCors(Response.json({ error: "folderId is required." }, { status: 400 }), request);

  const rows = await getDb()
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, user.userId)))
    .orderBy(desc(snapshots.version))
    .limit(12);

  return withExtensionCors(Response.json({
    snapshots: rows.map((row) => {
      const state = normalizeSnapshot(JSON.parse(row.state) as Partial<RelaySnapshot>);
      return {
        version: row.version,
        state,
        createdAt: row.createdAt,
        sourceMessageCount: row.sourceMessageCount,
        schemaVersion: row.schemaVersion,
        pinnedFields: storedPins(row, state),
      };
    }),
  }), request);
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return withExtensionCors(unauthorized(), request);
  let payload: SnapshotPayload;
  try { payload = (await request.json()) as SnapshotPayload; } catch { return withExtensionCors(Response.json({ error: "Couldn't read that request." }, { status: 400 }), request); }
  const folderId = payload?.folderId?.trim();
  if (!folderId) return withExtensionCors(Response.json({ error: "folderId is required." }, { status: 400 }), request);

  const db = getDb();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.userId)))
    .limit(1);
  if (!folder) return withExtensionCors(Response.json({ error: "Folder not found." }, { status: 404 }), request);

  const rows = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.folderId, folderId), eq(messages.userId, user.userId)))
    .orderBy(desc(messages.createdAt))
    .limit(24);
  rows.reverse();
  const [prior] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, user.userId)))
    .orderBy(desc(snapshots.version))
    .limit(1);
  const previous = prior
    ? normalizeSnapshot(JSON.parse(prior.state) as Partial<RelaySnapshot>)
    : undefined;
  let state: RelaySnapshot | null = null;
  let reducedBy = "deterministic";
  let pinnedFields = previous ? storedPins(prior, previous) : [];
  let restoredFrom: number | null = null;

  if (payload.pins !== undefined) {
    // Pins are metadata on the latest version, so changing them does not create a new version.
    if (!prior || !previous) return withExtensionCors(Response.json({ error: "Save the capsule before pinning items." }, { status: 409 }), request);
    if (payload.version !== prior.version) return withExtensionCors(Response.json({ error: "The capsule changed. Reload it and try again." }, { status: 409 }), request);
    const pins = normalizePins(payload.pins, previous);
    const now = new Date().toISOString();
    await db.batch([
      db.update(snapshots).set({ pinnedFields: JSON.stringify(pins) }).where(and(eq(snapshots.id, prior.id), eq(snapshots.userId, user.userId))),
      db.insert(events).values({ id: crypto.randomUUID(), folderId, userId: user.userId, type: "snapshot.pins.updated", data: JSON.stringify({ version: prior.version, pinned: pins.length }), createdAt: now }),
    ]);
    return withExtensionCors(Response.json({ snapshot: { version: prior.version, state: previous, createdAt: prior.createdAt, schemaVersion: prior.schemaVersion, pinnedFields: pins } }), request);
  }

  if (typeof payload.restoreVersion === "number") {
    restoredFrom = payload.restoreVersion;
    if (restoredFrom === 0) {
      state = normalizeSnapshot(EMPTY_SNAPSHOT);
      pinnedFields = [];
    } else {
      const [target] = await db
        .select()
        .from(snapshots)
        .where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, user.userId), eq(snapshots.version, restoredFrom)))
        .limit(1);
      if (!target) return withExtensionCors(Response.json({ error: "That version no longer exists." }, { status: 404 }), request);
      state = normalizeSnapshot(JSON.parse(target.state) as Partial<RelaySnapshot>);
      pinnedFields = storedPins(target, state);
    }
    reducedBy = "restore";
  } else if (payload.state) {
    state = cleanState(payload.state);
    if (payload.reason === "edit") {
      const base = payload.editedFrom ? cleanState(payload.editedFrom) : previous ?? normalizeSnapshot(EMPTY_SNAPSHOT);
      pinnedFields = normalizePins([...pinnedFields, ...pinsForManualEdit(base, state)], state);
      reducedBy = "user";
    } else {
      // Older clients send Undo as a bare state. Restoring is not a manual edit, so it pins nothing new.
      pinnedFields = normalizePins(pinnedFields, state);
      reducedBy = "restore";
    }
  }

  if (!state) {
    const credential=await resolveProviderCredential(user.userId,"gemini");
    if(credential)try {
      const text=redactSecrets(rows.map((row)=>row.role+": "+row.content).join("\n\n").slice(-30000)).text;
      await reserveCheckpoint(user.userId,folderId,text.length+JSON.stringify(previous||EMPTY_SNAPSHOT).length,credential.source==="platform",request);
      const config=env as unknown as Record<string,string>;
      const patch=await extractCheckpoint({text,current:previous||EMPTY_SNAPSHOT,budget:Number(config.CHECKPOINT_TOKEN_BUDGET||1500),timeoutMs:Number(config.CHECKPOINT_TIMEOUT_MS||8500),generate:async(args)=>(await callProvider({provider:"gemini",apiKey:credential.apiKey,model:config.CHECKPOINT_GEMINI_MODEL||credential.model,system:args.system,messages:[{role:"user",content:args.content}],responseSchema:args.schema,maxTokens:2000,timeoutMs:args.timeoutMs})).text});
      // The automatic draft never touches pinned items; the person reviews it before saving.
      const keys=new Set(diffCheckpoint(previous||EMPTY_SNAPSHOT,patch,pinnedFields).filter((item)=>!item.pinned).map((item)=>item.key));
      state=applyCheckpointPatch(previous||EMPTY_SNAPSHOT,patch,keys,pinnedFields);reducedBy="gemini";
    }catch { reducedBy="deterministic"; }
  }
  if (!payload.state && restoredFrom === null) {
    state ??= deterministicSnapshot(rows, previous);
    // Automatic reduction is a draft. Review is required before it becomes handoff state.
    for (const field of ["objective", "currentTask", "nextAction"] as const) if (previous && pinnedFields.includes(field)) state[field] = previous[field];
    return withExtensionCors(Response.json({snapshot:{version:prior?.version ?? 0,state,createdAt:prior?.createdAt ?? null,pinnedFields},draft:true,reducedBy}),request);
  }
  if (!state) return withExtensionCors(Response.json({ error: "Nothing to save." }, { status: 400 }), request);
  const version = (prior?.version ?? 0) + 1;
  const createdAt = new Date().toISOString();
  try {
    await db.batch([
      db.insert(snapshots).values({
        id: crypto.randomUUID(),
        folderId,
        userId: user.userId,
        version,
        schemaVersion: 1,
        state: JSON.stringify(state),
        pinnedFields: JSON.stringify(pinnedFields),
        sourceHash: null,
        sourceMessageCount: rows.length,
        createdAt,
      }),
      db.insert(events).values({
        id: crypto.randomUUID(),
        folderId,
        userId: user.userId,
        type: reducedBy === "user" ? "snapshot.corrected" : "snapshot.restored",
        data: JSON.stringify({ version, reducedBy, restoredFrom, sourceMessageCount: rows.length }),
        createdAt,
      }),
    ]);
  } catch {
    return withExtensionCors(Response.json({ error: "Another save arrived at the same time. Reload and try again." }, { status: 409 }), request);
  }
  return withExtensionCors(Response.json({ snapshot: { version, state, createdAt, schemaVersion: 1, pinnedFields }, reducedBy }), request);
}
