import type { BreakdownByCategories } from "@budget/shared";

/**
 * Une ligne de `transactions.breakdownByCategories`. Partagée par les tests de
 * `breakdown` et de `useDrill`, qui décrivent le même niveau vu de deux places.
 */
export const row = (
  parentName: string | null,
  categoryName: string | null,
  total: number,
  budgets: { cat?: number; parent?: number } = {},
): BreakdownByCategories => ({
  parentName,
  categoryName,
  parentIcon: null,
  parentColor: null,
  budgetCatAmount: budgets.cat ?? null,
  budgetParentAmount: budgets.parent ?? null,
  total,
});
