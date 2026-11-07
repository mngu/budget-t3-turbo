import type { TransactionsSearch } from "@budget/api/schemas";
import type { ReactNode } from "react";

import { createContext, use, useState } from "react";

export type StatementFilters = Pick<
  TransactionsSearch,
  "q" | "direction" | "category" | "sort" | "order"
>;

export const DEFAULT_FILTERS: StatementFilters = {
  sort: "date",
  order: "desc",
};

interface Filters {
  filters: StatementFilters;
  setFilters: (patch: Partial<StatementFilters>) => void;
}

// The Transactions tab's filters, shared with its filter sheet. Unlike the
// period, they narrow the statement only, never the review's aggregates.
const FiltersContext = createContext<Filters>({
  filters: DEFAULT_FILTERS,
  setFilters: () => undefined,
});

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, set] = useState(DEFAULT_FILTERS);
  return (
    <FiltersContext
      value={{
        filters,
        setFilters: (patch) => set((current) => ({ ...current, ...patch })),
      }}
    >
      {children}
    </FiltersContext>
  );
}

export const useFilters = () => use(FiltersContext);

// The search box is left out: it shows its own state.
export const activeFilterCount = ({
  direction,
  category,
  sort,
  order,
}: StatementFilters) =>
  [
    direction,
    category,
    sort !== DEFAULT_FILTERS.sort || order !== DEFAULT_FILTERS.order,
  ].filter(Boolean).length;
