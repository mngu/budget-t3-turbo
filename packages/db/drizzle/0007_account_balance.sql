ALTER TABLE "bank_accounts" ADD COLUMN "balance" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "balance_currency" text;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD COLUMN "balance_at" timestamp with time zone;