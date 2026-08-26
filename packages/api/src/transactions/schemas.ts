import { z } from "zod/v4";

export const PAGE_SIZE = 20;

// Schéma des query params de la table de transactions — partagé entre
// validateSearch (web) et l'input tRPC (api).
export const transactionsSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  // Une banque, ou plusieurs : le panneau de comptes de l'en-tête coche et
  // décoche chaque compte indépendamment. La forme scalaire est conservée — les
  // liens et l'app mobile n'en posent jamais qu'une — et `undefined` veut dire
  // « tous les comptes », jamais la liste complète : la matérialiser ferait
  // apparaître les trois banques dans chaque URL et changerait à chaque
  // connexion ajoutée.
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
