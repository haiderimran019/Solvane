import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  events,
  folders,
  messages,
  providerCredentials,
  snapshots,
  usageEvents,
} from "../../../db/schema";
import { apiUser, unauthorized } from "../../../lib/server";

export const dynamic = "force-dynamic";

function removeUserId<T extends { userId: string }>(row: T): Omit<T, "userId"> {
  const copy = { ...row } as Partial<T>;
  delete copy.userId;
  return copy as Omit<T, "userId">;
}

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();

  const db = getDb();
  const [folderRows, messageRows, snapshotRows, eventRows, connectionRows, analyticsRows] =
    await Promise.all([
      db.select().from(folders).where(eq(folders.userId, user.userId)).orderBy(asc(folders.createdAt)),
      db.select().from(messages).where(eq(messages.userId, user.userId)).orderBy(asc(messages.createdAt)),
      db.select().from(snapshots).where(eq(snapshots.userId, user.userId)).orderBy(asc(snapshots.createdAt)),
      db.select().from(events).where(eq(events.userId, user.userId)).orderBy(asc(events.createdAt)),
      db
        .select({
          provider: providerCredentials.provider,
          model: providerCredentials.model,
          createdAt: providerCredentials.createdAt,
          updatedAt: providerCredentials.updatedAt,
        })
        .from(providerCredentials)
        .where(eq(providerCredentials.userId, user.userId)),
      db.select().from(usageEvents).where(eq(usageEvents.userId, user.userId)).orderBy(asc(usageEvents.createdAt)),
    ]);

  const exportedAt = new Date().toISOString();
  const body = JSON.stringify({
    exportVersion: 1,
    exportedAt,
    account: { name: user.displayName, email: user.email, signInProvider: "ChatGPT" },
    data: {
      projects: folderRows.map(removeUserId),
      messages: messageRows.map(removeUserId),
      capsuleVersions: snapshotRows.map(removeUserId),
      handoffEvents: eventRows.map(removeUserId),
      apiConnections: connectionRows,
      analyticsEvents: analyticsRows.map(removeUserId),
    },
    excluded: [
      "Provider API keys and encryption material are never included.",
      "AI-provider cookies, passwords, and hidden browser history are never collected.",
    ],
  }, null, 2);
  const date = exportedAt.slice(0, 10);

  return new Response(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="solvane-my-data-${date}.json"`,
      "cache-control": "private, no-store",
    },
  });
}
