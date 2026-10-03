import { z } from "zod/v4";

export const NO_CATEGORY_NAME = "None";

const categoryOverviewChildSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  budgetAmount: z.number().nullable(),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

export type CategoryOverviewChild = z.infer<typeof categoryOverviewChildSchema>;

const categoryOverviewElementSchema = z.object({
  id: z.number().int(),
  organization_id: z.string(),
  // NO_CATEGORY_NAME identifies a synthetic bucket; getCategoryLabel names it.
  name: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  budgetAmount: z.coerce.number().nullable(),
  budgetDetailed: z.boolean(),
  children: z.array(categoryOverviewChildSchema).nullable().default([]),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

export type CategoryOverviewElementType = z.infer<
  typeof categoryOverviewElementSchema
>;

export const categoryOverviewSchema = z.array(categoryOverviewElementSchema);

// The synthetic uncategorized bucket has no editable category record.
export type ManagedCategory = CategoryOverviewElementType & { name: string };

export const isManagedCategory = (
  category: CategoryOverviewElementType,
): category is ManagedCategory =>
  category.name !== null && category.name !== NO_CATEGORY_NAME;

export type CategoryOverviewType = z.infer<typeof categoryOverviewSchema>;

export const getCategoryLabel = (name: string | null) =>
  name && name !== NO_CATEGORY_NAME ? name : "Sans catégorie";

// A detailed parent holds no amount of its own: its budget is its children's sum.
export const familyBudget = (category: CategoryOverviewElementType) =>
  category.budgetDetailed
    ? (category.children ?? []).reduce(
        (sum, child) => sum + (child.budgetAmount ?? 0),
        0,
      ) || null
    : category.budgetAmount;
