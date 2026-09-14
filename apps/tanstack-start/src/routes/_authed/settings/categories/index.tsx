import type { ManagedCategory } from "@budget/api/schemas";

import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import {
  isManagedCategory,
  transactionsSearchSchema,
} from "@budget/api/schemas";
import { Stat } from "~/component/stat";
import { sumBy } from "~/lib/sum";
import {
  defaultToCurrentMonth,
  SEARCH_DEFAULTS,
} from "~/lib/transactions-search";
import { useFormat } from "~/lib/use-format";

import { CategoryOverview } from "./-components/category-overview";

export const Route = createFileRoute("/_authed/settings/categories/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [stripSearchParams(SEARCH_DEFAULTS), defaultToCurrentMonth],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ context }) => {
    // Le poste des transactions sans catégorie appartient à la revue, pas aux
    // réglages : cet écran ne montre que ce qui se gère.
    const overview = (
      await context.trpcClient.categories.overview.query()
    ).filter(isManagedCategory);
    const stats = computeStats(overview);
    return { overview, stats };
  },
  staticData: { title: "Catégories", aside: CategoriesAside },
  component: CategoriesPage,
});

function CategoriesAside() {
  const { euro } = useFormat();
  const { overview } = Route.useLoaderData();
  const childCount = sumBy(overview, (cat) => cat.children?.length ?? 0);
  const totalBudget = sumBy(
    overview,
    (cat) =>
      (cat.budgetAmount ?? 0) +
      sumBy(cat.children ?? [], (child) => child.budgetAmount ?? 0),
  );
  return (
    <div className="ml-auto flex items-stretch">
      <Stat value={overview.length} label="Parentes" />
      <Stat value={childCount} label="Sous-catégories" />
      <Stat value={euro.format(totalBudget)} label="Budgété / mois" />
    </div>
  );
}

function CategoriesPage() {
  const { overview, stats } = Route.useLoaderData();

  return <CategoryOverview categoryOverview={overview} stats={stats} />;
}

// Compteurs de l'en-tête et données dérivées du choix de teinte. « Teintes
// prises » compte les teintes *distinctes* : à 13 teintes pour un nombre
// illimité de parentes, la collision est un état normal — signalée, jamais
// interdite (voir CategoryIdentityDialog).
export function computeStats(tree: ManagedCategory[]) {
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
