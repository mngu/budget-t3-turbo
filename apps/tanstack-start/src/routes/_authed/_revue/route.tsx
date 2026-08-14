import {
  createFileRoute,
  Outlet,
  stripSearchParams,
} from "@tanstack/react-router";
import { LayersIcon, TriangleAlertIcon } from "lucide-react";

import { transactionsSearchSchema } from "@budget/shared";
import { cn } from "@budget/ui";

import type { RevueCategory } from "~/lib/revue-categories";
import { useCategoryColor } from "~/lib/category-color";
import { euro, euro0 } from "~/lib/format";
import {
  averagesByCategory,
  deltaTo,
  referenceAverage,
  totalsByMonth,
} from "~/lib/history";
import { attachBudgets } from "~/lib/revue-budgets";
import { focusedCategory } from "~/lib/revue-categories";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";
import {
  BREAKDOWN_WIDTH,
  BreakdownList,
  breakdownRows,
} from "~/routes/_authed/_revue/-components/breakdown-list";
import { CategoryIcon } from "../settings/categories/-components/category-icon";
import { KpiBand, KpiFocus } from "./-components/kpi-band";

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
export const Route = createFileRoute("/_authed/_revue")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const period = wholePeriod(deps);
    const [expenses, revenues, history, tree, plan] = await Promise.all([
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
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "credit",
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

    const expensesTotal = sum(expenses);
    const revenuesTotal = sum(revenues);
    const balance = revenuesTotal - expensesTotal;

    // Ancre de comparaison : la fin de la période affichée, sur laquelle
    // `history` est bâti côté serveur — les deux ne peuvent pas diverger.
    const anchor = deps.dateTo ?? deps.dateFrom ?? new Date().toISOString();
    const monthly = totalsByMonth(history);
    const revenuesAverage = referenceAverage(monthly, anchor, (m) => m.credit);
    const expensesAverage = referenceAverage(monthly, anchor, (m) => m.debit);
    const balanceAverage =
      revenuesAverage === null || expensesAverage === null
        ? null
        : revenuesAverage - expensesAverage;

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

    const { categories, budgets } = attachBudgets(base, {
      tree,
      plan,
      expenses: expensesTotal,
      search: deps,
    });

    return {
      categories,
      budgets,
      expenses: expensesTotal,
      balance,
      revenuesDelta: deltaTo(revenuesTotal, revenuesAverage),
      expensesDelta: deltaTo(expensesTotal, expensesAverage),
      balanceDelta: deltaTo(balance, balanceAverage),
      revenues: revenuesTotal,
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
  const {
    categories,
    budgets,
    revenues,
    expenses,
    balance,
    revenuesDelta,
    expensesDelta,
    balanceDelta,
  } = Route.useLoaderData();
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();

  // Le poste ouvert est une fonction pure du search param : filtrer une parente
  // l'ouvre, filtrer une de ses sous-catégories ouvre la parente. C'est ce qui
  // dispense le bandeau de tout état partagé avec l'écran courant — et c'est
  // *la même* expression qui donne à l'anneau le niveau qu'il affiche, d'où la
  // fonction partagée plutôt qu'une seconde copie : les deux ne peuvent pas
  // nommer deux postes différents.
  const parent = focusedCategory(categories, search.category);
  // De quoi habiller l'en-tête de la colonne quand aucun poste n'est ouvert.
  // `filter: null` est le segment fabriqué par `byCategory` — le reliquat porté
  // par la parente : il n'est pas une sous-catégorie de plus, il est ce qui
  // reste à ranger.
  const subs = categories.flatMap((category) => category.subs);
  const subCount = subs.filter((sub) => sub.filter !== null).length;
  const aClasser = subs.reduce(
    (total, sub) => total + (sub.filter === null ? sub.total : 0),
    0,
  );
  const rows = breakdownRows(categories, parent, resolveColor, budgets).map(
    (row, index) => {
      if (parent) return row;
      // Les lignes suivent l'ordre de `categories` : l'index désigne le même
      // poste des deux côtés.
      const category = categories[index];
      // Sans sous-catégorie, la ligne n'est pas une porte : elle reste
      // désactivée plutôt que d'ouvrir sur le vide (voir `selected`).
      if (!category?.subs.length) return row;
      return {
        ...row,
        title: `Voir la répartition de « ${row.name} »`,
        onSelect: () => setSearch({ category: category.filter }),
      };
    },
  );

  return (
    <div className="flex w-full gap-4">
      <div className="flex min-h-0 flex-1 flex-col">
        {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous
            460 px : il évite que la colonne de droite, à largeur fixe, ne pousse
            le solde hors de l'écran sur une fenêtre étroite. */}
        <div className="flex min-h-17 flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
          <div className="min-w-0 flex-1">
            <KpiBand
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
            />
          </div>
        </div>

        {/* Chaque écran rend son contenu **et** sa colonne des postes. */}
        <div className="mt-3 flex min-h-0 flex-1 gap-5">
          <Outlet />
        </div>
      </div>
      <div>
        <div className="h-28 px-2">
          {!parent ? (
            // Aucun poste ouvert : la colonne garde son en-tête plutôt qu'un
            // trou au-dessus des postes, et il dit ce que la liste du dessous
            // détaille. Le reliquat « à classer » n'apparaît qu'à partir du
            // premier euro — sinon la ligne annoncerait un travail à faire là
            // où il n'y en a pas.
            <div
              className={cn(
                BREAKDOWN_WIDTH,
                "flex max-w-full flex-none flex-col items-end",
              )}
            >
              <div className="flex h-8 w-full min-w-0 items-center justify-between gap-4">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="text-subtle flex flex-none self-center">
                    <LayersIcon className="size-4" aria-hidden />
                  </span>
                  <span className="text-subheading min-w-0 truncate leading-[1.15]">
                    Toutes catégories
                  </span>
                </span>
                {/* Sans décimale, à la différence du total d'un poste ouvert :
                    c'est le même nombre que la rangée « Sorties » du bandeau,
                    à deux cents près il se lirait comme un autre. */}
                <span className="num text-amount min-w-24 flex-none text-right font-medium tracking-[-0.02em]">
                  {euro0.format(expenses)}
                </span>
              </div>
              {/* « de dépense » n'est pas de l'ornement : le loader force
                  `direction: "debit"`, la colonne n'inventorie que les sorties —
                  et sur `/transactions`, dont le sélecteur de sens peut être sur
                  « Crédits », rien d'autre ne le dit. */}
              <div className="text-subtle text-meta flex min-h-5 items-center justify-end whitespace-nowrap">
                {categories.length} poste{categories.length > 1 ? "s" : ""} de
                dépense · {subCount} sous-catégorie{subCount > 1 ? "s" : ""}
              </div>
              {aClasser > 0 && (
                <div className="text-warn text-meta mt-2.5 flex items-center gap-1.5 whitespace-nowrap">
                  <TriangleAlertIcon className="size-3" aria-hidden />
                  <span className="num">{euro0.format(aClasser)}</span> à
                  classer
                </div>
              )}
            </div>
          ) : (
            <KpiFocus
              label={`${parent.subs.length} sous-catégorie${parent.subs.length > 1 ? "s" : ""}`}
              delta={parent.delta}
              // Absent quand la revue ne compare pas ; `amount: null` quand
              // c'est ce poste-là qui n'a pas de budget — l'écran le dit plutôt
              // que de laisser un vide sous les autres.
              budget={
                budgets.off
                  ? undefined
                  : {
                      amount: parent.budget,
                      covered: parent.covered,
                      uncovered: parent.total - parent.covered,
                      fill: resolveColor(parent.color),
                    }
              }
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="flex flex-none self-center"
                  style={{ color: resolveColor(parent.color) }}
                >
                  <CategoryIcon name={parent.icon} className="size-4" />
                </span>
                <span className="text-subheading line-clamp-2 min-w-0 leading-[1.15]">
                  {parent.name}
                </span>
              </span>
              {/* Deux décimales, comme les lignes de la colonne : ce chiffre-là
                    est un montant précis, pas un ordre de grandeur. */}
              <span className="num text-amount min-w-24 flex-none text-right font-medium tracking-[-0.02em]">
                {euro.format(parent.total)}
              </span>
            </KpiFocus>
          )}
        </div>
        <div className="flex justify-center">
          <hr className="w-64" />
        </div>
        <BreakdownList rows={rows} fold={parent !== null} />
      </div>
    </div>
  );
}
