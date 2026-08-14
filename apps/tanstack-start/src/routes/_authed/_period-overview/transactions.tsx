import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";

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
      {/* Le retour à la revue, au même rang que son fil d'ariane : la barre de
            l'application n'a plus de rangée de navigation, les deux écrans se
            renvoient l'un à l'autre depuis leur propre zone centrale. La search
            est conservée telle quelle, c'est le même périmètre. */}
      <div className="flex min-w-0 flex-none items-center gap-3">
        <Link
          to="/"
          search={search}
          title="Revenir à la revue du mois"
          className="border-border bg-card text-muted-foreground hover:border-subtle hover:text-foreground hover:bg-accent text-control flex h-7 flex-none items-center gap-1.5 rounded-full border pr-3 pl-2 font-medium whitespace-nowrap"
        >
          <ArrowLeftIcon className="text-subtle size-3.5" aria-hidden />
          Revue du mois
        </Link>
        <span className="bg-border h-5 w-px flex-none" />
        <span className="text-heading truncate">Transactions</span>
        {/* Le décompte de la sélection, pas celui du mois : `total` est le
              nombre de lignes que les filtres laissent passer, toutes pages
              confondues. Le bandeau au-dessus, lui, décrit le mois entier — les
              deux ne parlent pas du même périmètre, et c'est voulu. */}
        <span className="text-subtle text-control flex-none whitespace-nowrap">
          {total} ligne{total > 1 ? "s" : ""}
        </span>
      </div>

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
