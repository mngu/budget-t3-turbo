import { z } from "zod/v4";

export const PAGE_SIZE = 20;

export const transactionsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  // Undefined means all accounts, including any connected later.
  bank: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .catch(undefined),
  direction: z.enum(["debit", "credit"]).optional().catch(undefined),
  status: z.enum(["booked", "pending"]).optional().catch(undefined),
  category: z
    .union([z.string(), z.literal("none")])
    .optional()
    .catch(undefined),
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  q: z.string().optional().catch(undefined),
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;

export const statsInputSchema = transactionsSearchSchema.pick({
  bank: true,
  dateFrom: true,
  dateTo: true,
});
export type StatsInputSchema = z.infer<typeof statsInputSchema>;

export const budgetStatsSchema = z.object({
  totalBudget: z.coerce.number(),
  totalAmount: z.coerce.number(),
});

export type BudgetStats = z.infer<typeof budgetStatsSchema>;

export const globalStatsSchema = z.object({
  debit: z.coerce.number(),
  credit: z.coerce.number(),
});

export type GlobalStats = z.infer<typeof globalStatsSchema>;

export const bankLabelSchema = z.object({ bankName: z.string() });
export const bankCountSchema = z.object({
  bank: z.string(),
  count: z.number().int(),
});
export const earliestDateSchema = z.object({ date: z.string().nullable() });
export const totalSchema = z.object({ total: z.number().int() });

export const transactionRowSchema = z.object({
  id: z.number().int(),
  bookingDate: z.string(),
  description: z.string(),
  counterparty: z.string().nullable(),
  bankName: z.string(),
  raw: z.object({
    debtor: z.object({ name: z.string().nullish() }).nullish(),
  }),
  // pg returns numeric columns as strings to preserve precision.
  amount: z.string(),
  currency: z.string(),
  direction: z.enum(["debit", "credit"]),
  status: z.enum(["booked", "pending"]),
  category: z.string().nullable(),
  categorySource: z.enum(["llm", "manual", "auto"]).nullable(),
  categoryId: z.number().int().nullable(),
  /** Parent name, optionally followed by the child name. */
  categoryPath: z.string().nullable(),
  /** Parent category color, shared by the family. */
  categoryColor: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  excluded: z.boolean(),
});

export type TransactionRow = z.infer<typeof transactionRowSchema>;
