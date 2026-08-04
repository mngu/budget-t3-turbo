import {
  createFileRoute,
  Outlet,
  stripSearchParams,
  useRouterState,
} from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";

import type { BreakdownItem } from "./_revue/-components/breakdown-list";
import type { EpureeCategory } from "./_revue/-components/epuree-panel";
import type { HeaderPage } from "~/component/app-header";
import { AppHeader } from "~/component/app-header";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
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
import { useRevueSearch } from "~/lib/use-revue-search";
import { BreakdownList } from "./_revue/-components/breakdown-list";
import { KpiBand, KpiFocus } from "./_revue/-components/kpi-band";
import { CategoryIcon } from "./categories/-components/category-icon";

/**
 * Coque des écrans de la revue : en-tête persistant, bandeau de tête et colonne
 * des postes de sortie, autour de l'écran courant (l'anneau sur `/`, la table
 * sur `/transactions`). Hauteur fixée au viewport, chaque volet scrollant pour
 * son compte.
 *
 * **Le bandeau et la colonne sont ici et non dans les routes** : les deux écrans
 * en disent désormais la même chose, sur le même périmètre — celui de la revue.
 * `/transactions` affichait auparavant les totaux de la *sélection*
 * (`transactions.totals`, tous filtres appliqués) sous le libellé « Solde de la
 * sélection » ; ils ont été retirés avec `historyScope` et `CategorySideList`.
 * Conséquence assumée : filtrer une catégorie ne bouge plus les chiffres du
 * bandeau, il décrit le mois entier pendant que la table décrit la sélection.
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
    const [expenses, revenues, history, tree] = await Promise.all([
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

    return {
      categories,
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
      <p className="text-muted-foreground text-sm">
        Vérifiez que PostgreSQL tourne (docker compose up -d) et que l'import a
        été fait (bouton Synchroniser).
      </p>
      <pre className="text-subtle mt-4 text-xs">{error.message}</pre>
    </main>
  ),
  component: RevueLayout,
});

const sum = (items: { total: number }[]) =>
  items.reduce((acc, item) => acc + item.total, 0);

// Seules les deux routes qu'une icône désigne s'allument.
//
// Lecture du pathname et non `useMatchRoute` : celui-ci compare aussi la search
// et renvoyait `false` sur `/?dateFrom=…`, laissant l'icône éteinte sur sa
// propre page — un échec silencieux, sans erreur ni type qui l'attrape.
//
// Rançon de ce choix : ces chemins doivent suivre à la lettre les `to` des deux
// `NavIcon` d'`AppHeader`, et rien ne le vérifie. Renommer une des deux routes
// sans toucher ici éteint l'icône, silencieusement là encore.
const PAGE_BY_PATH: Record<string, HeaderPage> = {
  "/": "revue",
  "/transactions": "transactions",
};

function RevueLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page = PAGE_BY_PATH[pathname.replace(/\/$/, "") || "/"];

  const {
    categories,
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
  // dispense le bandeau et la colonne de tout état partagé avec l'écran courant —
  // l'anneau garde pour lui seul le *niveau* qu'il affiche (voir `EpureePanel`).
  const parent =
    (search.category === undefined
      ? null
      : (categories.find((c) => c.filter === search.category) ??
        categories.find((c) =>
          c.subs.some((s) => s.filter === search.category),
        ))) ?? null;

  const rows: BreakdownItem[] = parent
    ? // Une sous-catégorie n'a pas de couleur propre : c'est un palier de la
      // teinte de son parent, du plus dense au plus proche de la surface. Lignes
      // de lecture seule — les sous-catégories ne se creusent pas, et sur `/`
      // c'est l'anneau qui les sélectionne.
      parent.subs.map((sub, index) => ({
        name: sub.name,
        total: sub.total,
        color: shadeCategoryColor(
          resolveColor(parent.color),
          index,
          parent.subs.length,
        ),
      }))
    : categories.map((category) => ({
        name: category.name,
        total: category.total,
        color: resolveColor(category.color),
        title: `N'afficher que « ${category.name} »`,
        onSelect: () => setSearch({ category: category.filter }),
      }));

  return (
    // text-[13px] : la base typographique de la maquette. Les tailles fines
    // (11–12,5 px) sont posées au cas par cas, jamais héritées d'un rem global
    // qui décalerait aussi /banques et /categories.
    <div className="flex h-dvh flex-col overflow-hidden text-[13px] leading-[1.45]">
      <AppHeader page={page} />

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5 pb-4">
        {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous
            460 px : il évite que la colonne de droite, à largeur fixe, ne pousse
            le solde hors de l'écran sur une fenêtre étroite. */}
        <div className="flex min-h-[68px] flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
          <div className="min-w-0 flex-1">
            <KpiBand
              label="Solde du mois"
              balance={balance}
              balanceDelta={balanceDelta}
              // Les deux rangées de flux **cèdent la place** au poste ouvert
              // (`showFlow: !parent` dans la maquette) : elles ne se compriment
              // pas à côté de lui. C'est ce qui laisse au poste toute la droite
              // du bandeau, et au solde du mois le seul rôle d'ancre pendant
              // qu'on navigue dans les postes.
              flow={{
                revenues: { amount: revenues, delta: revenuesDelta },
                expenses: { amount: expenses, delta: expensesDelta },
              }}
            />
          </div>

          {parent && (
            <KpiFocus
              label={`${parent.subs.length} sous-catégorie${parent.subs.length > 1 ? "s" : ""}`}
              delta={parent.delta}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="flex flex-none self-center"
                  style={{ color: resolveColor(parent.color) }}
                >
                  <CategoryIcon name={parent.icon} className="size-[15px]" />
                </span>
                <span className="line-clamp-2 min-w-0 text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
                  {parent.name}
                </span>
              </span>
              {/* Deux décimales, comme les lignes de la colonne : ce chiffre-là
                  est un montant précis, pas un ordre de grandeur. */}
              <span className="num min-w-24 flex-none text-right text-[19px] font-medium tracking-[-0.02em]">
                {euro.format(parent.total)}
              </span>
            </KpiFocus>
          )}
        </div>

        <div className="mt-5 flex min-h-0 flex-1 gap-5">
          <Outlet />
          <BreakdownList rows={rows} fold={parent !== null} />
        </div>
      </div>
    </div>
  );
}
