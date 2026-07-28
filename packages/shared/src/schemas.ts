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
  bank: z.string().optional().catch(undefined),
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
  // sous-catégories — le « non ventilé » de la revue du mois. Ce n'est pas le
  // même prédicat que `category: "none"` (aucune catégorie du tout).
  nvOnly: z.boolean().optional().catch(undefined),
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
  // Tri de la liste des catégories de la revue du mois. Distinct de `sort`,
  // qui ne concerne que la table des transactions.
  //
  // Optionnel et non `.catch("montant")` : une clé requise obligerait tous les
  // `navigate({ to: "/" })` de l'app (pages Banques et Catégories) à la
  // renseigner. Le défaut est appliqué à la lecture, dans la liste elle-même.
  catSort: z.enum(["montant", "ecart", "nv"]).optional().catch(undefined),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;
