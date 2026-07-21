import type { TRPCRouterRecord } from "@trpc/server";

import { categories } from "@budget/db/schema";

import { protectedProcedure } from "../trpc";

export interface CategoryOption {
  id: number;
  name: string;
  color: string | null;
}

export const categoriesRouter = {
  list: protectedProcedure.query(
    async ({ ctx }): Promise<CategoryOption[]> =>
      ctx.db
        .select({
          id: categories.id,
          name: categories.name,
          color: categories.color,
        })
        .from(categories)
        .orderBy(categories.id),
  ),
} satisfies TRPCRouterRecord;
