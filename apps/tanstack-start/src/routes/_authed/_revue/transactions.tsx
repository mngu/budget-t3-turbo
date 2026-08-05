import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { PAGE_SIZE } from "@budget/shared";

import { useCategoryColor } from "~/lib/category-color";
import { reviewScope } from "~/lib/transactions-search";
import { useRevueSearch } from "~/lib/use-revue-search";
import { BreakdownList, breakdownRows } from "./-components/breakdown-list";
import { RefineBar } from "./-components/refine-bar";
import { TransactionsTable } from "./-components/transactions-table";

/**
 * La table complète, et la colonne des postes à sa droite. Le bandeau de tête
 * vient du layout `_revue` : il décrit le mois entier, pas la sélection — les
 * totaux de la sélection (`transactions.totals`, sous le libellé « Solde de la
 * sélection ») ont été retirés le 2026-08-04 au profit des chiffres de la revue.
 * Poser un filtre de catégorie ne bouge donc plus le bandeau ; il replie la
 * colonne sur les sous-catégories du poste, exactement comme sur `/`.
 *
 * La colonne est montée ici et non par le layout : sur `/` un clic sur une de
 * ses lignes commande le niveau de l'anneau, donc un état de l'écran (voir
 * `RevuePanel`). Ici il n'a rien à commander d'autre que le filtre.
 */
export const Route = createFileRoute("/_authed/_revue/transactions")({
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [result, review] = await Promise.all([
      context.trpcClient.transactions.list.query(deps),
      // Une seule entrée de cache pour la file de relecture, partagée avec le
      // badge de l'onglet « À revoir » : `reviewScope` neutralise la pagination,
      // sinon chaque « Suivant » recalculerait le badge (voir son commentaire).
      context.queryClient.fetchQuery({
        ...context.trpc.transactions.review.queryOptions(reviewScope(deps)),
        staleTime: 0,
      }),
    ]);
    return { ...result, flagged: review.map((item) => item.id) };
  },
  component: ToutesLesTransactions,
});

function ToutesLesTransactions() {
  const { rows, total, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Les postes viennent du loader du layout : la colonne et le bandeau lisent la
  // même répartition, elle n'a pas à être chargée deux fois.
  const { categories } = useLoaderData({ from: "/_authed/_revue" });
  const { setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  // Même règle que sur `/` : filtrer une parente replie la colonne sur ses
  // sous-catégories, filtrer une sous-catégorie replie sur celles de sa parente.
  const parent =
    (search.category === undefined
      ? null
      : (categories.find((c) => c.filter === search.category) ??
        categories.find((c) =>
          c.subs.some((s) => s.filter === search.category),
        ))) ?? null;
  const breakdown = breakdownRows(categories, parent, resolveColor).map(
    (row, index) => {
      if (parent) return row;
      const category = categories[index];
      return {
        ...row,
        title: `N'afficher que « ${row.name} »`,
        onSelect: () => setSearch({ category: category?.filter }),
      };
    },
  );

  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Seul écran à porter tous les filtres : c'est le seul dont la liste est
          la sélection elle-même, et non une répartition qu'un filtre de
          catégorie porterait à 100 % du total. C'est aussi la seule voie pour
          retirer le filtre de catégorie ici — la colonne des postes, une fois
          repliée sur les sous-catégories, n'affiche plus la ligne qui le
          porte. */}
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

      <BreakdownList rows={breakdown} fold={parent !== null} />
    </>
  );
}
