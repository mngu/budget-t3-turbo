import type { CategoryOverviewType } from "@budget/api/schemas";

// The header and the breakdown column must count the same "postes de dépense".
export const spendingCategories = (overview: CategoryOverviewType) =>
  overview.filter((cat) => (cat.totalAmount ?? 0) > 0);
