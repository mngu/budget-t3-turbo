import type { CategoryOverviewType } from "@budget/api/schemas";

import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon, LayersIcon } from "lucide-react";

import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { sharePercent } from "~/lib/format";
import { sumBy } from "~/lib/sum";
import { useRevueSearch } from "~/lib/use-revue-search";

interface OverviewHeaderProps {
  overview: CategoryOverviewType;
}

export function OverviewHeader({ overview }: OverviewHeaderProps) {
  const isTable =
    useRouterState({ select: (s) => s.location.pathname }) === "/transactions";
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const { category } = search;

  const selected = category
    ? overview.find(({ name }) => name === category)
    : null;
  const selectedColor = selected ? resolveColor(selected.color) : "";

  const subCount = selected?.children?.length ?? 0;
  const expenses = sumBy(overview, (cat) => cat.totalAmount ?? 0);
  const postes = overview.filter((cat) => cat.totalAmount !== null).length;

  return (
    <div className="flex min-w-0 flex-none items-center gap-3">
      {/* Mobile has neither the ring's back button nor an Escape key. */}
      {selected ? (
        <button
          type="button"
          title="Revenir à toutes les catégories"
          aria-label="Revenir à toutes les catégories"
          onClick={() => setSearch({ category: undefined })}
          className="hit-area flex size-7 flex-none items-center justify-center rounded-lg hover:opacity-70"
          style={{
            background: softCategoryColor(selectedColor),
            color: selectedColor,
          }}
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="bg-background-secondary text-muted flex size-7 flex-none items-center justify-center rounded-lg">
          <LayersIcon className="size-4" aria-hidden />
        </span>
      )}
      <div className="flex min-w-0 flex-col lg:flex-row lg:items-center lg:gap-3">
        <span className="text-heading min-w-0 truncate">
          {selected ? selected.name : "Toutes catégories"}
        </span>
        <span className="text-muted text-control truncate lg:flex-none">
          {selected
            ? `${subCount} sous-catégorie${subCount > 1 ? "s" : ""} · ${sharePercent(selected.totalAmount ?? 0, expenses)} des sorties`
            : `${postes} poste${postes > 1 ? "s" : ""} de dépense`}
        </span>
      </div>

      <Link
        to={isTable ? "/" : "/transactions"}
        search={search}
        title={isTable ? "Retour" : "Ouvrir la liste des transactions"}
        className="border-border bg-surface text-muted hover:border-muted hover:text-foreground hover:bg-default text-control ml-auto flex h-7 flex-none items-center gap-1.5 rounded-full border pr-2 pl-3 font-medium whitespace-nowrap"
      >
        {isTable ? (
          <>
            <ArrowLeftIcon className="text-muted size-3.5" aria-hidden />
            Retour
          </>
        ) : (
          <>
            Voir les transactions
            <ArrowRightIcon className="text-muted size-3.5" aria-hidden />
          </>
        )}
      </Link>
    </div>
  );
}
