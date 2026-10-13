import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { providerCredentials } from "../db/schema";
import { decryptCredential } from "./crypto";
import { configuredModel, platformKey } from "./providers";
import type { ProviderId } from "./product";

export async function apiUser() {
  return getChatGPTUser();
}

export function unauthorized() {
  return Response.json({ error: "Sign in is required." }, { status: 401 });
}

export async function resolveProviderCredential(
  userId: string,
  provider: ProviderId,
): Promise<{ apiKey: string; model: string; source: "user" | "platform" } | null> {
  const db = getDb();
  const [stored] = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.userId, userId),
        eq(providerCredentials.provider, provider),
      ),
    )
    .limit(1);

  if (stored && env.PROVIDER_CREDENTIAL_MASTER_KEY) {
    try {
      return {
        apiKey: await decryptCredential(
          stored.encryptedKey,
          stored.iv,
          env.PROVIDER_CREDENTIAL_MASTER_KEY,
        ),
        model: configuredModel(provider, stored.model),
        source: "user",
      };
    } catch {
      return null;
    }
  }

  const key = platformKey(provider);
  if (!key) return null;
  return {
    apiKey: key,
    model: configuredModel(provider),
    source: "platform",
  };
}
