import type { TRPCRouterRecord } from "@trpc/server";

import { z } from "zod/v4";

import { CATEGORY_COLOR_HEXES, CATEGORY_ICON_NAMES } from "@budget/shared";

import { setCategoryBudget, setCategoryDetailed } from "../categories/budgets";
import {
  createCategory,
  removeCategory,
  renameCategory,
  updateCategoryIdentity,
} from "../categories/mutations";
import { categoriesOverview } from "../categories/queries";
import { categorizeUncategorized } from "../categorization";
import { transactionsSearchSchema } from "../transactions/schemas";
import { orgProcedure } from "../trpc";

const categoryId = z.number().int().positive();

const defaultSearch = transactionsSearchSchema.parse({});

export const categoriesRouter = {
  overview: orgProcedure
    .input(transactionsSearchSchema.prefault(defaultSearch))
    .query(({ ctx, input }) => categoriesOverview(ctx.organizationId, input)),

  // Unlike post-sync categorization, this user action must surface LLM failures.
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

  updateColor: orgProcedure
    .input(
      z.object({
        id: categoryId,
        color: z.enum(CATEGORY_COLOR_HEXES as [string, ...string[]]),
      }),
    )
    .mutation(({ ctx, input }) =>
      updateCategoryIdentity(ctx.organizationId, input.id, {
        color: input.color,
      }),
    ),

  updateIcon: orgProcedure
    .input(
      z.object({
        id: categoryId,
        icon: z.enum(CATEGORY_ICON_NAMES as [string, ...string[]]).nullable(),
      }),
    )
    .mutation(({ ctx, input }) =>
      updateCategoryIdentity(ctx.organizationId, input.id, {
        icon: input.icon,
      }),
    ),

  remove: orgProcedure
    .input(z.object({ id: categoryId }))
    .mutation(({ ctx, input }) => removeCategory(ctx.organizationId, input.id)),

  budgets: {
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
  },
} satisfies TRPCRouterRecord;
