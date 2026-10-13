import { env } from "cloudflare:workers";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { folders, providerCredentials } from "../../../db/schema";
import { configuredModel, platformKey } from "../../../lib/providers";
import { PROVIDER_IDS, PROVIDERS, parseProviderOrder } from "../../../lib/product";
import { apiUser, unauthorized } from "../../../lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await apiUser();
  if (!user) return unauthorized();

  const db = getDb();
  let folderRows = await db
    .select()
    .from(folders)
    .where(and(eq(folders.userId, user.userId), eq(folders.archived, false)))
    .orderBy(desc(folders.updatedAt));

  if (folderRows.length === 0) {
    const now = new Date().toISOString();
    const starter = {
      id: crypto.randomUUID(),
      userId: user.userId,
      name: "My first project",
      description: "A shared workspace that can move between models.",
      providerOrder: JSON.stringify(PROVIDER_IDS),
      autoFallback: true,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(folders).values(starter);
    folderRows = [{ ...starter, archived: false }];
  }

  const credentials = await db
    .select({ provider: providerCredentials.provider, model: providerCredentials.model })
    .from(providerCredentials)
    .where(eq(providerCredentials.userId, user.userId));

  return Response.json({
    user: { name: user.displayName, email: user.email },
    folders: folderRows.map((folder) => ({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      providerOrder: parseProviderOrder(folder.providerOrder),
      autoFallback: folder.autoFallback,
      updatedAt: folder.updatedAt,
    })),
    providers: PROVIDER_IDS.map((provider) => {
      const stored = credentials.find((item) => item.provider === provider);
      const source = stored ? "user" : platformKey(provider) ? "platform" : null;
      return {
        id: provider,
        name: PROVIDERS[provider].name,
        connected: Boolean(source),
        source,
        model: configuredModel(provider, stored?.model),
        credentialStorageReady: Boolean(env.PROVIDER_CREDENTIAL_MASTER_KEY),
      };
    }),
  });
}
