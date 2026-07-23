// Schéma de la sortie structurée du LLM d'analyse (voir suggest-categories-core.ts).
import { z } from "zod/v4";

export const categorySuggestionChildSchema = z.object({
  name: z.string().min(1),
  // Identifiants (parmi l'échantillon envoyé au LLM) des transactions qui
  // correspondent à cette sous-catégorie — permet à l'UI d'afficher un
  // compteur et une prévisualisation sans re-catégoriser avant application.
  txnIds: z.array(z.number().int()),
});

export const categorySuggestionSchema = z.object({
  parent: z.string().min(1),
  enfants: z.array(categorySuggestionChildSchema).min(1),
});

export const categorySuggestionsSchema = z.object({
  categories: z.array(categorySuggestionSchema).min(1),
});

export type CategorySuggestionChild = z.infer<
  typeof categorySuggestionChildSchema
>;
export type CategorySuggestion = z.infer<typeof categorySuggestionSchema>;
export type CategorySuggestions = z.infer<typeof categorySuggestionsSchema>;
