import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, folders, messages, snapshots } from "../../../db/schema";
import { callProvider } from "../../../lib/providers";
import {
  EMPTY_SNAPSHOT,
  parseProviderOrder,
  type RelaySnapshot,
} from "../../../lib/product";
import { apiUser, resolveProviderCredential, unauthorized } from "../../../lib/server";

function cleanList(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 6)
    : [];
}

function parseSnapshot(text: string): RelaySnapshot | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const value = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      objective: String(value.objective ?? "").slice(0, 300),
      currentTask: String(value.currentTask ?? "").slice(0, 300),
      constraints: cleanList(value.constraints),
      decisions: cleanList(value.decisions),
      completed: cleanList(value.completed),
      openQuestions: cleanList(value.openQuestions),
      nextAction: String(value.nextAction ?? "").slice(0, 300),
    };
  } catch {
    return null;
  }
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
  };
}

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const payload = (await request.json()) as { folderId?: string };
  const folderId = payload.folderId?.trim();
  if (!folderId) return Response.json({ error: "folderId is required." }, { status: 400 });

  const db = getDb();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.userId)))
    .limit(1);
  if (!folder) return Response.json({ error: "Folder not found." }, { status: 404 });

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
  const previous = prior ? (JSON.parse(prior.state) as RelaySnapshot) : undefined;
  let state: RelaySnapshot | null = null;
  let reducedBy = "deterministic";

  for (const provider of parseProviderOrder(folder.providerOrder)) {
    const credential = await resolveProviderCredential(user.userId, provider);
    if (!credential) continue;
    try {
      const result = await callProvider({
        provider,
        apiKey: credential.apiKey,
        model: credential.model,
        maxTokens: 650,
        system:
          "Compress the project into valid JSON only. Never invent facts. Keys: objective, currentTask, constraints, decisions, completed, openQuestions, nextAction. Arrays contain short strings. Keep the entire result under 900 tokens.",
        messages: [
          {
            role: "user",
            content: `Previous state:\n${JSON.stringify(previous ?? EMPTY_SNAPSHOT)}\n\nRecent conversation:\n${rows
              .map((row) => `${row.role.toUpperCase()}: ${row.content}`)
              .join("\n\n")}`,
          },
        ],
      });
      state = parseSnapshot(result.text);
      if (state) reducedBy = provider;
      break;
    } catch {
      continue;
    }
  }
  state ??= deterministicSnapshot(rows, previous);
  const version = (prior?.version ?? 0) + 1;
  const createdAt = new Date().toISOString();
  await db.batch([
    db.insert(snapshots).values({
      id: crypto.randomUUID(),
      folderId,
      userId: user.userId,
      version,
      state: JSON.stringify(state),
      sourceMessageCount: rows.length,
      createdAt,
    }),
    db.insert(events).values({
      id: crypto.randomUUID(),
      folderId,
      userId: user.userId,
      type: "snapshot.published",
      data: JSON.stringify({ version, reducedBy, sourceMessageCount: rows.length }),
      createdAt,
    }),
  ]);
  return Response.json({ snapshot: { version, state, createdAt }, reducedBy });
}
