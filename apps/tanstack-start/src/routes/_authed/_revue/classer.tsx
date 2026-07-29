import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";

import type { CategoryBreakdownItem, TransactionRow } from "@budget/api";
import { REVIEW_QUEUE_LIMIT, transactionsSearchSchema } from "@budget/shared";

import { useCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { useCategoryPaths } from "./-components/category-path-picker";
import { ClasserRow } from "./-components/classer-row";
import { RefineBar } from "./-components/refine-bar";
import { SuspectList } from "./-components/suspect-list";

// Assez de lignes pour couvrir plusieurs catégories d'un coup — l'écran ne
// pagine pas, il se vide au fur et à mesure des classements.
const NV_LIMIT = 120;

// Transactions montrées d'emblée par catégorie ; le reste est résumé en pied de
// groupe. Au-delà, la page devient un mur et on ne voit plus les autres familles.
const PER_GROUP = 4;

export const Route = createFileRoute("/_authed/_revue/classer")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [nv, expenses, review] = await Promise.all([
      context.trpcClient.transactions.list.query({
        ...deps,
        page: 1,
        aClasser: true,
        direction: "debit",
        sort: "amount",
        order: "asc",
        limit: NV_LIMIT,
      }),
      context.trpcClient.transactions.byCategory.query({
        ...wholePeriod(deps),
        direction: "debit",
      }),
      // Même entrée de cache que le badge de l'onglet « À revoir » (voir
      // `reviewScope`), d'où le passage par le queryClient.
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
    return { rows: nv.rows, total: nv.total, expenses, review };
  },
  component: Classer,
});

const unallocatedOf = (item: CategoryBreakdownItem) =>
  item.breakdown.find((b) => b.unallocated)?.total ?? 0;

function Classer() {
  const { rows, total, expenses, review } = Route.useLoaderData();
  const search = Route.useSearch();
  const resolveColor = useCategoryColor();
  const paths = useCategoryPaths();

  // Une catégorie n'apparaît que si elle porte encore du à classer ; le filtre
  // de catégorie de la barre du haut restreint en plus à une seule famille.
  const groups = expenses
    .filter(
      (item) =>
        unallocatedOf(item) > 0 &&
        (!search.category || item.category === search.category),
    )
    .sort((a, b) => unallocatedOf(b) - unallocatedOf(a));

  const nvTotal = expenses.reduce((acc, item) => acc + unallocatedOf(item), 0);
  const suspects = review.filter((item) => item.reason !== "a-classer");
  const rowsByCategory = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const key = row.categoryPath ?? "";
    rowsByCategory.set(key, [...(rowsByCategory.get(key) ?? []), row]);
  }

  return (
    // Une seule colonne : le rail « à classer par catégorie » qui occupait la
    // droite redisait les en-têtes de groupe ci-dessous, à un tri près.
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="px-6.5 pt-4.5 pb-7">
        <div className="text-muted-foreground flex items-center gap-2 text-[12.5px]">
          <Link to="/" search={search} className="text-primary">
            Revue du mois
          </Link>
          <span className="text-subtle">›</span>
          <span className="text-foreground font-medium">À revoir</span>
          <Link
            to="/"
            search={search}
            className="border-border text-muted-foreground hover:bg-accent ml-auto rounded-[7px] border px-2.5 py-1 text-xs"
          >
            Retour à la revue
          </Link>
        </div>

        <div className="mt-4">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
            À revoir
          </h1>
          <p className="text-muted-foreground mt-1.5 max-w-[620px] text-[12.5px] text-pretty">
            {euro.format(nvTotal)} rattachés à une catégorie parente sans
            sous-catégorie précise, {suspects.length} classement
            {suspects.length > 1 ? "s" : ""} douteux. Un clic sur une pastille
            range la transaction.
          </p>
        </div>

        <RefineBar
          label="Affiner cette revue"
          className="border-border mt-4 border-t pt-3.5"
          right={
            search.category
              ? `limité à ${search.category}`
              : `${total} transactions à classer`
          }
        />

        <div className="mt-5 flex flex-col gap-3.5">
          {groups.map((group) => {
            const color = resolveColor(group.color);
            const subs = paths.filter(
              (p) => p.parent === group.category && p.name !== group.category,
            );
            const shown = (rowsByCategory.get(group.category) ?? []).slice(
              0,
              PER_GROUP,
            );
            const rest = unallocatedOf(group) - shownTotal(shown);

            return (
              <div
                key={group.category}
                className="border-border bg-card overflow-hidden rounded-xl border"
              >
                <div className="border-border flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-3.5 py-2.5">
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{ background: color }}
                  />
                  <span className="text-[12.5px] font-semibold">
                    {group.category}
                  </span>
                  <span className="text-warn text-[11.5px] font-medium">
                    {euro.format(unallocatedOf(group))} à classer
                  </span>
                  <Link
                    to="/categorie/$name"
                    params={{ name: group.category }}
                    search={search}
                    className="text-subtle hover:text-primary ml-auto text-[11.5px]"
                  >
                    Voir la catégorie ›
                  </Link>
                </div>

                {shown.map((row) => (
                  <ClasserRow key={row.id} row={row} suggestions={subs} />
                ))}

                {subs.length === 0 ? (
                  <p className="text-muted-foreground px-3.5 py-2.5 text-[11.5px]">
                    Cette catégorie n'a aucune sous-catégorie définie.{" "}
                    <Link to="/categories" className="text-primary">
                      En créer une
                    </Link>{" "}
                    pour pouvoir classer ses {euro.format(unallocatedOf(group))}
                    .
                  </p>
                ) : (
                  rest > 0.005 && (
                    <p className="text-subtle px-3.5 py-2 text-[11.5px]">
                      {euro.format(rest)} encore à classer dans {group.category}
                      .
                    </p>
                  )
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-[12.5px]">
              Rien à classer sur ce périmètre.
            </p>
          )}
        </div>

        {/* Le motif `a-classer` est retiré : ces transactions sont déjà
            au-dessus, groupées par catégorie. Sans ce partage, la même ligne
            apparaîtrait deux fois sur un seul écran. */}
        <SuspectList
          items={suspects}
          truncated={review.length >= REVIEW_QUEUE_LIMIT}
        />
      </div>
    </div>
  );
}

const shownTotal = (rows: TransactionRow[]) =>
  rows.reduce((acc, row) => acc + Number(row.amount), 0);
