import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { providerCredentials } from "../../../db/schema";
import { encryptCredential } from "../../../lib/crypto";
import { PROVIDERS, isProviderId } from "../../../lib/product";
import { apiUser, unauthorized } from "../../../lib/server";

export async function POST(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  if (!env.PROVIDER_CREDENTIAL_MASTER_KEY) {
    return Response.json(
      { error: "Secure credential storage is not configured for this deployment." },
      { status: 503 },
    );
  }

  const payload = (await request.json()) as {
    provider?: unknown;
    apiKey?: string;
    model?: string;
  };
  if (!isProviderId(payload.provider)) {
    return Response.json({ error: "Unsupported provider." }, { status: 400 });
  }
  const apiKey = payload.apiKey?.trim();
  if (!apiKey || apiKey.length < 8) {
    return Response.json({ error: "Enter a valid provider API key." }, { status: 400 });
  }

  const provider = payload.provider;
  const model = payload.model?.trim().slice(0, 100) || PROVIDERS[provider].defaultModel;
  const encrypted = await encryptCredential(apiKey, env.PROVIDER_CREDENTIAL_MASTER_KEY);
  const db = getDb();
  const existing = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, user.userId),
        eq(providerCredentials.provider, provider),
      ),
    )
    .limit(1);
  const now = new Date().toISOString();
  if (existing.length) {
    await db
      .update(providerCredentials)
      .set({
        model,
        encryptedKey: encrypted.encryptedKey,
        iv: encrypted.iv,
        updatedAt: now,
      })
      .where(eq(providerCredentials.id, existing[0].id));
  } else {
    await db.insert(providerCredentials).values({
      id: crypto.randomUUID(),
      userId: user.userId,
      provider,
      model,
      encryptedKey: encrypted.encryptedKey,
      iv: encrypted.iv,
      createdAt: now,
      updatedAt: now,
    });
  }
  return Response.json({ provider, connected: true, model });
}

export async function DELETE(request: Request) {
  const user = await apiUser();
  if (!user) return unauthorized();
  const payload = (await request.json()) as { provider?: unknown };
  if (!isProviderId(payload.provider)) {
    return Response.json({ error: "Unsupported provider." }, { status: 400 });
  }
  await getDb()
    .delete(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, user.userId),
        eq(providerCredentials.provider, payload.provider),
      ),
    );
  return Response.json({ provider: payload.provider, connected: false });
}
