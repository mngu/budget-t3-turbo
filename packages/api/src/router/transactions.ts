import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { transactionsSearchSchema } from "@budget/shared";

import {
  detectInternalTransfers,
  unlinkInternalTransfer,
} from "../transactions/internal-transfers";
import {
  bankCounts,
  listBankLabels,
  listTransactions,
  monthlyHistory,
  reviewQueue,
  setTransactionCategory,
  transactionsByCategory,
  transactionTotals,
} from "../transactions/queries";
import { protectedProcedure } from "../trpc";

export const transactionsRouter = {
  list: protectedProcedure
    // `limit` n'est pas dans le schéma partagé : ce n'est pas un filtre, il ne
    // va pas dans l'URL et l'app mobile n'en a pas l'usage.
    .input(
      transactionsSearchSchema.extend({
        limit: z.number().int().min(1).max(200).optional(),
      }),
    )
    .query(({ input }) => listTransactions(input, input.limit)),

  byCategory: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => transactionsByCategory(input)),

  totals: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => transactionTotals(input)),

  banks: protectedProcedure.query(() => listBankLabels()),

  bankCounts: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => bankCounts(input)),

  history: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => monthlyHistory(input)),

  review: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => reviewQueue(input)),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), category: z.string() }))
    .mutation(({ input }) => setTransactionCategory(input.id, input.category)),

  // « Ce n'est pas un virement interne » : casse la paire et la marque `manual`,
  // hors de portée de la détection — sans quoi la passe suivante la reformerait.
  unlinkTransfer: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input }) => unlinkInternalTransfer(input.id)),

  // Relance l'appariement seul, sans import ni appel bancaire. Idempotent.
  detectTransfers: protectedProcedure.mutation(() => detectInternalTransfers()),
} satisfies TRPCRouterRecord;
