import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { PAGE_SIZE } from "@budget/api/schemas";

import { RefineBar } from "./-components/refine-bar";
import { TransactionsTable } from "./-components/transactions-table";

export const Route = createFileRoute("/_authed/_period-overview/transactions")({
  loaderDeps: ({ search }) => search,
  loader: ({ deps, context }) =>
    context.trpcClient.transactions.list.query(deps),
  component: AllTransactions,
});

function AllTransactions() {
  const { rows, total } = Route.useLoaderData();

  const { overview } = useLoaderData({
    from: "/_authed/_period-overview",
  });
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <RefineBar
        overview={overview}
        className="border-border bg-surface-secondary mt-4 flex-none rounded-md border px-2.5 py-2"
      />

      <TransactionsTable
        rows={rows}
        page={search.page}
        pageCount={pageCount}
        total={total}
      />
    </div>
  );
}
