import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { eq, isNull } from "@budget/db";
import { categories } from "@budget/db/schema";

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

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  parentId: categories.parentId,
};

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

      const roots: CategoryTreeNode[] = [];
      const nodeById = new Map<number, CategoryTreeNode>();
      for (const row of rows) {
        if (row.parentId !== null) continue;
        const node: CategoryTreeNode = { ...row, children: [] };
        nodeById.set(row.id, node);
        roots.push(node);
      }
      for (const row of rows) {
        if (row.parentId === null) continue;
        const parent = nodeById.get(row.parentId);
        parent?.children.push(row);
      }
      return roots;
    },
  ),

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
