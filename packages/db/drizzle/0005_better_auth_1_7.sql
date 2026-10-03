-- NOT NULL fails on any legacy null, and false is what the column default means.
UPDATE "organization" SET "is_personal" = false WHERE "is_personal" IS NULL;--> statement-breakpoint
UPDATE "user" SET "is_admin" = false WHERE "is_admin" IS NULL;--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "is_personal" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "is_admin" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");