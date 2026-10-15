import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { events, folders, messages, snapshots } from "../../../db/schema";
import { callProvider, ProviderCallError } from "../../../lib/providers";
import { PROVIDERS, isProviderId, parseProviderOrder, type ProviderId } from "../../../lib/product";
import { apiUser, resolveProviderCredential, unauthorized } from "../../../lib/server";
import { PlatformLimitError, reserveCheckpoint } from "../../../lib/checkpoint-limits";

// Room for adaptive thinking plus a full reply; also the output bound used when reserving platform spend.
const CHAT_MAX_TOKENS = 8000;

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const payload = (await request.json()) as {
    folderId?: string;
    content?: string;
    turnId?: string;
    provider?: unknown;
    approvedSnapshotVersion?: number;
  };
  const folderId = payload.folderId?.trim();
  const content = payload.content?.trim();
  const turnId = payload.turnId?.trim();
  if (!folderId || !content || !turnId) {
    return Response.json({ error: "folderId, content, and turnId are required." }, { status: 400 });
  }
  if (content.length > 30_000) {
    return Response.json({ error: "Message is too large for the MVP." }, { status: 413 });
  }

  const db = getDb();
  const [folder] = await db
    .select()
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.userId, user.userId)))
    .limit(1);
  if (!folder || folder.archived) {
    return Response.json({ error: "Folder not found." }, { status: 404 });
  }

  const [completed] = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.turnId, turnId),
        eq(messages.role, "assistant"),
        eq(messages.folderId, folderId),
        eq(messages.userId, user.userId),
      ),
    )
    .limit(1);
  if (completed) {
    return Response.json({
      message: { ...completed, citations: JSON.parse(completed.citations) },
      provider: completed.provider,
      replayed: true,
    });
  }

  const userMessage = {
    id: crypto.randomUUID(),
    turnId,
    folderId,
    userId: user.userId,
    role: "user" as const,
    content,
    citations: "[]",
    createdAt: new Date().toISOString(),
  };

  const recent = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(and(eq(messages.folderId, folderId), eq(messages.userId, user.userId)))
    .orderBy(desc(messages.createdAt))
    .limit(18);
  recent.reverse();
  recent.push({ role: "user", content });
  const [snapshot] = await db
    .select({ state: snapshots.state, version: snapshots.version, createdAt:snapshots.createdAt })
    .from(snapshots)
    .where(and(eq(snapshots.folderId, folderId), eq(snapshots.userId, user.userId)))
    .orderBy(desc(snapshots.version))
    .limit(1);

  const latestAssistant = await db.select({createdAt:messages.createdAt}).from(messages).where(and(eq(messages.folderId,folderId),eq(messages.userId,user.userId),eq(messages.role,"assistant"))).orderBy(desc(messages.createdAt)).limit(1);
  if (latestAssistant[0] && (!snapshot || latestAssistant[0].createdAt > snapshot.createdAt) && payload.approvedSnapshotVersion !== (snapshot?.version ?? 0)) return Response.json({error:"Your capsule is older than the latest API work. Review it or approve using this saved version once.",approvalRequired:true,snapshotVersion:snapshot?.version ?? 0},{status:409});

  const system = [
    "You are continuing a project through Solvane, a cross-model relay.",
    "Use the portable state as working context. The newest user message is authoritative.",
    "Do not pretend you saw unavailable history or another model's private reasoning.",
    "Continue the active task directly. Mention missing information only when it blocks progress.",
    snapshot ? `PORTABLE STATE v${snapshot.version}:\n${snapshot.state}` : "No snapshot exists yet.",
  ].join("\n\n");

  const preferred = isProviderId(payload.provider) ? payload.provider : null;
  const baseOrder = parseProviderOrder(folder.providerOrder);
  const order: ProviderId[] = preferred
    ? [preferred, ...baseOrder.filter((provider) => provider !== preferred)]
    : baseOrder;
  const candidates = folder.autoFallback ? order : order.slice(0, 1);
  const attempts: Array<{ provider: ProviderId; reason: string }> = [];
  const failovers: Array<{ from: ProviderId; to: ProviderId; reason: string; snapshotVersion: number }> = [];

  for (const provider of candidates) {
    const credential = await resolveProviderCredential(user.userId, provider);
    if (!credential) {
      attempts.push({ provider, reason: "not_connected" });
      continue;
    }
    try {
      // Platform keys are the operator's money, so every provider's call is reserved against the daily caps first.
      if (credential.source === "platform") await reserveCheckpoint(user.userId, folderId, system.length + recent.reduce((sum, item) => sum + item.content.length, 0), true, request, { provider, maxOutputTokens: CHAT_MAX_TOKENS, calls: 1 });
      const result = await callProvider({
        provider,
        apiKey: credential.apiKey,
        model: credential.model,
        system,
        messages: recent,
        maxTokens: CHAT_MAX_TOKENS,
        timeoutMs: 90_000,
      });
      if (!result.text.trim()) throw new ProviderCallError("Empty provider response.", provider, 502, true);
      const completedAt = new Date().toISOString();
      const assistant = {
        id: crypto.randomUUID(),
        turnId,
        folderId,
        userId: user.userId,
        role: "assistant" as const,
        provider,
        content: result.text.trim(),
        citations: JSON.stringify(result.citations),
        createdAt: completedAt,
      };
      await db.batch([
        db.insert(messages).values(userMessage),
        db.insert(messages).values(assistant),
        db.insert(events).values({
          id: crypto.randomUUID(),
          folderId,
          userId: user.userId,
          type: attempts.length ? "handoff.completed" : "turn.completed",
          data: JSON.stringify({ provider, attempts, requestId: result.requestId }),
          createdAt: completedAt,
        }),
        db
          .update(folders)
          .set({ updatedAt: completedAt })
          .where(and(eq(folders.id, folderId), eq(folders.userId, user.userId))),
      ]);
      return Response.json({
        message: { ...assistant, citations: result.citations },
        provider,
        attempts,
        failovers,
        snapshotRefreshRequired: true,
      });
    } catch (error) {
      const failure =
        error instanceof ProviderCallError
          ? error
          : error instanceof PlatformLimitError
            ? new ProviderCallError(`${PROVIDERS[provider].name} reached Solvane's daily processing limit.`, provider, 429, false, true)
            : new ProviderCallError("Provider request failed.", provider, 500, true);
      attempts.push({ provider, reason: failure.status === 402 || failure.status === 429 ? "quota_or_rate_limited" : failure.message });
      await db.insert(events).values({
        id: crypto.randomUUID(),
        folderId,
        userId: user.userId,
        type: "provider.failed",
        data: JSON.stringify({ provider, status: failure.status, retryable: failure.retryable }),
        createdAt: new Date().toISOString(),
      });
      let nextProvider:ProviderId|undefined;
      for(const candidate of candidates.slice(candidates.indexOf(provider)+1)) {if(await resolveProviderCredential(user.userId,candidate)){nextProvider=candidate;break;}}
      if (nextProvider && failure.fallback) {
        const failover = { from: provider, to: nextProvider, reason: failure.status === 402 || failure.status === 429 ? "quota_or_rate_limited" : failure.retryable ? "provider_unavailable" : "provider_rejected", snapshotVersion: snapshot?.version ?? 0 };
        failovers.push(failover);
        await db.insert(events).values({
          id: crypto.randomUUID(),
          folderId,
          userId: user.userId,
          type: "provider.failover",
          data: JSON.stringify(failover),
          createdAt: new Date().toISOString(),
        });
      }
      if (!failure.fallback) break;
    }
  }

  const reasons = attempts.filter((attempt) => attempt.reason !== "not_connected").map((attempt) => attempt.reason === "quota_or_rate_limited" ? `${PROVIDERS[attempt.provider].name} is rate-limited or out of quota.` : attempt.reason);
  return Response.json(
    {
      error: attempts.every((attempt) => attempt.reason === "not_connected")
        ? "Connect at least one provider before sending a message."
        : `No configured provider completed this turn. ${reasons.join(" ")}`.trim(),
      attempts,
      failovers,
    },
    { status: 424 },
  );
}
