import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/api/schemas";
import {
  defaultToCurrentMonth,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";

import { BreakdownList } from "./-components/breakdown-list";
import { KpiBand } from "./-components/kpi-band";
import { OverviewHeader } from "./-components/overview-header";

/**
 * Coque des écrans de la revue : en-tête persistant et bandeau de tête, autour
 * de l'écran courant (l'anneau sur `/`, la table sur `/transactions`). Hauteur
 * fixée au viewport, chaque volet scrollant pour son compte.
 *
 * **Le bandeau est ici et non dans les routes** : les deux écrans en disent
 * désormais la même chose, sur le même périmètre — celui de la revue.
 * `/transactions` affichait auparavant les totaux de la *sélection*
 * (`transactions.totals`, tous filtres appliqués) sous le libellé « Solde de la
 * sélection » ; ils ont été retirés avec `historyScope` et `CategorySideList`.
 * Conséquence assumée : filtrer une catégorie ne bouge plus les chiffres du
 * bandeau, il décrit le mois entier pendant que la table décrit la sélection.
 *
 * La **colonne des postes**, elle, est montée par chaque écran : sur `/` un clic
 * sur une de ses lignes fait descendre l'anneau, geste qu'elle ne pourrait pas
 * commander d'ici (voir `RevuePanel`). Le layout lui fournit ses données —
 * `categories` — et rien d'autre.
 *
 * Le périmètre est `wholePeriod` : `category` et la recherche en
 * sont retirés, sinon filtrer un poste le porterait à 100 % de sa propre
 * répartition et il n'y aurait plus de quoi naviguer. Ne restent que la période
 * et les comptes ; le sens de `/transactions` ne commande rien non plus, la
 * répartition forçant le sien (`debit`).
 *
 * La search vit sur ce layout et non plus sur chaque route : c'est ce qui permet
 * au `loaderDeps` ci-dessous d'exister, donc au loader de porter les agrégats
 * partagés. Les routes filles n'ont plus à la déclarer — mais elles restent
 * tenues d'être compatibles avec `transactionsSearchSchema`, l'en-tête et la
 * colonne le lisant via `useSearch({ strict: false })`.
 */
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
      // `wholePeriod` et non `deps` : le périmètre de la revue est la
      // période et les comptes, jamais le poste filtré — sinon l'anneau
      // porterait le poste ouvert à 100 % de sa propre répartition. La
      // requête ignore `category` et `q` aujourd'hui, mais c'est un accident
      // et non une propriété : maintenant qu'elle est la seule source de
      // l'anneau, le périmètre se pose ici.
      //
      // Le sens `debit` est forcé : sans lui un seul mois de salaires écrase
      // l'échelle et tous les postes de dépense s'affaissent à un moignon
      // indistinct (mesuré : `Revenus` à 4 000 € contre 99 € pour le plus
      // gros poste de sortie).
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
      <pre className="text-subtle text-control mt-4">{error.message}</pre>
    </main>
  ),
  component: RevueLayout,
});

function RevueLayout() {
  const { globalStats, budgetStats, overview } = Route.useLoaderData();

  return (
    <div className="flex w-full gap-4">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous
            460 px : il évite que la colonne de droite, à largeur fixe, ne pousse
            le solde hors de l'écran sur une fenêtre étroite. */}
        <div className="flex min-h-17 flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
          <div className="min-w-0 flex-1">
            <KpiBand globalStats={globalStats} budgetStats={budgetStats} />
          </div>
        </div>

        {/* Chaque écran rend son contenu **et** sa colonne des postes. */}
        <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2">
          <OverviewHeader overview={overview} />
          <Outlet />
        </div>
      </div>
      <div className="w-80 shrink-0 overflow-hidden">
        <BreakdownList overview={overview} />
      </div>
    </div>
  );
}
