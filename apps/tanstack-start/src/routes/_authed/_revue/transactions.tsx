import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { PAGE_SIZE, transactionsSearchSchema } from "@budget/shared";

import { euro } from "~/lib/format";
import { deltaTo, referenceAverage, totalsByMonth } from "~/lib/history";
import {
  defaultToCurrentMonth,
  historyScope,
  reviewScope,
  SEARCH_DEFAULTS,
} from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategorySideList, sideScope } from "./-components/category-side-list";
import { KpiBand } from "./-components/kpi-band";
import { describeFilters, RefineBar } from "./-components/refine-bar";
import { TransactionsTable } from "./-components/transactions-table";

export const Route = createFileRoute("/_authed/_revue/transactions")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [result, totals, history, review] = await Promise.all([
      context.trpcClient.transactions.list.query(deps),
      // Totaux de la *sélection* — tous filtres appliqués, contrairement à la
      // revue qui parle, elle, de la période entière. Montant *et* nombre de
      // lignes par sens : le bandeau affiche les deux.
      context.trpcClient.transactions.totals.query(deps),
      // Référence des écarts « vs moy. » du bandeau, sur le même périmètre que
      // les totaux ci-dessus (voir `historyScope`).
      context.trpcClient.transactions.history.query(historyScope(deps)),
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
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.banks.queryOptions(),
        staleTime: 0,
      }),
      // Poids des postes de sortie, pour la colonne de droite. La modale
      // « Filtrer par catégorie » interroge le même agrégat sans le sens et
      // reste chargée à l'ouverture : elle liste les deux sens, la colonne non
      // (voir `sideScope`).
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.byCategory.queryOptions(sideScope(deps)),
        staleTime: 0,
      }),
    ]);
    return {
      ...result,
      totals,
      history,
      flagged: review.map((item) => item.id),
    };
  },
  component: ToutesLesTransactions,
});

const countFr = new Intl.NumberFormat("fr-FR");

const lines = (count: number) =>
  `${countFr.format(count)} ${count > 1 ? "lignes" : "ligne"}`;

function ToutesLesTransactions() {
  const { rows, total, totals, history, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Ancre de comparaison : la fin de la période affichée, sur laquelle
  // `history` est bâti côté serveur — les deux ne peuvent pas diverger.
  const anchor = search.dateTo ?? search.dateFrom ?? new Date().toISOString();
  const monthly = totalsByMonth(history);
  const revenuesAverage = referenceAverage(monthly, anchor, (m) => m.credit);
  const expensesAverage = referenceAverage(monthly, anchor, (m) => m.debit);
  const balance = totals.credit.total - totals.debit.total;
  const balanceAverage =
    revenuesAverage === null || expensesAverage === null
      ? null
      : revenuesAverage - expensesAverage;

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5">
      {/* Le solde est celui de la sélection : `transactions.totals` compte des
          magnitudes par sens, le sens vit dans une colonne à part. Les moyennes
          de référence sont scopées sur la même sélection (`historyScope`), sans
          quoi resserrer sur une catégorie comparerait son total à la moyenne de
          toute la base. */}
      <KpiBand
        label="Solde de la sélection"
        balance={balance}
        balanceDelta={deltaTo(balance, balanceAverage)}
        flow={{
          revenues: {
            amount: totals.credit.total,
            delta: deltaTo(totals.credit.total, revenuesAverage),
          },
          expenses: {
            amount: totals.debit.total,
            delta: deltaTo(totals.debit.total, expensesAverage),
          },
        }}
      />

      {/* Hors du bandeau, qui est le portage de la maquette : ce rappel est du
          mobilier d'application, comme `<ActiveFilters>` sur la revue. La
          maquette n'a pas d'emplacement pour lui — son `scopeLabel` est calculé
          mais n'est lié à aucun nœud du template. */}
      <SelectionScope
        total={total}
        page={search.page}
        pageCount={pageCount}
        internal={totals.internal}
      />

      {/* La maquette place la barre de filtres *dans* la colonne de gauche, la
          colonne de droite montant jusqu'en haut de celle-ci. */}
      <div className="mt-2.5 flex min-h-0 flex-1 gap-5">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Seul écran à porter tous les filtres : c'est le seul dont la liste
              est la sélection elle-même, et non une répartition qu'un filtre de
              catégorie porterait à 100 % du total. */}
          <RefineBar
            sens
            aClasser
            internes
            searchField
            className="border-border bg-surface-2 flex-none rounded-[11px] border px-2.5 py-2"
          />

          <TransactionsTable
            rows={rows}
            flagged={new Set(flagged)}
            page={search.page}
            pageCount={pageCount}
            total={total}
          />
        </div>

        {/* La maquette masque cette colonne sous 720 px de conteneur, qu'elle
            mesure ; ici c'est un point d'arrêt, comme partout dans l'app. `xl`
            et non `lg` : la table a cinq colonnes pour 848 px de largeur
            minimale, et sous 1280 px la colonne les lui prendrait. */}
        <CategorySideList className="hidden flex-none xl:flex" />
      </div>
    </div>
  );
}

/**
 * Ce dont parlent les chiffres du bandeau : l'étendue de la sélection, puis ce
 * que ses totaux ne comptent pas.
 *
 * Les virements entre deux comptes suivis sont retirés des totaux mais restent
 * listés — le relevé doit se réconcilier avec ce qu'affiche la banque. C'est
 * cette mention qui rend l'écart lisible ; sans elle, mieux vaudrait ne rien
 * exclure. Elle mène à l'écran d'audit, où l'on vérifie ce qui a été apparié et
 * où l'on écarte un faux positif.
 *
 * Les deux sens sont additionnés en une seule mention : une paire pèse une
 * ligne dans chaque total, et les compter séparément demanderait deux liens vers
 * le même écran. Le chiffre annoncé est donc bien celui des *lignes* écartées,
 * et le libellé le dit.
 */
function SelectionScope({
  total,
  page,
  pageCount,
  internal,
}: {
  total: number;
  page: number;
  pageCount: number;
  internal: {
    debit: { total: number; count: number };
    credit: { total: number; count: number };
  };
}) {
  const { search, setSearch } = useRevueSearch();
  const filters = describeFilters(search);
  const count = internal.debit.count + internal.credit.count;
  const amount = internal.debit.total + internal.credit.total;

  const scope = [
    lines(total),
    filters.length > 0 ? filters.join(" · ") : "sur toute la période",
    pageCount > 1 ? `page ${page} sur ${pageCount}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");

  return (
    <div className="text-subtle mt-2.5 flex flex-none flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
      <span className="min-w-0 truncate" title={scope}>
        {scope}
      </span>
      {count > 0 && (
        <button
          type="button"
          onClick={() => setSearch({ internes: "seulement", page: 1 })}
          title="Voir les virements entre comptes retirés des totaux"
          className="hover:text-foreground underline decoration-dotted underline-offset-2"
        >
          hors {countFr.format(count)} ligne{count > 1 ? "s" : ""} de virement
          interne ({euro.format(amount)})
        </button>
      )}
    </div>
  );
}
