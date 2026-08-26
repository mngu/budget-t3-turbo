ALTER TABLE "transactions" DROP CONSTRAINT "transactions_transfer_pair_id_transactions_id_fk";
--> statement-breakpoint
DROP INDEX "transactions_transfer_pair_id_idx";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "transfer_pair_id";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN "transfer_source";