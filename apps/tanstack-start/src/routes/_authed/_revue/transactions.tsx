import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { PAGE_SIZE, transactionsSearchSchema } from "@budget/shared";
import { cn } from "@budget/ui";

import { euro } from "~/lib/format";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
} from "~/lib/transactions-search";
import { describeFilters, RefineBar } from "./-components/refine-bar";
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
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.banks.queryOptions(),
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

const countFr = new Intl.NumberFormat("fr-FR");

const AMOUNT_CLASS =
  "num mt-0.5 text-[clamp(24px,2.4vw,30px)] leading-[1.1] font-medium tracking-[-0.03em]";

function ToutesLesTransactions() {
  const { rows, total, debits, credits, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = describeFilters(search);

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5">
      <div className="flex min-h-[68px] flex-none flex-wrap items-end gap-x-[clamp(11px,1.9vw,32px)] gap-y-3">
        <div className="min-w-max flex-[0_1_auto]">
          <div className="label-caps">Transactions</div>
          <div className={AMOUNT_CLASS}>{countFr.format(total)}</div>
          {/* La maquette met ici « sur N lignes », rapporté au total *non
              filtré* — la table n'en charge pas d'autre que la sélection. À la
              place : ce que la sélection est, et où on en est dedans, la
              pagination vivant sinon tout en bas du conteneur défilant. */}
          <div className="text-subtle mt-1.5 flex min-h-[19px] items-center gap-2.5 text-[11px] whitespace-nowrap">
            <span>
              {filters.length > 0
                ? filters.join(" · ")
                : "toutes les lignes de la période"}
            </span>
            {pageCount > 1 && (
              <span>
                · page {search.page} sur {pageCount}
              </span>
            )}
          </div>
        </div>

        <Total label="Débits" amount={debits} className="text-bad" />
        <Total label="Crédits" amount={credits} className="text-ok" />
      </div>

      {/* Seul écran à porter tous les filtres : c'est le seul dont la liste est
          la sélection elle-même, et non une répartition qu'un filtre de
          catégorie porterait à 100 % du total. */}
      <RefineBar
        sens
        aClasser
        searchField
        className="border-border bg-surface-2 mt-3 flex-none rounded-[11px] border px-2.5 py-2"
      />

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

/**
 * Les deux totaux de la sélection. Sans sous-ligne, là où la maquette compte
 * « N lignes » par sens : aucune requête ne remonte ce décompte — `byCategory`
 * agrège des montants, et le `total` de `list` ne connaît pas le sens. La
 * hauteur minimale de la rangée garde malgré tout les trois chiffres alignés.
 */
function Total({
  label,
  amount,
  className,
}: {
  label: string;
  amount: number;
  className: string;
}) {
  return (
    <div className="min-w-max flex-[0_1_auto]">
      <div className="label-caps">{label}</div>
      <div className={cn(AMOUNT_CLASS, className)}>{euro.format(amount)}</div>
    </div>
  );
}
