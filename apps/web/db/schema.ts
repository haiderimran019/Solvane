import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const folders = sqliteTable(
  "folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    providerOrder: text("provider_order")
      .notNull()
      .default('["claude","gemini","openai","perplexity"]'),
    autoFallback: integer("auto_fallback", { mode: "boolean" })
      .notNull()
      .default(true),
    archived: integer("archived", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("folders_user_updated_idx").on(table.userId, table.updatedAt)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    turnId: text("turn_id").notNull(),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    provider: text("provider"),
    content: text("content").notNull(),
    citations: text("citations").notNull().default("[]"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("messages_folder_created_idx").on(table.folderId, table.createdAt),
    index("messages_turn_idx").on(table.turnId),
  ],
);

export const snapshots = sqliteTable(
  "snapshots",
  {
    id: text("id").primaryKey(),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    version: integer("version").notNull(),
    state: text("state").notNull(),
    sourceMessageCount: integer("source_message_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("snapshots_folder_version_uq").on(table.folderId, table.version),
  ],
);

export const providerCredentials = sqliteTable(
  "provider_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_credentials_user_provider_uq").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    folderId: text("folder_id")
      .notNull()
      .references(() => folders.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    data: text("data").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("events_folder_created_idx").on(table.folderId, table.createdAt)],
);
