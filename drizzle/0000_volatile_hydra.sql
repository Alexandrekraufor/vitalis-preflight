CREATE TYPE "public"."clinic_unit" AS ENUM('Centro', 'Norte', 'Sul');--> statement-breakpoint
CREATE TYPE "public"."finding_severity" AS ENUM('BLOCKING', 'REVIEW', 'INFO');--> statement-breakpoint
CREATE TYPE "public"."finding_source" AS ENUM('CONVENTION_RULE', 'REFERENCE_TABLE', 'RECEPTION_NOTE');--> statement-breakpoint
CREATE TYPE "public"."guide_decision" AS ENUM('READY_TO_SUBMIT', 'NEEDS_CORRECTION', 'REVIEW_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('CSV', 'API', 'SEED');--> statement-breakpoint
CREATE TABLE "guide_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_guia" text NOT NULL,
	"version_number" integer NOT NULL,
	"content_hash" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"normalized_payload" jsonb NOT NULL,
	"normalization_changes" jsonb NOT NULL,
	"source_import_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guides" (
	"id_guia" text PRIMARY KEY NOT NULL,
	"current_version_id" uuid NOT NULL,
	"latest_validation_run_id" uuid,
	"unit" "clinic_unit" NOT NULL,
	"appointment_date" date NOT NULL,
	"patient" text NOT NULL,
	"convention_name" text NOT NULL,
	"procedure_code" text NOT NULL,
	"procedure_description" text,
	"professional" text,
	"amount" numeric(12, 2),
	"reception_note" text,
	"entered_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "import_source" NOT NULL,
	"file_name" text,
	"file_hash" text,
	"rows_read" integer NOT NULL,
	"rows_imported" integer NOT NULL,
	"rows_rejected" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"validation_run_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"code" text NOT NULL,
	"severity" "finding_severity" NOT NULL,
	"source" "finding_source" NOT NULL,
	"field" text,
	"message" text NOT NULL,
	"expected" text,
	"actual" text,
	"evidence" text,
	"recommended_action" text
);
--> statement-breakpoint
CREATE TABLE "validation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_guia" text NOT NULL,
	"guide_version_id" uuid NOT NULL,
	"rules_version" text NOT NULL,
	"rules_hash" text NOT NULL,
	"decision" "guide_decision" NOT NULL,
	"decision_summary" text NOT NULL,
	"amount_at_risk" numeric(12, 2) NOT NULL,
	"observation_interpreter" text,
	"observation_model" text,
	"observation_interpretation" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guide_versions" ADD CONSTRAINT "guide_versions_source_import_id_source_imports_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."source_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_findings" ADD CONSTRAINT "validation_findings_validation_run_id_validation_runs_id_fk" FOREIGN KEY ("validation_run_id") REFERENCES "public"."validation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_id_guia_guides_id_guia_fk" FOREIGN KEY ("id_guia") REFERENCES "public"."guides"("id_guia") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_guide_version_id_guide_versions_id_fk" FOREIGN KEY ("guide_version_id") REFERENCES "public"."guide_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "guide_versions_guide_version_idx" ON "guide_versions" USING btree ("id_guia","version_number");--> statement-breakpoint
CREATE INDEX "guide_versions_guide_idx" ON "guide_versions" USING btree ("id_guia");--> statement-breakpoint
CREATE INDEX "guides_unit_idx" ON "guides" USING btree ("unit");--> statement-breakpoint
CREATE INDEX "guides_convention_idx" ON "guides" USING btree ("convention_name");--> statement-breakpoint
CREATE INDEX "guides_appointment_date_idx" ON "guides" USING btree ("appointment_date");--> statement-breakpoint
CREATE INDEX "validation_findings_run_idx" ON "validation_findings" USING btree ("validation_run_id");--> statement-breakpoint
CREATE INDEX "validation_findings_code_idx" ON "validation_findings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "validation_runs_guide_idx" ON "validation_runs" USING btree ("id_guia");--> statement-breakpoint
CREATE INDEX "validation_runs_decision_idx" ON "validation_runs" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "validation_runs_completed_at_idx" ON "validation_runs" USING btree ("completed_at");