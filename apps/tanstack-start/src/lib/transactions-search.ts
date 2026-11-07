import type { TransactionsSearch } from "@budget/api/schemas";

export const SEARCH_DEFAULTS = {
  page: 1,
  sort: "date",
  order: "desc",
} as const;

// An empty selection means all banks, including any connected later.
export const selectedBanks = (search: Pick<TransactionsSearch, "bank">) =>
  search.bank === undefined
    ? []
    : Array.isArray(search.bank)
      ? search.bank
      : [search.bank];

// Content filters must not change period totals or make a selected category 100% of the chart.
export const wholePeriod = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  page: 1,
  category: undefined,
  q: undefined,
});
