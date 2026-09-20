CREATE TYPE "public"."api_surface" AS ENUM('REST', 'MCP');--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'API_CREDENTIAL_ISSUED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'API_CREDENTIAL_REVOKED';--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"surface" "api_surface" NOT NULL,
	"token_hash" text NOT NULL,
	"hint" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_credentials_token_hash_unique" ON "api_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "api_credentials_surface_idx" ON "api_credentials" USING btree ("surface");