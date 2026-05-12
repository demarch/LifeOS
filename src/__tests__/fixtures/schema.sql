CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`pluggy_id` text,
	`name` text NOT NULL,
	`bank` text NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`color` text NOT NULL,
	`last4` text,
	`limit` real,
	`updated_at` integer NOT NULL
);
CREATE TABLE `base_list_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`default_qty` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `bills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real,
	`due_day` integer NOT NULL,
	`category` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`is_paid` integer DEFAULT 0 NOT NULL,
	`paid_at` integer,
	`needs_review` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `cash_flow_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`month_id` text NOT NULL,
	`day` integer NOT NULL,
	`date` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`note` text,
	`entrada` real DEFAULT 0 NOT NULL,
	`saida` real DEFAULT 0 NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`source_ref_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`month_id`) REFERENCES `cash_flow_months`(`id`) ON UPDATE no action ON DELETE cascade
);
CREATE TABLE `cash_flow_months` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`opening_balance` real DEFAULT 0 NOT NULL,
	`inherit_opening` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`is_recurring` integer DEFAULT 0 NOT NULL,
	`is_checked` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`base_list_item_id` text
);
CREATE TABLE `shopping_session_items` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`qty` integer DEFAULT 1 NOT NULL,
	`base_list_item_id` text,
	FOREIGN KEY (`session_id`) REFERENCES `shopping_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`base_list_item_id`) REFERENCES `base_list_items`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE `shopping_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`completed_at` integer NOT NULL,
	`total_items` integer NOT NULL,
	`total_checked` integer NOT NULL
);
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`billing_day` integer NOT NULL,
	`category` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`alert_days` integer DEFAULT 3 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL
);
CREATE TABLE `sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`accounts_synced` integer DEFAULT 0 NOT NULL,
	`transactions_synced` integer DEFAULT 0 NOT NULL,
	`error_msg` text,
	`synced_at` integer NOT NULL
);
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`pluggy_id` text,
	`account_id` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `accounts_pluggy_id_unique` ON `accounts` (`pluggy_id`);
CREATE UNIQUE INDEX `cash_flow_entries_src_uniq` ON `cash_flow_entries` (`month_id`,`source`,`source_ref_id`);
CREATE UNIQUE INDEX `cash_flow_months_key_unique` ON `cash_flow_months` (`key`);
CREATE UNIQUE INDEX `transactions_pluggy_id_unique` ON `transactions` (`pluggy_id`);
