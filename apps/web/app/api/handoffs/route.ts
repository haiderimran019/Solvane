import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, folders } from "../../../db/schema";
import { isProviderId } from "../../../lib/product";
import { apiUser, unauthorized } from "../../../lib/server";

type HandoffData = {
  target: string;
  mode: "browser" | "api" | "code";
  snapshotVersion: number;
};

export async function GET(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const folderId = new URL(request.url).searchParams.get("folderId")?.trim();
  if (!folderId) return Response.json({ error: "folderId is required." }, { status: 400 });

  const rows = await getDb()
    .select()
    .from(events)
    .where(
      and(
        eq(events.folderId, folderId),
        eq(events.userId, user.userId),
        eq(events.type, "handoff.launched"),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(12);

  return Response.json({
    handoffs: rows.map((row) => ({
      id: row.id,
      ...(JSON.parse(row.data) as HandoffData),
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const payload = (await request.json()) as {
    folderId?: string;
    target?: unknown;
    mode?: unknown;
    snapshotVersion?: number;
  };
  const folderId = payload.folderId?.trim();
  if (!folderId || !isProviderId(payload.target)) {
    return Response.json({ error: "A valid folder and target provider are required." }, { status: 400 });
  }
  const mode = payload.mode === "api" || payload.mode === "code" ? payload.mode : "browser";
  const db = getDb();
  const [folder] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.userId)))
    .limit(1);
  if (!folder) return Response.json({ error: "Folder not found." }, { status: 404 });

  const record = {
    id: crypto.randomUUID(),
    folderId,
    userId: user.userId,
    type: "handoff.launched",
    data: JSON.stringify({
      target: payload.target,
      mode,
      snapshotVersion: Math.max(0, Number(payload.snapshotVersion) || 0),
    }),
    createdAt: new Date().toISOString(),
  };
  await db.insert(events).values(record);
  return Response.json({
    handoff: {
      id: record.id,
      target: payload.target,
      mode,
      snapshotVersion: Math.max(0, Number(payload.snapshotVersion) || 0),
      createdAt: record.createdAt,
    },
  });
}
