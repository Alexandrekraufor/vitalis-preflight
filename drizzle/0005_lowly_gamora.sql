CREATE TYPE "public"."rule_set_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE "rule_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"status" "rule_set_status" DEFAULT 'DRAFT' NOT NULL,
	"document" jsonb NOT NULL,
	"hash" text NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"published_by" uuid
);
--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_sets" ADD CONSTRAINT "rule_sets_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_single_published" ON "rule_sets" USING btree ("status") WHERE "rule_sets"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE UNIQUE INDEX "rule_sets_single_draft" ON "rule_sets" USING btree ("status") WHERE "rule_sets"."status" = 'DRAFT';--> statement-breakpoint
CREATE INDEX "rule_sets_created_idx" ON "rule_sets" USING btree ("created_at");