ALTER TABLE `snapshots` ADD `schema_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `snapshots` ADD `pinned_fields` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `snapshots` ADD `source_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `snapshots_folder_source_hash_uq` ON `snapshots` (`folder_id`,`source_hash`);