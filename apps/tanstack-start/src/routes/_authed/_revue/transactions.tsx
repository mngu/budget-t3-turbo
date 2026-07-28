import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { PAGE_SIZE, transactionsSearchSchema } from "@budget/shared";

import { euro } from "~/lib/format";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
} from "~/lib/transactions-search";
import { TransactionsTable } from "./-components/transactions-table";

export const Route = createFileRoute("/_authed/_revue/transactions")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [result, debits, credits, review] = await Promise.all([
      context.trpcClient.transactions.list.query(deps),
      // Totaux de la *sélection* — tous filtres appliqués, contrairement aux
      // tuiles de la revue qui parlent, elles, de la période entière.
      //
      // Le sens forcé écrase celui de la recherche : sans le court-circuit,
      // filtrer « Débit » affichait quand même le total des crédits du mois,
      // à côté d'un compte de lignes qui, lui, n'en contenait aucune.
      deps.direction === "credit"
        ? []
        : context.trpcClient.transactions.byCategory.query({
            ...deps,
            direction: "debit",
          }),
      deps.direction === "debit"
        ? []
        : context.trpcClient.transactions.byCategory.query({
            ...deps,
            direction: "credit",
          }),
      // Une seule entrée de cache pour la file de relecture, partagée avec le
      // badge de l'onglet « À revoir » : `reviewScope` neutralise la pagination,
      // sinon chaque « Suivant » recalculerait le badge (voir son commentaire).
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.review.queryOptions(reviewScope(deps)),
        staleTime: 0,
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.categories.tree.queryOptions(),
        staleTime: 0,
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.bankCounts.queryOptions(deps),
        staleTime: 0,
      }),
    ]);
    const sum = (items: { total: number }[]) =>
      items.reduce((acc, item) => acc + item.total, 0);
    return {
      ...result,
      debits: sum(debits),
      credits: sum(credits),
      flagged: review.map((item) => item.id),
    };
  },
  component: ToutesLesTransactions,
});

function ToutesLesTransactions() {
  const { rows, total, debits, credits, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="bg-secondary border-border flex flex-none items-center gap-3 border-b px-8 py-3">
        <span className="text-muted-foreground text-[11.5px]">
          {total} transactions · page {search.page} sur {pageCount}
        </span>
        <span className="ml-auto flex items-baseline gap-4.5">
          <span className="text-muted-foreground text-[11.5px]">
            Débits{" "}
            <b className="num text-foreground text-[12.5px]">
              {euro.format(debits)}
            </b>
          </span>
          <span className="text-muted-foreground text-[11.5px]">
            Crédits{" "}
            <b className="num text-ok text-[12.5px]">{euro.format(credits)}</b>
          </span>
        </span>
      </div>

      <TransactionsTable
        rows={rows}
        flagged={new Set(flagged)}
        page={search.page}
        pageCount={pageCount}
        total={total}
      />
    </div>
  );
}
