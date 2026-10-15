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
import {redactSecrets,diffCheckpoint,applyCheckpointPatch} from "../../../lib/checkpoint";
import {env} from "cloudflare:workers";
import { extensionOptions, withExtensionCors } from "../../../lib/extension-cors";

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

function parsePinnedFields(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]") as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string").slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

function changedSnapshotFields(previous: RelaySnapshot | undefined, next: RelaySnapshot): string[] {
  if (!previous) return [];
  const fields: Array<keyof RelaySnapshot> = ["objective", "currentTask", "constraints", "decisions", "completed", "openQuestions", "nextAction", "doNotRepeat", "artifacts", "sources"];
  return fields.filter((field) => JSON.stringify(previous[field]) !== JSON.stringify(next[field]));
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
    snapshots: rows.map((row) => ({
      version: row.version,
      state: normalizeSnapshot(JSON.parse(row.state) as Partial<RelaySnapshot>),
      createdAt: row.createdAt,
      sourceMessageCount: row.sourceMessageCount,
      schemaVersion: row.schemaVersion,
      pinnedFields: parsePinnedFields(row.pinnedFields),
    })),
  }), request);
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return withExtensionCors(unauthorized(), request);
  const payload = (await request.json()) as {
    folderId?: string;
    state?: Partial<RelaySnapshot>;
    pinnedFields?: unknown[];
  };
  const folderId = payload.folderId?.trim();
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
  let pinnedFields = parsePinnedFields(prior?.pinnedFields);

  if (payload.state) {
    state = normalizeSnapshot({
      objective: String(payload.state.objective ?? "").trim().slice(0, 300),
      currentTask: String(payload.state.currentTask ?? "").trim().slice(0, 300),
      constraints: cleanList(payload.state.constraints),
      decisions: cleanList(payload.state.decisions),
      completed: cleanList(payload.state.completed),
      openQuestions: cleanList(payload.state.openQuestions),
      nextAction: String(payload.state.nextAction ?? "").trim().slice(0, 300),
      doNotRepeat: cleanList(payload.state.doNotRepeat),
      artifacts: cleanList(payload.state.artifacts),
      sources: cleanList(payload.state.sources),
    });
    reducedBy = "user";
    const requestedPins = Array.isArray(payload.pinnedFields)
      ? payload.pinnedFields.filter((field): field is string => typeof field === "string")
      : [];
    pinnedFields = [...new Set([...pinnedFields, ...requestedPins, ...changedSnapshotFields(previous, state)])].slice(0, 24);
  }

  if (!state) {
    const credential=await resolveProviderCredential(user.userId,"gemini");
    if(credential)try {
      const text=redactSecrets(rows.map((row)=>row.role+": "+row.content).join("\n\n").slice(-30000)).text;
      await reserveCheckpoint(user.userId,folderId,text.length+JSON.stringify(previous||EMPTY_SNAPSHOT).length,credential.source==="platform",request);
      const config=env as unknown as Record<string,string>;
      const patch=await extractCheckpoint({text,current:previous||EMPTY_SNAPSHOT,budget:Number(config.CHECKPOINT_TOKEN_BUDGET||1500),timeoutMs:Number(config.CHECKPOINT_TIMEOUT_MS||8500),generate:async(args)=>(await callProvider({provider:"gemini",apiKey:credential.apiKey,model:config.CHECKPOINT_GEMINI_MODEL||credential.model,system:args.system,messages:[{role:"user",content:args.content}],responseSchema:args.schema,maxTokens:2000,timeoutMs:args.timeoutMs})).text});
      const keys=new Set(diffCheckpoint(previous||EMPTY_SNAPSHOT,patch,pinnedFields).map((item)=>item.key));
      state=applyCheckpointPatch(previous||EMPTY_SNAPSHOT,patch,keys,pinnedFields);reducedBy="gemini";
    }catch { reducedBy="deterministic"; }
  }
  state ??= deterministicSnapshot(rows, previous);
  if (!payload.state) {
    // Automatic reduction is a draft. Review is required before it becomes handoff state.
    for (const field of pinnedFields) if (previous && field in previous) (state as Record<string, unknown>)[field] = previous[field as keyof RelaySnapshot];
    return withExtensionCors(Response.json({snapshot:{version:prior?.version ?? 0,state,createdAt:prior?.createdAt ?? null,pinnedFields},draft:true,reducedBy}),request);
  }
  const version = (prior?.version ?? 0) + 1;
  const createdAt = new Date().toISOString();
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
      type: reducedBy === "user" ? "snapshot.corrected" : "snapshot.published",
      data: JSON.stringify({ version, reducedBy, sourceMessageCount: rows.length }),
      createdAt,
    }),
  ]);
  return withExtensionCors(Response.json({ snapshot: { version, state, createdAt, schemaVersion: 1, pinnedFields }, reducedBy }), request);
}
