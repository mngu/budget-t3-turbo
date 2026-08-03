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
    const [result, totals, review] = await Promise.all([
      context.trpcClient.transactions.list.query(deps),
      // Totaux de la *sélection* — tous filtres appliqués, contrairement aux
      // tuiles de la revue qui parlent, elles, de la période entière. Montant
      // *et* nombre de lignes par sens, comme les deux tuiles les affichent.
      context.trpcClient.transactions.totals.query(deps),
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
    return {
      ...result,
      totals,
      flagged: review.map((item) => item.id),
    };
  },
  component: ToutesLesTransactions,
});

const countFr = new Intl.NumberFormat("fr-FR");

const AMOUNT_CLASS =
  "num mt-0.5 text-[clamp(24px,2.4vw,30px)] leading-[1.1] font-medium tracking-[-0.03em]";

/**
 * Largeur fixe des trois tuiles. La maquette les laisse se dimensionner sur leur
 * contenu, ce qui fait glisser les deux totaux horizontalement à chaque
 * changement de filtre : le rappel de filtres n'a pas la largeur de « toutes les
 * lignes de la période », et un montant en perd ou en gagne à chaque chiffre.
 *
 * 224 px (`w-56`) couvre les deux contenus les plus larges mesurés à la taille
 * haute du clamp : un montant à cinq chiffres (« 12 345,67 € », 198 px) et le
 * rappel de filtres suivi de la pagination (222 px). Au-delà, la sous-ligne
 * coupe — son texte entier reste dans le `title` — tandis que le montant
 * déborde sur la gouttière : un montant tronqué se lirait de travers.
 */
const TILE_CLASS = "w-56 max-w-full flex-none";

function ToutesLesTransactions() {
  const { rows, total, totals, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filters = describeFilters(search);
  // Une seule chaîne, et non deux `<span>` : c'est elle que la tuile coupe à sa
  // largeur, et qu'elle redonne entière au survol.
  const scope = [
    filters.length > 0
      ? filters.join(" · ")
      : "toutes les lignes de la période",
    pageCount > 1 ? `page ${search.page} sur ${pageCount}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(" · ");

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5">
      <div className="flex min-h-[68px] flex-none flex-wrap items-end gap-x-[clamp(11px,1.9vw,32px)] gap-y-3">
        <div className={TILE_CLASS}>
          <div className="label-caps">Transactions</div>
          <div className={AMOUNT_CLASS}>{countFr.format(total)}</div>
          {/* La maquette met ici « sur N lignes », rapporté au total *non
              filtré* — la table n'en charge pas d'autre que la sélection. À la
              place : ce que la sélection est, et où on en est dedans, la
              pagination vivant sinon tout en bas du conteneur défilant. */}
          <div
            title={scope}
            className="text-subtle mt-1.5 min-h-[19px] truncate text-[11px]"
          >
            {scope}
          </div>
        </div>

        <Total label="Débits" totals={totals.debit} className="text-bad" />
        <Total label="Crédits" totals={totals.credit} className="text-ok" />
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
 * Les deux totaux de la sélection, montant et nombre de lignes. Le décompte
 * vient de `transactions.totals`, qui groupe la sélection par sens : ni
 * `byCategory` (des montants seulement) ni le `total` de `list` (qui ignore le
 * sens) ne pouvaient le donner. La sous-ligne garde la hauteur de celle de la
 * première tuile, qui aligne les trois chiffres.
 */
function Total({
  label,
  totals,
  className,
}: {
  label: string;
  totals: { total: number; count: number };
  className: string;
}) {
  return (
    <div className={TILE_CLASS}>
      <div className="label-caps">{label}</div>
      <div className={cn(AMOUNT_CLASS, className)}>
        {euro.format(totals.total)}
      </div>
      <div className="text-subtle mt-1.5 flex min-h-[19px] items-center text-[11px] whitespace-nowrap">
        {countFr.format(totals.count)} {totals.count > 1 ? "lignes" : "ligne"}
      </div>
    </div>
  );
}
