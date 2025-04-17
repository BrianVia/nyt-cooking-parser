CREATE TABLE `recipe_tags` (
	`recipe_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`author` text,
	`image` text,
	`recipeYield` text,
	`prepTimeIso` text,
	`cookTimeIso` text,
	`totalTimeIso` text,
	`totalTimeMinutes` integer,
	`ingredients` text,
	`instructions` text,
	`nutrition` text,
	`rating` real,
	`ratingCount` integer
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recipe_tag_recipe_idx` ON `recipe_tags` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_tag_tag_idx` ON `recipe_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_url_unique` ON `recipes` (`url`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `recipes` (`name`);--> statement-breakpoint
CREATE INDEX `total_time_minutes_idx` ON `recipes` (`totalTimeMinutes`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `tag_name_idx` ON `tags` (`name`);