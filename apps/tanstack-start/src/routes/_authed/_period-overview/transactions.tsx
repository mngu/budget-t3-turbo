import { createFileRoute } from "@tanstack/react-router";

import { PAGE_SIZE } from "@budget/shared";

import { reviewScope } from "~/lib/transactions-search";
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
export const Route = createFileRoute("/_authed/_period-overview/transactions")({
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
  component: AllTransactions,
});

function AllTransactions() {
  const { rows, total, flagged } = Route.useLoaderData();
  const search = Route.useSearch();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <RefineBar
        sens
        aClasser
        internes
        searchField
        className="border-border bg-surface-2 mt-4 flex-none rounded-md border px-2.5 py-2"
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
