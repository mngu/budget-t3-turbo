import {
  createFileRoute,
  Link,
  stripSearchParams,
} from "@tanstack/react-router";

import { transactionsSearchSchema } from "@budget/shared";
import { cn } from "@budget/ui";

import {
  hatchedBackground,
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";
import {
  aggregateDetail,
  defaultToCurrentMonth,
  reviewScope,
  SEARCH_DEFAULTS,
  wholePeriod,
} from "~/lib/transactions-search";
import { CategoryTransactions } from "./-components/category-transactions";
import { ActiveFilters } from "./-components/refine-bar";

// Le zoom ne pagine pas : une catégorie tient sur un écran qui scrolle.
const ZOOM_LIMIT = 120;

export const Route = createFileRoute("/_authed/_revue/categorie/$name")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params, context }) => {
    const period = wholePeriod(deps);
    const [expenses, revenues, list, review] = await Promise.all([
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "debit",
      }),
      // Les catégories d'entrée sont atteignables depuis la liste « Entrées »
      // de la revue : sans cette seconde répartition, le zoom d'un salaire ne
      // trouverait rien et afficherait l'état vide.
      context.trpcClient.transactions.byCategory.query({
        ...period,
        direction: "credit",
      }),
      // Le filtre SQL par catégorie est parent-inclusif : passer le nom du
      // parent remonte aussi les transactions de ses sous-catégories.
      context.trpcClient.transactions.list.query({
        ...aggregateDetail(deps),
        page: 1,
        category: params.name,
        limit: ZOOM_LIMIT,
      }),
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
    // Une catégorie peut porter les deux sens ; c'est celui qui pèse le plus
    // qui décide de quoi la part affichée est un pourcentage.
    const asExpense = expenses.find((e) => e.category === params.name) ?? null;
    const asRevenue = revenues.find((e) => e.category === params.name) ?? null;
    const isIncome =
      asRevenue !== null &&
      (asExpense === null || asRevenue.total > asExpense.total);
    const side = isIncome ? revenues : expenses;
    return {
      item: (isIncome ? asRevenue : asExpense) ?? null,
      isIncome,
      periodTotal: side.reduce((acc, e) => acc + e.total, 0),
      rows: list.rows,
      total: list.total,
      flagged: review.map((r) => r.id),
    };
  },
  component: ZoomCategorie,
});

