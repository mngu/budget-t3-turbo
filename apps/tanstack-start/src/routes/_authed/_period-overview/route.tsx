import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";

import type { RevueCategory } from "./-lib/revue-categories";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { NewKpiBand } from "~/routes/_authed/_period-overview/-components/new-kpi-band";
import { BreakdownList } from "./-components/breakdown-list";
import { averagesByCategory, deltaTo } from "./-lib/history";
import { attachBudgets } from "./-lib/revue-budgets";

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
 * Le périmètre est `wholePeriod` : `category`, `aClasser` et la recherche en
 * sont retirés, sinon filtrer un poste le porterait à 100 % de sa propre
 * répartition et il n'y aurait plus de quoi naviguer. Ne restent que la période
 * et les comptes ; le sens de `/transactions` ne commande rien non plus, les
 * agrégats forçant leur propre sens (`byCategory`) ou le neutralisant
 * (`monthlyHistory`).
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
      expenses,
      history,
      tree,
      plan,
      breakdownByCategories,
      globalStats,
      budgetStats,
    ] = await Promise.all([
      // `direction: "debit"` forcé, comme la maquette : sans lui un seul mois de
      // salaires écrase l'échelle et tous les postes de dépense s'affaissent à un
      // moignon indistinct (mesuré : `Revenus` à 4 000 € contre 99 € pour le plus
      // gros poste de sortie). Deux conséquences voulues — l'anneau et la colonne
      // répondent à « où part l'argent » et non « qu'affiche la table », et les
      // catégories d'entrée n'y figurent pas : la modale « Filtrer par catégorie »
      // de `RefineBar`, qui liste les deux sens, reste la voie pour les atteindre.
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "debit",
      }),
      context.trpcClient.transactions.history.query(period),
      // Les icônes des postes : `transactions.byCategory` ne remonte que le
      // libellé et la couleur, `categories.icon` vit dans l'arborescence. Lue par
      // le client tRPC, à la différence des `fetchQuery` qui suivent : ceux-là
      // n'alimentent que le cache react-query dont se servent l'en-tête (badge
      // « À revoir », sélecteur de comptes) et les routes filles.
      context.trpcClient.categories.tree.query(),
      // Les budgets mensuels de `/budgets`, que la revue compare désormais à la
      // dépense de la période (maquette du 2026-08-06). Sans dimension de
      // période côté serveur : c'est `attachBudgets` qui les multiplie par le
      // nombre de mois affichés, ou écarte la comparaison.
      context.trpcClient.categories.budgets.plan.query(),
      context.trpcClient.transactions.breakdownByCategories.query(deps),
      context.trpcClient.transactions.globalStats.query(deps),
      context.trpcClient.transactions.budgetStats.query(deps),

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
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.banks.queryOptions(),
        staleTime: 0,
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.breakdownByCategories.queryOptions(deps),
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.globalStats.queryOptions(deps),
      }),
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.budgetStats.queryOptions(deps),
      }),
    ]);

    const expensesTotal = sum(expenses);

    // Ancre de comparaison : la fin de la période affichée, sur laquelle
    // `history` est bâti côté serveur — les deux ne peuvent pas diverger.
    const anchor = deps.dateTo ?? deps.dateFrom ?? new Date().toISOString();

    const iconByCategory = new Map(tree.map((node) => [node.name, node.icon]));
    const averageByCategory = averagesByCategory(
      history,
      anchor,
      (r) => r.debit,
    );

    // L'arborescence des postes est construite ici, dans le loader, plutôt que
    // dans le composant : `/` en a besoin pour l'anneau et le layout pour la
    // colonne, et un enfant ne peut lire que les *données* de son parent.
    const base: RevueCategory[] = [...expenses]
      .sort((a, b) => b.total - a.total)
      .map((item) => {
        // `transactions.byCategory` regroupe les transactions sans catégorie sous
        // un libellé vide ; `history` les remonte à `null`. La clé de jointure est
        // la chaîne vide des deux côtés (voir `averagesByCategory`), le libellé
        // affiché est celui de la revue.
        const key = item.category;
        return {
          name: key || "Sans catégorie",
          // Sentinelle du search param : le groupe sans rattachement se filtre
          // par « none », pas par la chaîne vide ni par son libellé d'affichage.
          filter: key || "none",
          total: item.total,
          color: item.color,
          icon: iconByCategory.get(key) ?? null,
          subs: item.breakdown.map((b) => ({
            name: b.category,
            total: b.total,
            // Le segment « À classer » est fabriqué par `byCategory` (le reliquat
            // porté par la parente) : son libellé ne correspond à aucune ligne de
            // `categories`, aucun filtre ne peut le désigner.
            filter: b.unallocated ? null : b.category,
            budget: null,
          })),
          // Posés par `attachBudgets` juste après : la comparaison au budget
          // dépend de la période et des comptes, pas de la répartition.
          budget: null,
          covered: 0,
          // Une catégorie absente de toute la fenêtre de référence a bien une
          // moyenne de zéro : c'est un poste neuf, pas une donnée manquante.
          delta: averageByCategory
            ? deltaTo(item.total, averageByCategory.get(key) ?? 0)
            : null,
        };
      });

    const { categories } = attachBudgets(base, {
      tree,
      plan,
      expenses: expensesTotal,
      search: deps,
    });

    return {
      categories,
      expenses: expensesTotal,
      breakdownByCategories,
      globalStats,
      budgetStats,
    };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger la revue du mois.</p>
      <p className="text-muted-foreground text-body">
        Vérifiez que PostgreSQL tourne (docker compose up -d) et que l'import a
        été fait (bouton Synchroniser).
      </p>
      <pre className="text-subtle text-control mt-4">{error.message}</pre>
    </main>
  ),
  component: RevueLayout,
});

const sum = (items: { total: number }[]) =>
  items.reduce((acc, item) => acc + item.total, 0);

function RevueLayout() {
  const { breakdownByCategories, globalStats, budgetStats } =
    Route.useLoaderData();

  return (
    <div className="flex w-full gap-4">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous
            460 px : il évite que la colonne de droite, à largeur fixe, ne pousse
            le solde hors de l'écran sur une fenêtre étroite. */}
        <div className="flex min-h-17 flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
          <div className="min-w-0 flex-1">
            <NewKpiBand globalStats={globalStats} budgetStats={budgetStats} />
            {/*<KpiBand
              label="Solde du mois"
              balance={balance}
              balanceDelta={balanceDelta}
              // Les deux rangées de flux restent affichées quand un poste
              // s'ouvre (`showFlow: true` dans la maquette depuis le passage du
              // poste ouvert en colonne à part) : le solde et les deux flux
              // décrivent le mois, le poste vient à côté et non à leur place.
              flow={{
                revenues: { amount: revenues, delta: revenuesDelta },
                expenses: { amount: expenses, delta: expensesDelta },
              }}
              // Troisième rangée du bandeau depuis la maquette du 2026-08-06 :
              // la dépense du mois contre l'enveloppe de `/budgets`. Elle
              // apparaît donc aussi sur `/transactions`, qui monte le même
              // bandeau — c'est ce que fait `Transactions.dc.html`.
              budget={budgets}
            />*/}
          </div>
        </div>

        {/* Chaque écran rend son contenu **et** sa colonne des postes. */}
        <div className="mt-3 flex min-h-0 flex-1 gap-5">
          <Outlet />
        </div>
      </div>
      <div className="w-80">
        <BreakdownList breakdownByCategories={breakdownByCategories} />
      </div>
    </div>
  );
}
