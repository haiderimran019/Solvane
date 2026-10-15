import { getDb } from "../../../db";
import { usageEvents } from "../../../db/schema";
import { apiUser, unauthorized } from "../../../lib/server";

const ALLOWED_EVENTS = new Set([
  "consent.updated",
  "profile.opened",
  "mode.opened",
  "handoff.started",
  "handoff.completed",
  "checkpoint.previewed",
  "checkpoint.saved",
  "activation.first_save",
  "continue.completed",
  "provider.failed",
  "code_handoff.exported",
  "extension.downloaded",
]);

const ALLOWED_METADATA_KEYS = new Set(["analytics", "mode", "provider", "surface", "source", "redactions", "items", "version", "idempotent", "from", "to", "reason", "snapshotVersion"]);

function cleanMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => ALLOWED_METADATA_KEYS.has(key) && ["string", "number", "boolean"].includes(typeof entry))
      .map(([key, entry]) => [key, typeof entry === "string" ? entry.slice(0, 80) : entry]),
  );
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();

  const payload = (await request.json()) as {
    eventName?: unknown;
    path?: unknown;
    metadata?: unknown;
  };
  if (typeof payload.eventName !== "string" || !ALLOWED_EVENTS.has(payload.eventName)) {
    return Response.json({ error: "Unsupported analytics event." }, { status: 400 });
  }

  const path = typeof payload.path === "string" && payload.path.startsWith("/")
    ? payload.path.slice(0, 160)
    : "/";
  await getDb().insert(usageEvents).values({
    id: crypto.randomUUID(),
    userId: user.userId,
    eventName: payload.eventName,
    path,
    metadata: JSON.stringify(cleanMetadata(payload.metadata)),
    createdAt: new Date().toISOString(),
  });

  return Response.json({ stored: true });
}
