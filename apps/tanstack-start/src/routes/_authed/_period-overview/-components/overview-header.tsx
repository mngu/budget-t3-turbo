import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon, LayersIcon } from "lucide-react";

import type { Breakdown } from "@budget/shared";
import { cn } from "@budget/ui";

import { CategoryIcon } from "~/component/category-icon";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { breakdownLevel } from "~/routes/_authed/_period-overview/-lib/breakdown";

interface OverviewHeaderProps {
  breakdownByCategories: Breakdown;
}

export function OverviewHeader({ breakdownByCategories }: OverviewHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { search } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const level = breakdownLevel(breakdownByCategories, search.category);
  const selected = level.parent;
  const selectedColor = selected ? resolveColor(selected.color) : "";

  return (
    <div className="flex min-w-0 flex-none items-center gap-3">
      <span
        className={cn(
          "flex size-7 flex-none items-center justify-center rounded-lg",
          !selected && "bg-sunken text-subtle",
        )}
        style={
          selected
            ? { background: softCategoryColor(selectedColor) }
            : undefined
        }
      >
        {selected ? (
          <CategoryIcon
            name={selected.icon}
            className="size-4"
            color={selectedColor}
          />
        ) : (
          <LayersIcon className="size-4" aria-hidden />
        )}
      </span>
      <span className="text-heading min-w-0 truncate">
        {selected ? selected.name : "Toutes catégories"}
      </span>
      <span className="text-subtle text-control flex-none whitespace-nowrap">
        {selected
          ? `${level.slices.length} sous-catégorie${level.slices.length > 1 ? "s" : ""} · ${sharePercent(level.total, level.expenses)} des sorties`
          : `${level.postes} poste${level.postes > 1 ? "s" : ""} de dépense`}
      </span>

      {pathname === "/transactions" ? (
        <Link
          to="/"
          search={search}
          title="Retour"
          className="border-border bg-card text-muted-foreground hover:border-subtle hover:text-foreground hover:bg-accent text-control ml-auto flex h-7 flex-none items-center gap-1.5 rounded-full border pr-2 pl-3 font-medium whitespace-nowrap"
        >
          <ArrowLeftIcon className="text-subtle size-3.5" aria-hidden />
          Retour
        </Link>
      ) : (
        <Link
          to="/transactions"
          search={search}
          title="Ouvrir la liste des transactions"
          className="border-border bg-card text-muted-foreground hover:border-subtle hover:text-foreground hover:bg-accent text-control ml-auto flex h-7 flex-none items-center gap-1.5 rounded-full border pr-2 pl-3 font-medium whitespace-nowrap"
        >
          Voir les transactions
          <ArrowRightIcon className="text-subtle size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
