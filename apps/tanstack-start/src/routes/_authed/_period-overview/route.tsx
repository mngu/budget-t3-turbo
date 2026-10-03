import {
  createFileRoute,
  Outlet,
  stripSearchParams,
  useRouterState,
} from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/api/schemas";
import { cn } from "@budget/ui";
import {
  defaultToCurrentMonth,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";

import { BreakdownList } from "./-components/breakdown-list";
import { KpiBand } from "./-components/kpi-band";
import { OverviewHeader } from "./-components/overview-header";

// Child routes must share transactionsSearchSchema: the header and breakdown
// read it with strict: false, and this layout loads their shared aggregates.
export const Route = createFileRoute("/_authed/_period-overview")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const period = wholePeriod(deps);
    const [
      globalStats,
      budgetStats,
      overview,
      bankCounts,
      banks,
      earliestDate,
    ] = await Promise.all([
      context.trpcClient.transactions.globalStats.query({
        dateFrom: deps.dateFrom,
        dateTo: deps.dateTo,
        bank: deps.bank,
      }),
      context.trpcClient.transactions.budgetStats.query({
        dateFrom: deps.dateFrom,
        dateTo: deps.dateTo,
        bank: deps.bank,
      }),
      // Keep the full expense breakdown regardless of the table's content filters.
      context.trpcClient.categories.overview.query({
        ...period,
        direction: "debit",
      }),
      context.trpcClient.transactions.bankCounts.query(deps),
      context.trpcClient.transactions.banks.query(),
      context.trpcClient.transactions.earliestDate.query(),
    ]);

    return {
      globalStats,
      budgetStats,
      overview,
      bankCounts,
      banks,
      earliestDate,
    };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger la revue du mois.</p>
      <pre className="text-muted text-control mt-4">{error.message}</pre>
    </main>
  ),
  component: RevueLayout,
});

function RevueLayout() {
  const { globalStats, budgetStats, overview } = Route.useLoaderData();
  const isTable =
    useRouterState({ select: (s) => s.location.pathname }) === "/transactions";

  return (
    <div className="flex w-full flex-col gap-4 self-start md:flex-row md:self-stretch">
      <div className="flex min-w-0 flex-col md:min-h-0 md:flex-1">
        <div className="flex min-h-17 flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
          <div className="min-w-0 flex-1">
            <KpiBand globalStats={globalStats} budgetStats={budgetStats} />
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 md:min-h-0 md:flex-1">
          <OverviewHeader overview={overview} />
          <Outlet />
        </div>
      </div>
      <div
        className={cn(
          "overflow-hidden md:w-80 md:shrink-0",
          isTable && "hidden md:block",
        )}
      >
        <BreakdownList overview={overview} />
      </div>
    </div>
  );
}
