import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";

import { sharePercent } from "~/lib/format";
import {
  categoryAverages,
  compareToAverage,
  negativeStreak,
  totalsByMonth,
} from "~/lib/history";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { CategoryIncomeList } from "./-components/category-income-list";
import { CategorySpendList } from "./-components/category-spend-list";
import { SummaryTiles } from "./-components/summary-tiles";

export const Route = createFileRoute("/_authed/_revue/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    // `category` et `nvOnly` sont retirés des agrégats : la revue garde la
    // répartition complète et se contente de surligner la sélection, sinon
    // filtrer une catégorie la porterait à 100 % du total et il n'y aurait
    // plus de quoi naviguer.
    const period = wholePeriod(deps);
    const [expenses, revenues, history, review] = await Promise.all([
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "debit",
      }),
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "credit",
      }),
      context.trpcClient.transactions.history.query(period),
      // L'arborescence, les compteurs par banque et la file de relecture ne
      // sont pas retournés tels quels : leurs consommateurs (sélecteur de
      // catégorie, pastilles de la barre de filtres, badge de l'onglet
      // « À revoir ») les lisent dans le cache react-query, que le loader
      // réalimente à chaque passage — `router.invalidate()` suffit donc à les
      // rafraîchir. La file est en plus *lue* ici pour la note de bas des
      // entrées ; c'est bien la même entrée de cache que celle du badge.
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
    return { expenses, revenues, history, review };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger la revue du mois.</p>
      <p className="text-muted-foreground text-sm">
        Vérifiez que PostgreSQL tourne (docker compose up -d) et que l'import a
        été fait (bouton Synchroniser).
      </p>
      <pre className="text-subtle mt-4 text-xs">{error.message}</pre>
    </main>
  ),
  component: RevueDuMois,
});

const sum = (items: { total: number }[]) =>
  items.reduce((acc, item) => acc + item.total, 0);

function RevueDuMois() {
  const { expenses, revenues, history, review } = Route.useLoaderData();
  const search = Route.useSearch();

  const expensesTotal = sum(expenses);
  const revenuesTotal = sum(revenues);
  const unallocated = expenses.reduce(
    (acc, item) =>
      acc + (item.breakdown.find((b) => b.unallocated)?.total ?? 0),
    0,
  );
  const unallocatedCategories = expenses.filter((item) =>
    item.breakdown.some((b) => b.unallocated),
  ).length;

  // Ancre de comparaison : la fin de la période affichée. `history` est bâti
  // sur la même ancre côté serveur, les deux ne peuvent pas diverger.
  const anchor = search.dateTo ?? search.dateFrom ?? new Date().toISOString();
  const monthly = totalsByMonth(history);

  return (
    // Pleine largeur : la file de relecture qui occupait la colonne de droite
    // a son propre onglet (« À revoir », /ventiler). La revue redevient une
    // lecture — sorties, puis entrées — et la correction se fait à côté.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-[1500px] px-6 pt-5 pb-10">
        <SummaryTiles
          expenses={expensesTotal}
          revenues={revenuesTotal}
          expensesComparison={compareToAverage(
            monthly,
            anchor,
            (m) => m.debit,
            expensesTotal,
          )}
          revenuesComparison={compareToAverage(
            monthly,
            anchor,
            (m) => m.credit,
            revenuesTotal,
          )}
          negativeMonths={negativeStreak(
            monthly,
            anchor,
            revenuesTotal - expensesTotal,
          )}
          unallocated={unallocated}
          unallocatedShare={sharePercent(unallocated, expensesTotal)}
          unallocatedCategories={unallocatedCategories}
        />

        <CategorySpendList
          items={expenses}
          total={expensesTotal}
          averages={categoryAverages(history, monthly, anchor)}
        />

        <CategoryIncomeList
          items={revenues}
          total={revenuesTotal}
          oddDirectionCount={
            review.filter((item) => item.reason === "sens-inhabituel").length
          }
        />
      </div>
    </div>
  );
}
