import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { transactionsSearchSchema } from "@budget/shared";

import {
  listBankLabels,
  listTransactions,
  setTransactionCategory,
  transactionsByCategory,
} from "../transactions/queries";
import { protectedProcedure } from "../trpc";

export const transactionsRouter = {
  list: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => listTransactions(input)),

  byCategory: protectedProcedure
    .input(transactionsSearchSchema)
    .query(({ input }) => transactionsByCategory(input)),

  banks: protectedProcedure.query(() => listBankLabels()),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), category: z.string() }))
    .mutation(({ input }) => setTransactionCategory(input.id, input.category)),
} satisfies TRPCRouterRecord;
