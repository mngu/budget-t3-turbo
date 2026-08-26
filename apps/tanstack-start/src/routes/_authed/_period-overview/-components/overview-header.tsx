import type { NewCategoryOverviewType } from "@budget/api/schemas";

import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeftIcon, ArrowRightIcon, LayersIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { CategoryIcon } from "~/component/category-icon";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { sharePercent } from "~/lib/format";
import { sumBy } from "~/lib/sum";
import { useRevueSearch } from "~/lib/use-revue-search";

import { openParent } from "../-lib/breakdown";

interface OverviewHeaderProps {
  newOverview: NewCategoryOverviewType;
}

export function OverviewHeader({ newOverview }: OverviewHeaderProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { search } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const selected = openParent(newOverview, search.category);
  // `resolveColor` retombe déjà sur la teinte par défaut sur `null`.
  const selectedColor = selected ? resolveColor(selected.color) : "";

  const subCount = selected?.children?.length ?? 0;
  // Le dénominateur sort de **la même** source que le numérateur. Pris
  // ailleurs (`globalStats.debit`), il porterait le filtre de comptes, que
  // `categories.newOverview` ignore : la part pourrait alors dépasser 100 %.
  const expenses = sumBy(newOverview, (cat) => cat.totalAmount ?? 0);
  // Les postes **de dépense** : `newOverview` liste toutes les parentes de
  // l'espace, y compris celles sans aucun mouvement sur la période.
  const postes = newOverview.filter((cat) => cat.totalAmount !== null).length;

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
          ? `${subCount} sous-catégorie${subCount > 1 ? "s" : ""} · ${sharePercent(selected.totalAmount ?? 0, expenses)} des sorties`
          : `${postes} poste${postes > 1 ? "s" : ""} de dépense`}
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
