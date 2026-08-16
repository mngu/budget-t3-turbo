import { z } from "zod/v4";

export const PAGE_SIZE = 25;

// Plafond de la file de relecture (`reviewQueue`). Partagé parce que l'onglet
// « À revoir » compte les éléments reçus : sans connaître le plafond, il
// afficherait « 40 » aussi bien pour 40 transactions que pour 400.
export const REVIEW_QUEUE_LIMIT = 40;

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
  // Ne garde que les transactions rattachées à une catégorie parente qui a des
  // sous-catégories — le « à classer » de la revue du mois. Ce n'est pas le
  // même prédicat que `category: "none"` (aucune catégorie du tout).
  //
  // Nommé d'après le libellé affiché, et non `unallocatedOnly` : le drapeau
  // `unallocated` de `transactions.byCategory` est un *agrégat* et désigne
  // autre chose — deux noms voisins pour deux notions distinctes se
  // confondraient à la première relecture.
  aClasser: z.boolean().optional().catch(undefined),
  // Virements entre deux comptes suivis (`transfer_pair_id`). Ne gouverne que
  // le **relevé** : les agrégats les excluent en dur, à l'intérieur de chaque
  // fonction, sans jamais consulter ce param — un agrégat qui laisserait le
  // choix à l'appelant finirait par afficher des totaux gonflés sans que rien
  // ne le signale à l'écran (même raison que la neutralisation de `direction`
  // dans `monthlyHistory`).
  //
  // Défaut `toutes` : la table est un relevé, elle doit se réconcilier avec ce
  // que la banque affiche. `seulement` est l'écran d'audit de la détection.
  internes: z.enum(["toutes", "masquer", "seulement"]).catch("toutes"),
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;

export const breakdownByCategoriesSchema = z.object({
  parentName: z.string().nullable(),
  categoryName: z.string().nullable(),
  parentIcon: z.string().nullable(),
  parentColor: z.string().nullable(),
  budgetCatAmount: z.number().nullable(),
  budgetParentAmount: z.number().nullable(),
  total: z.number(),
});

export type BreakdownByCategories = z.infer<typeof breakdownByCategoriesSchema>;

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
