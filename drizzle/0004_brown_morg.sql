CREATE TYPE "public"."request_outcome" AS ENUM('AUTHORIZED', 'UNAUTHORIZED', 'RATE_LIMITED');--> statement-breakpoint
CREATE TABLE "api_request_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"surface" "api_surface" NOT NULL,
	"method" text NOT NULL,
	"route" text NOT NULL,
	"status" integer NOT NULL,
	"outcome" "request_outcome" NOT NULL,
	"duration_ms" integer NOT NULL,
	"credential_id" uuid,
	"oauth_client_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_request_events" ADD CONSTRAINT "api_request_events_credential_id_api_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."api_credentials"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_events" ADD CONSTRAINT "api_request_events_oauth_client_id_oauth_clients_id_fk" FOREIGN KEY ("oauth_client_id") REFERENCES "public"."oauth_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_request_events" ADD CONSTRAINT "api_request_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_request_events_created_idx" ON "api_request_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_request_events_surface_idx" ON "api_request_events" USING btree ("surface");