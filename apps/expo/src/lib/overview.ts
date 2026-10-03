import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { usePeriod } from "./period";
import { trpc } from "./trpc";

// Same input as the web review: the whole period's expenses, without content filters.
export function useOverview() {
  const { range } = usePeriod();
  return useQuery({
    ...trpc.categories.overview.queryOptions({
      ...range,
      page: 1,
      sort: "date",
      order: "desc",
      direction: "debit",
    }),
    // Keep the previous month on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}
