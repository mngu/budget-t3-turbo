import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";

import type { CategoryBreakdownItem, TransactionRow } from "@budget/api";
import { REVIEW_QUEUE_LIMIT, transactionsSearchSchema } from "@budget/shared";

import {
  hatchedBackground,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";
import {
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { useCategoryPaths } from "./-components/category-path-picker";
import { ReviewCards } from "./-components/review-cards";
import { VentilerRow } from "./-components/ventiler-row";

// Assez de lignes pour couvrir plusieurs catégories d'un coup — l'écran ne
// pagine pas, il se vide au fur et à mesure des ventilations.
const NV_LIMIT = 120;

// Transactions montrées d'emblée par catégorie ; le reste est résumé en pied de
// groupe. Au-delà, la page devient un mur et on ne voit plus les autres familles.
const PER_GROUP = 4;

export const Route = createFileRoute("/_authed/_revue/ventiler")({
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
        nvOnly: true,
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
    ]);
    return { rows: nv.rows, total: nv.total, expenses, review };
  },
  component: Ventiler,
});

const unallocatedOf = (item: CategoryBreakdownItem) =>
  item.breakdown.find((b) => b.unallocated)?.total ?? 0;

function Ventiler() {
  const { rows, total, expenses, review } = Route.useLoaderData();
  const search = Route.useSearch();
  const resolveColor = useCategoryColor();
  const paths = useCategoryPaths();

  // Une catégorie n'apparaît que si elle porte encore du non ventilé ; le filtre
  // de catégorie de la barre du haut restreint en plus à une seule famille.
  const groups = expenses
    .filter(
      (item) =>
        unallocatedOf(item) > 0 &&
        (!search.category || item.category === search.category),
    )
    .sort((a, b) => unallocatedOf(b) - unallocatedOf(a));

  const nvTotal = expenses.reduce((acc, item) => acc + unallocatedOf(item), 0);
  const worst = Math.max(...groups.map(unallocatedOf), 1);
  const rowsByCategory = new Map<string, TransactionRow[]>();
  for (const row of rows) {
    const key = row.categoryPath ?? "";
    rowsByCategory.set(key, [...(rowsByCategory.get(key) ?? []), row]);
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(250px,330px)]">
      <div className="min-w-0 overflow-y-auto px-6.5 pt-4.5 pb-7">
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

        <div className="mt-4 mb-1.5 flex flex-wrap items-end gap-5.5">
          <div>
            <h1 className="text-[26px] font-semibold tracking-[-0.025em]">
              Réduire le non ventilé
            </h1>
            <p className="text-muted-foreground mt-1 max-w-[560px] text-[12.5px]">
              {euro.format(nvTotal)} rattachés à une catégorie parente sans
              sous-catégorie précise. Un clic sur une pastille classe la
              transaction et fait descendre le compteur.
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="num text-[22px] font-medium tracking-[-0.02em]">
              {total}
            </div>
            <div className="text-muted-foreground text-[11.5px]">
              transactions à ventiler
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3.5">
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
                <div className="border-border bg-secondary flex items-center gap-2.5 border-b px-3.5 py-2.5">
                  <span
                    className="size-2.5 rounded-[3px]"
                    style={{ background: color }}
                  />
                  <span className="font-semibold">{group.category}</span>
                  <span className="text-warn bg-warn-soft rounded-[5px] px-1.5 py-px text-[11.5px] font-medium">
                    {euro.format(unallocatedOf(group))} non ventilés
                  </span>
                  <span className="text-subtle text-[11.5px]">
                    {subs.length > 1
                      ? `${subs.length} sous-catégories existantes`
                      : subs.length === 1
                        ? "1 sous-catégorie existante"
                        : "aucune sous-catégorie"}
                  </span>
                  <Link
                    to="/categorie/$name"
                    params={{ name: group.category }}
                    search={search}
                    className="text-primary ml-auto text-[11.5px]"
                  >
                    Voir la catégorie
                  </Link>
                </div>

                {shown.map((row) => (
                  <VentilerRow key={row.id} row={row} suggestions={subs} />
                ))}

                {subs.length === 0 ? (
                  <p className="text-muted-foreground px-3.5 py-2.5 text-[11.5px]">
                    Cette catégorie n'a aucune sous-catégorie définie.{" "}
                    <Link to="/categories" className="text-primary">
                      En créer une
                    </Link>{" "}
                    pour pouvoir ventiler ses{" "}
                    {euro.format(unallocatedOf(group))}.
                  </p>
                ) : (
                  rest > 0.005 && (
                    <p className="text-subtle px-3.5 py-2 text-[11.5px]">
                      {euro.format(rest)} encore non ventilés dans{" "}
                      {group.category}.
                    </p>
                  )
                )}
              </div>
            );
          })}

          {groups.length === 0 && (
            <p className="text-muted-foreground py-10 text-center text-[12.5px]">
              Rien à ventiler sur ce périmètre.
            </p>
          )}
        </div>

        {/* Le motif `non-ventile` est retiré : ces transactions sont déjà
            au-dessus, groupées par catégorie. Sans ce partage, la même ligne
            apparaîtrait deux fois sur un seul écran. */}
        <ReviewCards
          items={review.filter((item) => item.reason !== "non-ventile")}
          truncated={review.length >= REVIEW_QUEUE_LIMIT}
        />
      </div>

      <aside className="border-border bg-sunken overflow-y-auto border-l px-4 py-4.5">
        <div className="label-caps">Non ventilé par catégorie</div>
        <div className="mt-2.5 flex flex-col gap-0.5">
          {groups.map((group) => {
            const color = resolveColor(group.color);
            const nv = unallocatedOf(group);
            return (
              <Link
                key={group.category}
                to="/categorie/$name"
                params={{ name: group.category }}
                search={search}
                className="hover:bg-accent grid grid-cols-[minmax(0,1fr)_84px] items-center gap-2 rounded-lg px-1.5 py-1"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="size-2 flex-none rounded-[2px]"
                    style={{ background: color }}
                  />
                  <span className="truncate text-[11.5px]">
                    {group.category}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="bg-track h-1.5 flex-1 overflow-hidden rounded-full">
                    <span
                      className="block h-full min-w-0.5"
                      style={{
                        width: `${(nv / worst) * 100}%`,
                        background: hatchedBackground(
                          color,
                          softCategoryColor(color),
                        ),
                      }}
                    />
                  </span>
                  <span className="text-subtle num w-[30px] text-right text-[10.5px]">
                    {sharePercent(nv, group.total)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
        <div className="bg-border my-4 h-px" />
        <p className="text-muted-foreground text-[11.5px] leading-relaxed">
          Une catégorie sans aucune sous-catégorie est non ventilée à 100 % : la
          ventiler suppose d'abord d'en créer une depuis{" "}
          <Link to="/categories" className="text-primary">
            la page Catégories
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}

const shownTotal = (rows: TransactionRow[]) =>
  rows.reduce((acc, row) => acc + Number(row.amount), 0);
