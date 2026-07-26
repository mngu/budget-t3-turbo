import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/validators";

import { euro } from "~/lib/format";
import { CategoryPieChart } from "./-components/category-pie-chart";
import { KpiCard } from "./-components/kpi-card";
import { TransactionsFilters } from "./-components/transactions-filters";
import { TransactionsHeader } from "./-components/transactions-header";
import { TransactionsPagination } from "./-components/transactions-pagination";
import { TransactionsTable } from "./-components/transactions-table";

export const Route = createFileRoute("/_authed/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [
      // @ts-expect-error — @tanstack/react-router@1.135 typing (PickOptional) only accepts
      // truly-optional search keys here; sort/order/page are required-with-.catch() defaults.
      // Runtime behavior is unaffected (all three are still stripped when equal to defaults).
      // Revisit if the router is upgraded to align with the source app's 1.170.x.
      stripSearchParams({ page: 1, sort: "date", order: "desc" }),
    ],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [result, expensesByCategory, revenuesByCategory] = await Promise.all([
      context.trpcClient.transactions.list.query(deps),
      context.trpcClient.transactions.byCategory.query({
        ...deps,
        direction: "debit",
      }),
      context.trpcClient.transactions.byCategory.query({
        ...deps,
        direction: "credit",
      }),
      // Ni les banques ni l'arborescence ne sont retournées : leurs Select
      // les lisent dans le cache react-query. Le loader les y (re)met à
      // chaque passage, ce qui fait que `router.invalidate()` suffit à les
      // rafraîchir après une mutation — voir CategoryTreeSelect.
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.banks.queryOptions(),
        staleTime: 0,
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.categories.tree.queryOptions(),
        staleTime: 0,
      }),
    ]);
    return { ...result, expensesByCategory, revenuesByCategory };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger les transactions.</p>
      <p className="text-sm opacity-70">
        Vérifiez que PostgreSQL tourne (docker compose up -d) et que l'import a
        été fait (bouton Synchroniser).
      </p>
      <pre className="mt-4 text-xs opacity-50">{error.message}</pre>
    </main>
  ),
  component: TransactionsPage,
});

const sumTotals = (items: { total: number }[]) =>
  items.reduce((acc, item) => acc + item.total, 0);

function TransactionsPage() {
  const { rows, total, expensesByCategory, revenuesByCategory } =
    Route.useLoaderData();

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-8">
      <TransactionsHeader />
      <TransactionsFilters />
      <div className="flex gap-4">
        <KpiCard
          title="Total dépenses"
          value={euro.format(sumTotals(expensesByCategory))}
        />
        <KpiCard
          title="Total revenues"
          value={euro.format(sumTotals(revenuesByCategory))}
        />
      </div>
      <div className="flex gap-4">
        <CategoryPieChart
          title="Répartition des dépenses par catégorie"
          data={expensesByCategory}
        />
        <CategoryPieChart
          title="Répartition des revenues par catégorie"
          data={revenuesByCategory}
        />
      </div>
      <TransactionsTable rows={rows} total={total} />
      <TransactionsPagination total={total} />
    </main>
  );
}
