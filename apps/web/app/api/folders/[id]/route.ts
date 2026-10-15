import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { events, folders, messages, snapshots } from "../../../../db/schema";
import {
  EMPTY_SNAPSHOT,
  PROVIDER_IDS,
  isProviderId,
  normalizeSnapshot,
  parseProviderOrder,
  type RelaySnapshot,
} from "../../../../lib/product";
import { apiUser, unauthorized } from "../../../../lib/server";
import { normalizePins } from "../../../../lib/checkpoint";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const db = getDb();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.userId)))
    .limit(1);
  if (!folder) return Response.json({ error: "Folder not found." }, { status: 404 });

  const messageRows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.folderId, id), eq(messages.userId, user.userId)))
    .orderBy(asc(messages.createdAt))
    .limit(120);
  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.folderId, id), eq(snapshots.userId, user.userId)))
    .orderBy(desc(snapshots.version))
    .limit(1);

  return Response.json({
    folder: {
      id: folder.id,
      name: folder.name,
      description: folder.description,
      providerOrder: parseProviderOrder(folder.providerOrder),
      autoFallback: folder.autoFallback,
      updatedAt: folder.updatedAt,
    },
    messages: messageRows.map((message) => ({
      ...message,
      citations: JSON.parse(message.citations || "[]"),
    })),
    snapshot: snapshot
      ? (() => {
          const state = normalizeSnapshot(JSON.parse(snapshot.state) as Partial<RelaySnapshot>);
          let pins: unknown = [];
          try { pins = JSON.parse(snapshot.pinnedFields || "[]"); } catch { pins = []; }
          return { version: snapshot.version, state, createdAt: snapshot.createdAt, schemaVersion: snapshot.schemaVersion, pinnedFields: normalizePins(pins, state) };
        })()
      : { version: 0, state: EMPTY_SNAPSHOT, createdAt: null, pinnedFields: [] },
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const payload = (await request.json()) as {
    name?: string;
    description?: string;
    providerOrder?: unknown[];
    autoFallback?: boolean;
  };
  const db = getDb();
  const [existing] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.userId, user.userId)))
    .limit(1);
  if (!existing) return Response.json({ error: "Folder not found." }, { status: 404 });

  const providerOrder = payload.providerOrder
    ? payload.providerOrder.filter(isProviderId)
    : parseProviderOrder(existing.providerOrder);
  if (providerOrder.length !== PROVIDER_IDS.length || new Set(providerOrder).size !== PROVIDER_IDS.length) {
    return Response.json({ error: "Provider order must include all four providers." }, { status: 400 });
  }
  const now = new Date().toISOString();
  await db.update(folders).set({
    name: payload.name?.trim().slice(0, 80) || existing.name,
    description:
      typeof payload.description === "string"
        ? payload.description.trim().slice(0, 240)
        : existing.description,
    providerOrder: JSON.stringify(providerOrder),
    autoFallback:
      typeof payload.autoFallback === "boolean"
        ? payload.autoFallback
        : existing.autoFallback,
    updatedAt: now,
  }).where(and(eq(folders.id, id), eq(folders.userId, user.userId)));

  await db.insert(events).values({
    id: crypto.randomUUID(),
    folderId: id,
    userId: user.userId,
    type: "folder.settings.updated",
    data: JSON.stringify({ providerOrder, autoFallback: payload.autoFallback }),
    createdAt: now,
  });
  return Response.json({ ok: true, updatedAt: now });
}

export async function DELETE(_: Request, context: RouteContext) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const result = await getDb()
    .update(folders)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(folders.id, id), eq(folders.userId, user.userId)))
    .returning({ id: folders.id });
  if (!result.length) return Response.json({ error: "Folder not found." }, { status: 404 });
  return Response.json({ ok: true });
}
