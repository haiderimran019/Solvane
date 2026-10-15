import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { events, folders, providerCredentials, usageEvents } from "../../../../db/schema";
import { apiUser, unauthorized } from "../../../../lib/server";

export async function DELETE() {
  const user = await apiUser();
  if (!user) return unauthorized();
  const db = getDb();
  await db.batch([
    db.delete(providerCredentials).where(eq(providerCredentials.userId, user.userId)),
    db.delete(usageEvents).where(eq(usageEvents.userId, user.userId)),
    db.delete(events).where(eq(events.userId, user.userId)),
    db.delete(folders).where(eq(folders.userId, user.userId)),
  ]);
  return Response.json({ deleted: true });
}
