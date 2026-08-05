import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { CATEGORY_COLOR_HEXES, CATEGORY_ICON_NAMES } from "@budget/shared";

import {
  budgetPlan,
  clearCategoryBudgets,
  setCategoryBudget,
  setCategoryDetailed,
} from "../categories/budgets";
import {
  createCategory,
  removeCategory,
  renameCategory,
  updateCategoryColor,
  updateCategoryIcon,
} from "../categories/mutations";
import {
  categoriesOverview,
  listCategories,
  listCategoryTree,
} from "../categories/queries";
import { generateSuggestions } from "../categories/suggestions/analyze";
import {
  acceptSuggestion,
  applySuggestions,
  previewReplace,
} from "../categories/suggestions/apply";
import {
  categorySuggestionChildSchema,
  categorySuggestionSchema,
} from "../categories/suggestions/schema";
import { categorizeUncategorized } from "../categorization/run";
import { orgProcedure } from "../trpc";

const categoryId = z.number().int().positive();

export const categoriesRouter = {
  // Sans input : liste plate complète (rétrocompatible avec les appels existants).
  // Avec input.parentId : filtre sur ce parent (null = catégories racines).
  list: orgProcedure
    .input(z.object({ parentId: categoryId.nullable() }).optional())
    .query(({ ctx, input }) =>
      listCategories(ctx.organizationId, input?.parentId),
    ),

  tree: orgProcedure.query(({ ctx }) => listCategoryTree(ctx.organizationId)),

  overview: orgProcedure.query(({ ctx }) =>
    categoriesOverview(ctx.organizationId),
  ),

  // Catégorise les transactions sans catégorie avec les catégories déjà
  // existantes (pas de proposition de nouvelle arborescence, voir
  // suggestions.generate pour ça).
  categorize: orgProcedure.mutation(({ ctx }) =>
    categorizeUncategorized(ctx.organizationId),
  ),

  create: orgProcedure
    .input(
      z.object({ name: z.string().min(1), parentId: categoryId.nullable() }),
    )
    .mutation(({ ctx, input }) =>
      createCategory(ctx.organizationId, input.name, input.parentId),
    ),

  rename: orgProcedure
    .input(z.object({ id: categoryId, name: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      renameCategory(ctx.organizationId, input.id, input.name),
    ),

  // La palette fermée est contrainte ici, à l'entrée ; la règle « seule une
  // catégorie parente a une couleur propre » vit dans updateCategoryColor.
  updateColor: orgProcedure
    .input(
      z.object({
        id: categoryId,
        color: z.enum(CATEGORY_COLOR_HEXES as [string, ...string[]]),
      }),
    )
    .mutation(({ ctx, input }) =>
      updateCategoryColor(ctx.organizationId, input.id, input.color),
    ),

  // Même forme que updateColor : jeu fermé contraint à l'entrée, règle
  // « seule une parente a une icône » dans updateCategoryIcon. `null` =
  // retour à l'état sans icône.
  updateIcon: orgProcedure
    .input(
      z.object({
        id: categoryId,
        icon: z.enum(CATEGORY_ICON_NAMES as [string, ...string[]]).nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      updateCategoryIcon(ctx.organizationId, input.id, input.icon),
    ),

  remove: orgProcedure
    .input(z.object({ id: categoryId }))
    .mutation(({ ctx, input }) => removeCategory(ctx.organizationId, input.id)),

  // Onglet « Budgets » de /categories. Un budget est un montant mensuel posé
  // sur une catégorie, sans dimension de mois : `set` écrase, il n'y a rien à
  // versionner. `plan` porte aussi les compteurs d'en-tête — ils dépendent du
  // découpage en postes (voir budgetSlots), qui n'a qu'une seule définition.
  budgets: {
    plan: orgProcedure.query(({ ctx }) => budgetPlan(ctx.organizationId)),

    // Borne haute alignée sur celle du champ de saisie (5 chiffres).
    set: orgProcedure
      .input(
        z.object({
          categoryId,
          amount: z.number().int().min(0).max(99999).nullable(),
        }),
      )
      .mutation(({ ctx, input }) =>
        setCategoryBudget(ctx.organizationId, input.categoryId, input.amount),
      ),

    setDetailed: orgProcedure
      .input(z.object({ categoryId, detailed: z.boolean() }))
      .mutation(({ ctx, input }) =>
        setCategoryDetailed(
          ctx.organizationId,
          input.categoryId,
          input.detailed,
        ),
      ),

    clear: orgProcedure.mutation(({ ctx }) =>
      clearCategoryBudgets(ctx.organizationId),
    ),
  },

  suggestions: {
    // Lance l'analyse LLM sur un échantillon de transactions récentes et
    // renvoie la proposition. **Le serveur n'en garde rien** : elle vit en
    // mémoire du navigateur qui l'a demandée, et se reperd à chaque
    // rechargement — relancer coûte un appel LLM, jamais une incohérence.
    generate: orgProcedure.mutation(({ ctx }) =>
      generateSuggestions(ctx.organizationId),
    ),

    // Aperçu en lecture seule de ce que ferait le mode "replace" : quelles
    // catégories existantes seraient supprimées vs conservées (corrections
    // manuelles). Utilisé par la dialog de confirmation côté UI.
    previewReplace: orgProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .query(({ ctx, input }) =>
        previewReplace(ctx.organizationId, input.suggestions),
      ),

    // Accepte une proposition isolée — c'est ce que fait le bouton
    // « Ajouter » d'une ligne proposée sur /categories. À ne pas remplacer par
    // un `apply` sur un tableau à un élément : voir le commentaire
    // d'acceptSuggestion, l'apply relance une passe LLM sur toute la base.
    accept: orgProcedure
      .input(
        z.object({
          parent: categorySuggestionSchema.shape.parent,
          parentColor: categorySuggestionSchema.shape.parentColor,
          child: categorySuggestionChildSchema,
        }),
      )
      .mutation(({ ctx, input }) =>
        acceptSuggestion(
          ctx.organizationId,
          input.parent,
          input.parentColor,
          input.child,
        ),
      ),

    // Crée les catégories/sous-catégories validées et relance la
    // catégorisation. mode "merge" (défaut) additif, "replace" fait de la
    // sélection cochée la nouvelle vérité (voir applySuggestions).
    apply: orgProcedure
      .input(
        z.object({
          suggestions: z.array(categorySuggestionSchema),
          mode: z.enum(["merge", "replace"]).default("merge"),
        }),
      )
      .mutation(({ ctx, input }) =>
        applySuggestions(ctx.organizationId, input.suggestions, input.mode),
      ),
  },
} satisfies TRPCRouterRecord;
