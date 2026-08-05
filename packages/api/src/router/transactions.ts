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
import { orgProcedure } from "../trpc";

export const transactionsRouter = {
  list: orgProcedure
    // `limit` n'est pas dans le schéma partagé : ce n'est pas un filtre, il ne
    // va pas dans l'URL et l'app mobile n'en a pas l'usage.
    .input(
      transactionsSearchSchema.extend({
        limit: z.number().int().min(1).max(200).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      listTransactions(ctx.organizationId, input, input.limit),
    ),

  byCategory: orgProcedure
    .input(transactionsSearchSchema)
    .query(({ ctx, input }) =>
      transactionsByCategory(ctx.organizationId, input),
    ),

  totals: orgProcedure
    .input(transactionsSearchSchema)
    .query(({ ctx, input }) => transactionTotals(ctx.organizationId, input)),

  banks: orgProcedure.query(({ ctx }) => listBankLabels(ctx.organizationId)),

  bankCounts: orgProcedure
    .input(transactionsSearchSchema)
    .query(({ ctx, input }) => bankCounts(ctx.organizationId, input)),

  history: orgProcedure
    .input(transactionsSearchSchema)
    .query(({ ctx, input }) => monthlyHistory(ctx.organizationId, input)),

  review: orgProcedure
    .input(transactionsSearchSchema)
    .query(({ ctx, input }) => reviewQueue(ctx.organizationId, input)),

  updateCategory: orgProcedure
    .input(z.object({ id: z.number().int().positive(), category: z.string() }))
    .mutation(({ ctx, input }) =>
      setTransactionCategory(ctx.organizationId, input.id, input.category),
    ),

  // « Ce n'est pas un virement interne » : casse la paire et la marque `manual`,
  // hors de portée de la détection — sans quoi la passe suivante la reformerait.
  unlinkTransfer: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      unlinkInternalTransfer(ctx.organizationId, input.id),
    ),

  // Relance l'appariement seul, sans import ni appel bancaire. Idempotent.
  detectTransfers: orgProcedure.mutation(({ ctx }) =>
    detectInternalTransfers(ctx.organizationId),
  ),
} satisfies TRPCRouterRecord;
