import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";

import type { EpureeCategory } from "./-components/epuree-panel";
import {
  averagesByCategory,
  deltaTo,
  referenceAverage,
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
 * Revue du mois — portage de la maquette « Revue du mois épurée » (Claude
 * Design, projet fc13100e-7ea1-4dac-8d2f-6614e40a7209, importée le 2026-07-31).
 * Elle a vécu sur `/revue-epuree` jusqu'au 2026-08-03, date à laquelle elle a
 * *remplacé* l'ancienne revue (tuiles de synthèse + deux listes de catégories à
 * barres segmentées) : un anneau et une liste dépliable disent la même chose en
 * un écran, et les composants de l'ancienne ont été supprimés avec elle.
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
export const Route = createFileRoute("/_authed/_revue/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    // `category` et `aClasser` sont retirés des agrégats : l'anneau garde la
    // répartition complète et se contente de surligner la sélection, sinon
    // filtrer une catégorie la porterait à 100 % du total et il n'y aurait plus
    // de quoi naviguer.
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
      // trois autres écrans du layout.
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
  const { expenses, revenues, history, tree } = Route.useLoaderData();
  const search = Route.useSearch();

  const expensesTotal = sum(expenses);
  const revenuesTotal = sum(revenues);

  // Ancre de comparaison : la fin de la période affichée, sur laquelle
  // `history` est bâti côté serveur — les deux ne peuvent pas diverger.
  const anchor = search.dateTo ?? search.dateFrom ?? new Date().toISOString();
  const monthly = totalsByMonth(history);
  const revenuesAverage = referenceAverage(monthly, anchor, (m) => m.credit);
  const expensesAverage = referenceAverage(monthly, anchor, (m) => m.debit);

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
        })),
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
