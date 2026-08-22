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

const breakdownChildSchema = z.strictObject({
  name: z.string().nullable(),
  /**
   * `sub` = une vraie sous-catégorie. `unallocated` = la dépense posée sur la
   * parente elle-même : elle n'est plus signalée comme un défaut (le filtre
   * « à classer » a été supprimé) mais elle reste une part à part entière,
   * sans quoi la somme du niveau ouvert n'égalerait plus le total du poste.
   */
  kind: z.enum(["sub", "unallocated"]),
  total: z.number(),
  budget: z.number().nullable(),
});

// `strictObject` et non `object` : la requête construit ce nœud par
// `to_jsonb(postes)`, qui émet **toutes** les colonnes de la CTE. Une colonne
// ajoutée là passerait en silence dans un schéma permissif, et ce parse est
// précisément le seul endroit où la requête et le type se rencontrent.
const breakdownParentSchema = z.strictObject({
  /** `null` sur le poste des transactions sans catégorie (`kind: "none"`). */
  name: z.string().nullable(),
  kind: z.enum(["parent", "none"]),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  total: z.number(),
  budget: z.number().nullable(),
  /**
   * Trié par montant décroissant **dans le SQL**, reliquat compris. L'ordre
   * n'est pas cosmétique : `shadeCategoryColor` dérive la nuance de chaque
   * segment de son rang, donc le rang est de la donnée.
   */
  children: z.array(breakdownChildSchema),
});

export const breakdownSchema = z.object({
  /** Total des sorties de la période, quel que soit le niveau affiché. */
  expenses: z.number(),
  /** Nombre de postes de dépense. Calculé ici pour que l'en-tête, qui l'affiche,
   *  n'ait pas à le recompter — et ne puisse donc pas annoncer autre chose. */
  postes: z.number(),
  parents: z.array(breakdownParentSchema),
});

export type Breakdown = z.infer<typeof breakdownSchema>;
export type BreakdownParent = z.infer<typeof breakdownParentSchema>;
export type BreakdownChild = z.infer<typeof breakdownChildSchema>;

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
