ALTER TABLE "revision" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "revision" ADD COLUMN "source" text DEFAULT 'save' NOT NULL;--> statement-breakpoint
ALTER TABLE "revision" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "revision" ADD COLUMN "changes" jsonb;--> statement-breakpoint
ALTER TABLE "revision" ADD COLUMN "restored_from_at" timestamp with time zone;