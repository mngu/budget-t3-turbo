ALTER TABLE "categories" ADD COLUMN "budget_amount" numeric(12, 2);--> statement-breakpoint
UPDATE "categories" c SET "budget_amount" = cb."amount" FROM "category_budgets" cb WHERE cb."category_id" = c."id";--> statement-breakpoint
DROP TABLE "category_budgets" CASCADE;
