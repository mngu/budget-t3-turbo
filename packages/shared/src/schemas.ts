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
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;
