import { z } from "zod/v4";

export const PAGE_SIZE = 25;
export const FALLBACK_CATEGORY_COLOR = "#94a3b8";

// Palette fermée pour les catégories parentes — source unique de vérité,
// partagée entre le prompt LLM de suggestion de catégories (packages/api)
// et son affichage (apps/tanstack-start), pour ne jamais dupliquer une
// liste de couleurs codée en dur à plusieurs endroits.
export const CATEGORY_COLOR_PALETTE = [
  { name: "Indigo", hex: "#6366f1" },
  { name: "Vert", hex: "#16a34a" },
  { name: "Ambre", hex: "#f59e0b" },
  { name: "Rose", hex: "#ec4899" },
  { name: "Bleu", hex: "#3b82f6" },
  { name: "Émeraude", hex: "#10b981" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Orange", hex: "#f97316" },
  { name: "Citron vert", hex: "#84cc16" },
  { name: "Ardoise", hex: FALLBACK_CATEGORY_COLOR },
] as const;

export const CATEGORY_COLOR_HEXES: string[] = CATEGORY_COLOR_PALETTE.map(
  (c) => c.hex,
);

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
  sort: z.enum(["date", "amount"]).catch("date"),
  order: z.enum(["asc", "desc"]).catch("desc"),
});

export type TransactionsSearch = z.infer<typeof transactionsSearchSchema>;
