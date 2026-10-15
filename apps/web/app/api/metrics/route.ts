import { env } from "cloudflare:workers";
import { count, gte } from "drizzle-orm";
import { getDb } from "../../../db";
import { usageEvents } from "../../../db/schema";
import { apiUser } from "../../../lib/server";

export async function GET() {
  const user = await apiUser();
  const founderId = (env as unknown as Record<string, string | undefined>).FOUNDER_METRICS_USER_ID;
  if (!user || !founderId || user.userId !== founderId) return Response.json({ error: "Founder metrics are not available for this account." }, { status: 403 });
  const week = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await getDb().select({ eventName: usageEvents.eventName, value: count() }).from(usageEvents).where(gte(usageEvents.createdAt, week)).groupBy(usageEvents.eventName);
  return Response.json({ window: "7d", metrics: Object.fromEntries(rows.map((row) => [row.eventName, Number(row.value)])) });
}
