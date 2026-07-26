// Schéma de la sortie structurée du LLM d'analyse (voir suggestions/analyze.ts).
import { z } from "zod/v4";

import { CATEGORY_COLOR_HEXES } from "@budget/validators";

export const categorySuggestionChildSchema = z.object({
  name: z.string().min(1),
  // Identifiants (parmi l'échantillon envoyé au LLM) des transactions qui
  // correspondent à cette sous-catégorie — permet à l'UI d'afficher un
  // compteur et une prévisualisation sans re-catégoriser avant application.
  txnIds: z.array(z.number().int()),
});

export const categorySuggestionSchema = z.object({
  parent: z.string().min(1),
  // Couleur proposée par le LLM pour cette catégorie parente (jamais les
  // sous-catégories, qui héritent visuellement de leur parent — voir
  // transactionsRouter). Toujours un membre de CATEGORY_COLOR_HEXES à ce
  // stade : la sortie brute du LLM est nettoyée par sanitizeSuggestionColors
  // avant de prendre cette forme (voir suggestions/analyze.ts).
  parentColor: z.enum(CATEGORY_COLOR_HEXES as [string, ...string[]]),
  enfants: z.array(categorySuggestionChildSchema).min(1),
});

export const categorySuggestionsSchema = z.object({
  categories: z.array(categorySuggestionSchema).min(1),
});

// Schéma permissif utilisé uniquement pour parser la sortie brute du LLM
// (zodOutputFormat) : `parentColor` n'est pas contraint à l'énumération ici,
// pour ne jamais faire planter le parsing structured-output de toute
// l'analyse si le LLM sort une couleur hors liste — même piège que celui
// corrigé dans categorization/results.ts (voir buildCategorizationOutputSchema).
// sanitizeSuggestionColors ramène chaque couleur à un membre valide de la
// palette juste après, avant que la donnée ne prenne la forme stricte
// ci-dessus.
export const rawCategorySuggestionSchema = categorySuggestionSchema.extend({
  parentColor: z.string(),
});

export const rawCategorySuggestionsSchema = z.object({
  categories: z.array(rawCategorySuggestionSchema).min(1),
});

export type CategorySuggestionChild = z.infer<
  typeof categorySuggestionChildSchema
>;
export type CategorySuggestion = z.infer<typeof categorySuggestionSchema>;
export type CategorySuggestions = z.infer<typeof categorySuggestionsSchema>;
export type RawCategorySuggestion = z.infer<typeof rawCategorySuggestionSchema>;
