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

// Une ligne du relevé, telle que `listTransactions` la lit en SQL brut. Le
// schéma est ce qui garantit les alias camelCase : un `AS bookingDate` non
// quoté sort en minuscules, et un cast de type mentirait sans rien lever.
export const transactionRowSchema = z.object({
  id: z.number().int(),
  bookingDate: z.string(),
  description: z.string(),
  counterparty: z.string().nullable(),
  bankName: z.string(),
  raw: z.object({
    debtor: z.object({ name: z.string().nullish() }).nullish(),
  }),
  // numeric : pg le rend en chaîne, et la table le formate elle-même.
  amount: z.string(),
  currency: z.string(),
  direction: z.enum(["debit", "credit"]),
  status: z.enum(["booked", "pending"]),
  /** Catégorie feuille — c'est elle que `updateCategory` réécrit. */
  category: z.string().nullable(),
  /**
   * Qui a posé la catégorie : `manual` = corrigée à la main, le seul état que
   * la table signale (pastille « modifiée »). `llm` / `auto` sont le régime
   * normal et n'ont rien à dire au lecteur ; `null` = aucune catégorie.
   */
  categorySource: z.enum(["llm", "manual", "auto"]).nullable(),
  categoryId: z.number().int().nullable(),
  /** Chemin affiché : « Parent › Enfant », ou « Parent » seul. */
  categoryPath: z.string().nullable(),
  /** Couleur de la catégorie *parente* : les lignes se lisent par famille. */
  categoryColor: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  /** Exclue à la main des agrégats — elle reste dans ce relevé, et là seulement. */
  excluded: z.boolean(),
});

export type TransactionRow = z.infer<typeof transactionRowSchema>;
