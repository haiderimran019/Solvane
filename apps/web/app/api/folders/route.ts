import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, folders } from "../../../db/schema";
import { PROVIDER_IDS } from "../../../lib/product";
import { apiUser, unauthorized } from "../../../lib/server";

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();

  const payload = (await request.json()) as { name?: string; description?: string };
  const name = payload.name?.trim().slice(0, 80);
  if (!name) {
    return Response.json({ error: "Folder name is required." }, { status: 400 });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const folder = {
    id: crypto.randomUUID(),
    userId: user.userId,
    name,
    description: payload.description?.trim().slice(0, 240) ?? "",
    providerOrder: JSON.stringify(PROVIDER_IDS),
    autoFallback: true,
    createdAt: now,
    updatedAt: now,
  };
  await db.batch([
    db.insert(folders).values(folder),
    db.insert(events).values({
      id: crypto.randomUUID(),
      folderId: folder.id,
      userId: user.userId,
      type: "folder.created",
      data: JSON.stringify({ name }),
      createdAt: now,
    }),
  ]);

  return Response.json(
    {
      folder: {
        id: folder.id,
        name: folder.name,
        description: folder.description,
        providerOrder: PROVIDER_IDS,
        autoFallback: true,
        updatedAt: now,
      },
    },
    { status: 201 },
  );
}

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const rows = await getDb()
    .select()
    .from(folders)
    .where(eq(folders.userId, user.userId))
    .orderBy(desc(folders.updatedAt));
  return Response.json({ folders: rows });
}
