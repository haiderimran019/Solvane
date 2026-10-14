CREATE TABLE `usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_name` text NOT NULL,
	`path` text NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_events_user_created_idx` ON `usage_events` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `usage_events_name_created_idx` ON `usage_events` (`event_name`,`created_at`);