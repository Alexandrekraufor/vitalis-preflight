ALTER TYPE "public"."user_role" ADD VALUE 'EVALUATOR';--> statement-breakpoint
ALTER TABLE "api_credentials" ADD COLUMN "evaluation_secret" text;