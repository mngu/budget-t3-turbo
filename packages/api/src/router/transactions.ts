import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import type { SQL } from "@budget/db";
import type { TransactionsSearch } from "@budget/validators";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "@budget/db";
import { accounts, categories, transactions } from "@budget/db/schema";
import {
  FALLBACK_CATEGORY_COLOR,
  PAGE_SIZE,
  transactionsSearchSchema,
} from "@budget/validators";

import { protectedProcedure } from "../trpc";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${accounts.displayName}, ${accounts.bankName})`;

export interface TransactionRow {
  id: number;
  bookingDate: string;
  description: string;
  counterparty: string | null;
  bankName: string;
  raw: {
    debtor?: { name?: string };
  };
  amount: string;
  currency: string;
  direction: "debit" | "credit";
  status: "booked" | "pending";
  category: string | null;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  color: string;
}

const transactionsFilterQuery = (
  query: TransactionsSearch,
): SQL<unknown> | undefined => {
  const conditions: SQL[] = [];
  if (query.bank) conditions.push(eq(bankLabel, query.bank));
  if (query.direction)
    conditions.push(eq(transactions.direction, query.direction));
  if (query.status) conditions.push(eq(transactions.status, query.status));
  if (query.category === "none")
    conditions.push(isNull(transactions.categoryId));
  else if (query.category) conditions.push(eq(categories.name, query.category));
  if (query.dateFrom)
    conditions.push(gte(transactions.bookingDate, query.dateFrom));
  if (query.dateTo)
    conditions.push(lte(transactions.bookingDate, query.dateTo));
  if (query.q) {
    const qFilter = or(
      ilike(transactions.description, `%${query.q}%`),
      ilike(transactions.counterparty, `%${query.q}%`),
    );
    if (qFilter) {
      conditions.push(qFilter);
    }
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const transactionsRouter = {
  list: protectedProcedure
    .input(transactionsSearchSchema)
    .query(async ({ ctx, input }) => {
      const where = transactionsFilterQuery(input);

      const signedAmount = sql`case when ${transactions.direction} = 'debit' then -${transactions.amount} else ${transactions.amount} end`;
      const sortColumn =
        input.sort === "amount" ? signedAmount : transactions.bookingDate;
      const orderBy =
        input.order === "asc"
          ? [asc(sortColumn), asc(transactions.id)]
          : [desc(sortColumn), desc(transactions.id)];

      const [rows, [countRow]] = await Promise.all([
        ctx.db
          .select({
            id: transactions.id,
            bookingDate: transactions.bookingDate,
            description: transactions.description,
            counterparty: transactions.counterparty,
            bankName: bankLabel,
            raw: transactions.raw,
            amount: transactions.amount,
            currency: transactions.currency,
            direction: transactions.direction,
            status: transactions.status,
            category: categories.name,
          })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(where)
          .orderBy(...orderBy)
          .limit(PAGE_SIZE)
          .offset((input.page - 1) * PAGE_SIZE),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .innerJoin(accounts, eq(transactions.accountId, accounts.id))
          .leftJoin(categories, eq(transactions.categoryId, categories.id))
          .where(where),
      ]);

      return { rows: rows as TransactionRow[], total: countRow?.total ?? 0 };
    }),

  byCategory: protectedProcedure
    .input(transactionsSearchSchema)
    .query(async ({ ctx, input }): Promise<CategoryBreakdownItem[]> => {
      const where = transactionsFilterQuery(input);
      const rows = await ctx.db
        .select({
          category: sql<string>`${categories.name}`,
          total: sql<string>`sum(${transactions.amount})`,
          color: categories.color,
        })
        .from(transactions)
        .innerJoin(accounts, eq(transactions.accountId, accounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(where)
        .groupBy(categories.id, categories.name)
        .orderBy(desc(sql`sum(${transactions.amount})`));

      return rows.map((r) => ({
        category: r.category,
        total: Number(r.total),
        color: r.color ?? FALLBACK_CATEGORY_COLOR,
      }));
    }),

  banks: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ bankName: bankLabel })
      .from(accounts)
      .orderBy(asc(bankLabel));
    return rows.map((r) => r.bankName);
  }),

  updateCategory: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), category: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [match] = await ctx.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, input.category));
      if (!match) throw new Error(`Catégorie inconnue : ${input.category}`);

      // Une correction manuelle écrase la valeur précédente (LLM ou manuelle) ;
      // le garde IS NULL de scripts/categorize.ts empêche le LLM d'y retoucher.
      await ctx.db
        .update(transactions)
        .set({ categoryId: match.id, categorySource: "manual" })
        .where(eq(transactions.id, input.id));
    }),
} satisfies TRPCRouterRecord;
