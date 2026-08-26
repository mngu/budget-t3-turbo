ALTER TABLE "categories" ADD COLUMN "budget_detailed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_detailed_no_amount" CHECK (NOT "categories"."budget_detailed" OR "categories"."budget_amount" IS NULL);
