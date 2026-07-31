import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";

import type { Delta, EpureeCategory } from "./-components/epuree-panel";
import {
  averagesByCategory,
  compareToAverage,
  totalsByMonth,
} from "~/lib/history";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { EpureePanel } from "./-components/epuree-panel";

/**
 * Page de test — portage de la maquette « Revue du mois épurée »
 * (Claude Design, projet fc13100e-7ea1-4dac-8d2f-6614e40a7209, importée le
 * 2026-07-31). Elle ne remplace rien : `/` reste la revue en service.
 *
 * Sous le layout `_revue`, donc sous `AppHeader` : la maquette pose bien un
 * en-tête réduit (marque, mois, thème), mais l'écran vit dans la même coque que
 * les quatre autres et sa search est `transactionsSearchSchema` — la condition
 * que pose le layout. Aucun onglet ne pointe dessus, on y arrive par l'URL.
 *
 * Trois branches de la maquette ne sont pas portées : elles y sont **mortes**,
 * pas oubliées. `mode` est fixé à `'anneau'` (tout le pavage/treemap et la
 * bascule des deux vues sont inatteignables), `sv` est fixé à `'liste'`, et le
 * booléen `montants` ne nourrit que les tuiles du pavage. `ecarts`,
 * `reviewCount` et `reviewDots` sont calculés dans le script mais jamais liés
 * au template — ce dernier n'a d'ailleurs aucun équivalent en base (pas de
 * score de confiance, voir CLAUDE.md).
 *
 * L'anneau interne de sous-catégories de la maquette n'est pas porté non plus,
 * lui pour une raison de fond : elle ne l'affiche qu'*à la place* de la liste,
 * quand celle-ci ne tient plus en largeur. Ici la liste — le même histogramme
 * horizontal qu'en grand — reste affichée à toutes les largeurs, sous l'anneau
 * plutôt qu'à côté. Un second anneau ne dirait rien de plus et se lit moins bien.
 */
export const Route = createFileRoute("/_authed/_revue/revue-epuree")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    // Même règle que la revue : les filtres de contenu sont retirés des
    // agrégats, l'anneau garde la répartition complète et se contente de
    // surligner ce qui est sélectionné.
    const period = wholePeriod(deps);
    const [expenses, revenues, history, tree] = await Promise.all([
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "debit",
      }),
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "credit",
      }),
      context.trpcClient.transactions.history.query(period),
      // Les icônes de l'anneau : `transactions.byCategory` ne remonte que le
      // libellé et la couleur, `categories.icon` vit dans l'arborescence. Lue
      // par le client tRPC, à la différence des trois `fetchQuery` qui suivent :
      // ceux-là n'alimentent que le cache react-query dont se sert l'en-tête
      // partagé (badge « À revoir », sélecteur de comptes), comme sur les
      // quatre autres écrans du layout.
      context.trpcClient.categories.tree.query(),
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
    ]);
    return { expenses, revenues, history, tree };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger la revue.</p>
      <pre className="text-subtle mt-4 text-xs">{error.message}</pre>
    </main>
  ),
  component: RevueEpuree,
});

const sum = (items: { total: number }[]) =>
  items.reduce((acc, item) => acc + item.total, 0);

// Écart à la moyenne, tel que la maquette le calcule : le pourcentage se
// rapporte à la *valeur absolue* de la référence, sinon une moyenne négative
// (le solde d'un mois déficitaire) inverse le signe affiché. `null` quand il
// n'y a pas d'historique ; `pct` seul est `null` quand la référence vaut zéro —
// l'écart en euros reste lisible, le pourcentage n'aurait aucun sens.
function deltaTo(current: number, average: number | null): Delta | null {
  if (average === null) return null;
  const amount = current - average;
  return {
    amount,
    pct: average === 0 ? null : (amount / Math.abs(average)) * 100,
  };
}

function RevueEpuree() {
  const { expenses, revenues, history, tree } = Route.useLoaderData();
  const search = Route.useSearch();

  const expensesTotal = sum(expenses);
  const revenuesTotal = sum(revenues);

  // Même ancre que la revue : la fin de la période affichée, sur laquelle
  // `history` est bâti côté serveur.
  const anchor = search.dateTo ?? search.dateFrom ?? new Date().toISOString();
  const monthly = totalsByMonth(history);
  const revenuesAverage = compareToAverage(
    monthly,
    anchor,
    (m) => m.credit,
    revenuesTotal,
  ).average;
  const expensesAverage = compareToAverage(
    monthly,
    anchor,
    (m) => m.debit,
    expensesTotal,
  ).average;

  const iconByCategory = new Map(tree.map((node) => [node.name, node.icon]));
  const averageByCategory = averagesByCategory(history, anchor, (r) => r.debit);

  const categories: EpureeCategory[] = [...expenses]
    .sort((a, b) => b.total - a.total)
    .map((item) => {
      // `transactions.byCategory` regroupe les transactions sans catégorie sous
      // un libellé vide ; `history` les remonte à `null`. La clé de jointure est
      // la chaîne vide des deux côtés (voir `averagesByCategory`), le libellé
      // affiché est celui de la revue.
      const key = item.category;
      return {
        name: key || "Sans catégorie",
        total: item.total,
        color: item.color,
        icon: iconByCategory.get(key) ?? null,
        subs: item.breakdown.map((b) => ({ name: b.category, total: b.total })),
        // Une catégorie absente de toute la fenêtre de référence a bien une
        // moyenne de zéro : c'est un poste neuf, pas une donnée manquante.
        delta: averageByCategory
          ? deltaTo(item.total, averageByCategory.get(key) ?? 0)
          : null,
      };
    });

  const balance = revenuesTotal - expensesTotal;
  const balanceAverage =
    revenuesAverage === null || expensesAverage === null
      ? null
      : revenuesAverage - expensesAverage;

  return (
    <EpureePanel
      categories={categories}
      revenues={revenuesTotal}
      expenses={expensesTotal}
      balance={balance}
      revenuesDelta={deltaTo(revenuesTotal, revenuesAverage)}
      expensesDelta={deltaTo(expensesTotal, expensesAverage)}
      balanceDelta={deltaTo(balance, balanceAverage)}
    />
  );
}
