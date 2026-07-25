import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { count, eq, inArray, isNull } from "@budget/db";
import { categories, transactions } from "@budget/db/schema";

import {
  applySuggestionsCore,
  generateSuggestionsCore,
  suggestionsStatusCore,
} from "../lib/suggest-categories-core";
import { categorySuggestionSchema } from "../lib/suggest-categories-schema";
import { protectedProcedure } from "../trpc";

export interface CategoryOption {
  id: number;
  name: string;
  color: string | null;
  parentId: number | null;
}

export interface CategoryTreeNode extends CategoryOption {
  children: CategoryOption[];
}

export interface CategoryOverviewNode extends CategoryOption {
  transactionCount: number;
  children: (CategoryOption & { transactionCount: number })[];
}

export interface CategoriesOverview {
  tree: CategoryOverviewNode[];
  uncategorizedCount: number;
}

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  parentId: categories.parentId,
};

// Reconstruit l'arborescence parents → enfants à partir d'une liste plate
// (les catégories n'ont que 2 niveaux) — générique pour être réutilisé par
// `tree` (CategoryOption) et `overview` (CategoryOption & transactionCount).
function buildCategoryTree<T extends CategoryOption>(
  rows: T[],
): (T & { children: T[] })[] {
  const roots: (T & { children: T[] })[] = [];
  const nodeById = new Map<number, T & { children: T[] }>();
  for (const row of rows) {
    if (row.parentId !== null) continue;
    const node = { ...row, children: [] as T[] };
    nodeById.set(row.id, node);
    roots.push(node);
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    const parent = nodeById.get(row.parentId);
    parent?.children.push(row);
  }
  return roots;
}

export const categoriesRouter = {
  // Sans input : liste plate complète (rétrocompatible avec les appels existants).
  // Avec input.parentId : filtre sur ce parent (null = catégories racines).
  list: protectedProcedure
    .input(
      z.object({ parentId: z.number().int().positive().nullable() }).optional(),
    )
    .query(async ({ ctx, input }): Promise<CategoryOption[]> => {
      const where =
        input === undefined
          ? undefined
          : input.parentId === null
            ? isNull(categories.parentId)
            : eq(categories.parentId, input.parentId);
      return ctx.db
        .select(categoryColumns)
        .from(categories)
        .where(where)
        .orderBy(categories.id);
    }),

  // Arborescence complète : catégories parentes avec leurs sous-catégories.
  tree: protectedProcedure.query(
    async ({ ctx }): Promise<CategoryTreeNode[]> => {
      const rows = await ctx.db
        .select(categoryColumns)
        .from(categories)
        .orderBy(categories.id);
      return buildCategoryTree(rows);
    },
  ),

  // Arborescence + nombre de transactions par catégorie (page /categories) :
  // total cumulé (elle-même + sous-catégories) pour un parent, compte direct
  // pour une sous-catégorie. Part de `categories` (pas `transactions`, contrairement
  // à `transactions.byCategory`) pour ne perdre aucune catégorie à 0 transaction.
  overview: protectedProcedure.query(
    async ({ ctx }): Promise<CategoriesOverview> => {
      const [rows, [uncategorized]] = await Promise.all([
        ctx.db
          .select({
            id: categories.id,
            name: categories.name,
            color: categories.color,
            parentId: categories.parentId,
            transactionCount: count(transactions.id),
          })
          .from(categories)
          .leftJoin(transactions, eq(transactions.categoryId, categories.id))
          .groupBy(categories.id)
          .orderBy(categories.id),
        ctx.db
          .select({ total: count() })
          .from(transactions)
          .where(isNull(transactions.categoryId)),
      ]);

      const tree = buildCategoryTree(rows).map((parent) => ({
        ...parent,
        // Total cumulé pour l'affichage du parent ; le compte direct (calculé
        // ci-dessus, avant ce map) reste ce que `remove` utilise pour bloquer
        // la suppression.
        transactionCount:
          parent.transactionCount +
          parent.children.reduce((sum, c) => sum + c.transactionCount, 0),
      }));

      return { tree, uncategorizedCount: uncategorized?.total ?? 0 };
    },
  ),

  // Renomme une catégorie existante (nom seul — pas de couleur dans cette passe).
  rename: protectedProcedure
    .input(
      z.object({ id: z.number().int().positive(), name: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const name = input.name.trim();
      if (name.length === 0) throw new Error("Le nom ne peut pas être vide.");

      const [conflict] = await ctx.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.name, name));
      if (conflict && conflict.id !== input.id) {
        throw new Error(`Une catégorie nommée "${name}" existe déjà.`);
      }

      await ctx.db
        .update(categories)
        .set({ name })
        .where(eq(categories.id, input.id));
    }),

  // Supprime une catégorie (et, pour un parent, ses sous-catégories en
  // cascade) même si des transactions y sont rattachées : elles deviennent
  // non-catégorisées (category_id/category_source à NULL) plutôt que de
  // bloquer la suppression — l'avertissement en amont (UI) se base sur
  // `overview` pour prévenir l'utilisateur avant confirmation.
  remove: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const children = await ctx.db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.parentId, input.id));
      const idsToDelete = [input.id, ...children.map((c) => c.id)];

      await ctx.db
        .update(transactions)
        .set({ categoryId: null, categorySource: null })
        .where(inArray(transactions.categoryId, idsToDelete));

      // Les enfants référencent le parent via parent_id : les supprimer
      // avant le parent pour ne pas violer la contrainte de clé étrangère.
      if (children.length > 0) {
        await ctx.db
          .delete(categories)
          .where(eq(categories.parentId, input.id));
      }
      await ctx.db.delete(categories).where(eq(categories.id, input.id));
    }),

  suggestions: {
    // Lance l'analyse LLM sur un échantillon de transactions récentes.
    generate: protectedProcedure.mutation(() => generateSuggestionsCore()),

    // Existence/âge de la dernière analyse + nombre de transactions arrivées depuis.
    status: protectedProcedure.query(() => suggestionsStatusCore()),

    // Crée les catégories/sous-catégories validées et relance la catégorisation.
    apply: protectedProcedure
      .input(z.object({ suggestions: z.array(categorySuggestionSchema) }))
      .mutation(({ input }) => applySuggestionsCore(input.suggestions)),
  },
} satisfies TRPCRouterRecord;
