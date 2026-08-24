import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import type { NewCategoryOverviewType } from "@budget/api/schemas";
import { transactionsSearchSchema } from "@budget/api/schemas";

import { Stat } from "~/component/stat";
import { euro0 } from "~/lib/format";
import {
  defaultToCurrentMonth,
  SEARCH_DEFAULTS,
} from "~/lib/transactions-search";
import { NewCategoryOverview } from "./-components/new-category-overview";

export const Route = createFileRoute("/_authed/settings/categories/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const newOverview =
      await context.trpcClient.categories.newOverview.query(deps);
    const stats = computeStats(newOverview);
    return { newOverview, stats };
  },
  staticData: { title: "Catégories", aside: CategoriesAside },
  component: CategoriesPage,
});

function CategoriesAside() {
  const { newOverview } = Route.useLoaderData();
  let totalBudget = 0;
  let childCount = 0;
  newOverview.forEach((cat) => {
    if (cat.budgetAmount) {
      totalBudget += cat.budgetAmount;
    }
    if (cat.children) {
      childCount += cat.children.length;
      cat.children.forEach((subCat) => {
        if (subCat.budgetAmount) {
          totalBudget += subCat.budgetAmount;
        }
      });
    }
  });
  return (
    <div className="ml-auto flex items-stretch">
      <Stat value={newOverview.length} label="Parentes" />
      <Stat value={childCount} label="Sous-catégories" />
      <Stat value={euro0.format(totalBudget)} label="Budgété / mois" />
    </div>
  );
}

function CategoriesPage() {
  const { newOverview, stats } = Route.useLoaderData();

  return <NewCategoryOverview categoryOverview={newOverview} stats={stats} />;
}

// Compteurs de l'en-tête et données dérivées du choix de teinte. « Teintes
// prises » compte les teintes *distinctes* : à 13 teintes pour un nombre
// illimité de parentes, la collision est un état normal — signalée, jamais
// interdite (voir CategoryIdentityDialog).
export function computeStats(tree: NewCategoryOverviewType) {
  const ownersByColor = new Map<string, string[]>();
  const usageByIcon = new Map<string, number>();

  for (const parent of tree) {
    if (parent.color) {
      ownersByColor.set(parent.color, [
        ...(ownersByColor.get(parent.color) ?? []),
        parent.name,
      ]);
    }
    if (parent.icon) {
      usageByIcon.set(parent.icon, (usageByIcon.get(parent.icon) ?? 0) + 1);
    }
  }

  return {
    ownersByColor,
    usageByIcon,
  };
}
