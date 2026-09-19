import type { TransactionsSearch } from "@budget/api/schemas";

import { monthBounds, monthStartDay } from "./date";

// Apply defaults after next(), which may replace search entirely during navigation.
// Put dates in the URL so the picker and loaders share the same period.
export const defaultToCurrentMonth = <
  TSearch extends Pick<TransactionsSearch, "dateFrom" | "dateTo">,
>({
  search,
  next,
}: {
  search: TSearch;
  next: (search: TSearch) => TSearch;
}) => {
  const result = next(search);
  return (result.dateFrom ?? result.dateTo)
    ? result
    : // SSR uses calendar months; the client applies its saved pay cycle.
      { ...result, ...monthBounds(new Date(), monthStartDay()) };
};

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

export function toggleBank(
  search: Pick<TransactionsSearch, "bank">,
  bank: string,
  known: string[],
): string[] | undefined {
  const current = selectedBanks(search);
  const base = current.length > 0 ? current : known;
  const next = base.includes(bank)
    ? base.filter((b) => b !== bank)
    : [...base, bank];
  // Keep at least one account selected.
  if (next.length === 0) return base;
  return next.length === known.length && known.every((b) => next.includes(b))
    ? undefined
    : next;
}

// Content filters must not change period totals or make a selected category 100% of the chart.
export const wholePeriod = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  page: 1,
  category: undefined,
  q: undefined,
});