function ZoomCategorie() {
  const { item, isIncome, periodTotal, rows, total, flagged } =
    Route.useLoaderData();
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const resolveColor = useCategoryColor();

  if (!item) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <p className="text-muted-foreground text-[12.5px]">
          Aucun mouvement dans « {name} » sur cette période.
        </p>
        <Link
          to="/"
          search={search}
          className="border-border hover:bg-accent rounded-[7px] border px-2.5 py-1 text-xs"
        >
          Retour à la revue
        </Link>
      </div>
    );
  }

  const color = resolveColor(item.color);
  const unallocated = item.breakdown.find((b) => b.unallocated)?.total ?? 0;
  const maxSub = Math.max(...item.breakdown.map((b) => b.total), 1);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="text-muted-foreground flex flex-none items-center gap-2 px-7 pt-4.5 text-[12.5px]">
        <Link to="/" search={search} className="text-primary">
          Revue du mois
        </Link>
        <span className="text-subtle">›</span>
        <span className="text-foreground font-medium">{item.category}</span>
        <Link
          to="/"
          search={search}
          className="border-border text-muted-foreground hover:bg-accent ml-auto rounded-[7px] border px-2.5 py-1 text-xs"
        >
          Retour à la revue
        </Link>
      </div>

      {/* Le zoom n'a pas de barre de filtres — il en est un lui-même. Les
          filtres hérités des autres onglets restent pourtant appliqués à sa
          liste de transactions : ils sont rappelés ici, et retirables. */}
      <ActiveFilters className="flex-none px-7 pt-2.5" exclude={["category"]} />

      <div className="grid flex-none grid-cols-[minmax(0,1fr)_minmax(230px,300px)] items-end gap-6 px-7 pt-3.5 pb-5">
        <div className="flex flex-wrap items-end gap-4.5">
          <div
            className="h-13 w-3.5 rounded-[4px]"
            style={{ background: color }}
          />
          <div>
            <div className="label-caps text-xs">Catégorie</div>
            <div className="mt-0.5 text-[30px] font-semibold tracking-[-0.025em]">
              {item.category}
            </div>
          </div>
          <div className="pb-1">
            <div className="num text-[26px] font-medium tracking-[-0.02em]">
              {euro.format(item.total)}
            </div>
            <div className="text-muted-foreground text-xs">
              {sharePercent(item.total, periodTotal)}{" "}
              {isIncome ? "des entrées du mois" : "des sorties du mois"} ·{" "}
              {total} transactions
            </div>
          </div>
        </div>

        {/* L'écran « À revoir » ne traite que les sorties (son loader force
            `direction: "debit"`) : proposer la carte sur une catégorie
            d'entrée mènerait à un écran vide. */}
        {!isIncome && unallocated > 0 && (
          <Link
            to="/classer"
            search={{ ...search, category: item.category, page: 1 }}
            className="border-border bg-card hover:border-warn hover:bg-warn-soft rounded-[10px] border px-3.5 py-3 text-left"
          >
            <div className="text-muted-foreground flex justify-between text-[11.5px]">
              <span>À classer</span>
              <span className="num text-foreground font-medium">
                {euro.format(unallocated)}
              </span>
            </div>
            <div className="bg-track my-2 h-[7px] overflow-hidden rounded-full">
              <div
                className="h-full"
                style={{
                  width: sharePercent(unallocated, item.total),
                  background: hatchedBackground(
                    color,
                    softCategoryColor(color),
                  ),
                }}
              />
            </div>
            <div className="text-warn text-[11.5px] font-medium">
              {sharePercent(unallocated, item.total)} sans sous-catégorie ·
              classer ›
            </div>
          </Link>
        )}
      </div>

      {item.breakdown.length > 0 && (
        <div className="flex-none px-7 pb-4.5">
          <div className="label-caps mb-2.5 text-[11.5px]">Sous-catégories</div>
          <div className="border-border bg-card overflow-hidden rounded-[10px] border">
            {item.breakdown.map((sub, i) => (
              <div
                key={sub.category}
                className="border-border grid grid-cols-[minmax(160px,220px)_minmax(80px,1fr)_104px_50px] items-center gap-3 border-b px-3.5 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="size-2.5 flex-none rounded-[2px]"
                    style={{
                      background: sub.unallocated
                        ? softCategoryColor(color)
                        : shadeCategoryColor(color, i, item.breakdown.length),
                    }}
                  />
                  <span
                    className={cn("truncate", sub.unallocated && "font-medium")}
                  >
                    {sub.category}
                  </span>
                  {sub.unallocated && (
                    <span className="text-warn border-warn flex-none rounded-[4px] border border-dashed px-1 text-[10.5px]">
                      à classer
                    </span>
                  )}
                </div>
                <div className="bg-track h-2.5 overflow-hidden rounded-[3px]">
                  <div
                    className="h-full min-w-[3px] rounded-[3px]"
                    style={{
                      width: `${(sub.total / maxSub) * 100}%`,
                      background: sub.unallocated
                        ? hatchedBackground(color, softCategoryColor(color))
                        : shadeCategoryColor(color, i, item.breakdown.length),
                    }}
                  />
                </div>
                <div className="num text-right text-[12.5px]">
                  {euro.format(sub.total)}
                </div>
                <div className="text-subtle num text-right text-[11.5px]">
                  {sharePercent(sub.total, item.total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 px-7 pb-7">
        <div className="mb-2.5 flex items-baseline gap-2.5">
          <div className="label-caps text-[11.5px]">Transactions</div>
          <div className="text-subtle text-[11.5px]">
            catégorie modifiable sur place
          </div>
        </div>
        <CategoryTransactions
          rows={rows}
          shown={rows.length}
          total={total}
          flagged={new Set(flagged)}
        />
      </div>
    </div>
  );
}
