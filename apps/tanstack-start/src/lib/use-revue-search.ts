"use client";

import type { TransactionsSearch } from "@budget/api/schemas";

import { useNavigate, useSearch } from "@tanstack/react-router";

// Only read these values under _period-overview, whose routes validate
// transactionsSearchSchema. AppHeader calls this hook outside that layout too.
export function useRevueSearch() {
  const search: TransactionsSearch = useSearch({ strict: false });
  const navigate = useNavigate();

  // Filters reset pagination, but an explicit page must override the default.
  const setSearch = (patch: Partial<TransactionsSearch>) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        page: 1,
        ...patch,
      }),
    });

  return { search, setSearch };
}
