import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { CATEGORY_COLOR_HEXES } from "@budget/shared";

import {
  createCategory,
  removeCategory,
  renameCategory,
  updateCategoryColor,
} from "../categories/mutations";
import {
  categoriesOverview,
  listCategories,
  listCategoryTree,
} from "../categories/queries";
import {
  applySuggestions,
  previewReplace,
} from "../categories/suggestions/apply";
import { categorySuggestionSchema } from "../categories/suggestions/schema";
import {
  generateSuggestions,
  getSuggestionsStatus,
} from "../categories/suggestions/state";
import { categorizeUncategorized } from "../categorization/run";
import { protectedProcedure } from "../trpc";

const categoryId = z.number().int().positive();

export const categoriesRouter = {
  // Sans input : liste plate complète (rétrocompatible avec les appels existants).
  // Avec input.parentId : filtre sur ce parent (null = catégories racines).
  list: protectedProcedure
    .input(z.object({ parentId: categoryId.nullable() }).optional())
    .query(({ input }) => listCategories(input?.parentId)),

  tree: protectedProcedure.query(() => listCategoryTree()),

  overview: protectedProcedure.query(() => categoriesOverview()),

  // Catégorise les transactions sans catégorie avec les catégories déjà
  // existantes (pas de proposition de nouvelle arborescence, voir
  // suggestions.generate pour ça).
  categorize: protectedProcedure.mutation(() => categorizeUncategorized()),

  create: protectedProcedure
    .input(
      z.object({ name: z.string().min(1), parentId: categoryId.nullable() }),
    )
    .mutation(({ input }) => createCategory(input.name, input.parentId)),

  rename: protectedProcedure
    .input(z.object({ id: categoryId, name: z.string().min(1) }))
    .mutation(({ input }) => renameCategory(input.id, input.name)),

  // La palette fermée est contrainte ici, à l'entrée ; la règle « seule une
  // catégorie parente a une couleur propre » vit dans updateCategoryColor.
  updateColor: protectedProcedure
    .input(
      z.object({
        id: categoryId,
        color: z.enum(CATEGORY_COLOR_HEXES as [string, ...string[]]),
      }),
    )
    .mutation(({ input }) => updateCategoryColor(input.id, input.color)),

  remove: protectedProcedure
    .input(z.object({ id: categoryId }))
    .mutation(({ input }) => removeCategory(input.id)),

  suggestions: {
    // Lance l'analyse LLM sur un échantillon de transactions récentes.
    generate: protectedProcedure.mutation(() => generateSuggestions()),

    // Existence/âge de la dernière analyse + nombre de transactions arrivées depuis.
    status: protectedProcedure.query(() => getSuggestionsStatus()),

    // Aperçu en lecture seule de ce que ferait le mode "replace" : quelles
    // catégories existantes seraient supprimées vs conservées (corrections
    // manuelles). Utilisé par la dialog de confirmation côté UI.
    previewReplace: protectedProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .query(({ input }) => previewReplace(input.suggestions)),

    // Crée les catégories/sous-catégories validées et relance la
    // catégorisation. mode "merge" (défaut) additif, "replace" fait de la
    // sélection cochée la nouvelle vérité (voir applySuggestions).
    apply: protectedProcedure
      .input(
        z.object({
          suggestions: z.array(categorySuggestionSchema),
          mode: z.enum(["merge", "replace"]).default("merge"),
        }),
      )
      .mutation(({ input }) => applySuggestions(input.suggestions, input.mode)),
  },
} satisfies TRPCRouterRecord;
