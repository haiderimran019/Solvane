import { and, count, eq } from "drizzle-orm";
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

async function countOwned(
  table: typeof folders | typeof messages | typeof snapshots | typeof events | typeof providerCredentials | typeof usageEvents,
  userId: string,
) {
  const [row] = await getDb()
    .select({ value: count() })
    .from(table)
    .where(eq(table.userId, userId));
  return Number(row?.value ?? 0);
}

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();

  const [projectCount, messageCount, snapshotCount, handoffRows, connectionCount, analyticsEventCount] =
    await Promise.all([
      countOwned(folders, user.userId),
      countOwned(messages, user.userId),
      countOwned(snapshots, user.userId),
      getDb()
        .select({ value: count() })
        .from(events)
        .where(and(eq(events.userId, user.userId), eq(events.type, "handoff.launched"))),
      countOwned(providerCredentials, user.userId),
      countOwned(usageEvents, user.userId),
    ]);

  return Response.json({
    profile: {
      name: user.displayName,
      email: user.email,
      signInProvider: "ChatGPT",
    },
    counts: {
      projects: projectCount,
      messages: messageCount,
      capsuleVersions: snapshotCount,
      handoffs: Number(handoffRows[0]?.value ?? 0),
      apiConnections: connectionCount,
      analyticsEvents: analyticsEventCount,
    },
  });
}
