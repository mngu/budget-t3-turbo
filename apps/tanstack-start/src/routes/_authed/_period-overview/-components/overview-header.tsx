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
  // `resolveColor` retombe déjà sur la teinte par défaut sur `null`.
  const selectedColor = selected ? resolveColor(selected.color) : "";

  const subCount = selected?.children?.length ?? 0;
  // Le dénominateur sort de **la même** source que le numérateur. Pris
  // ailleurs (`globalStats.debit`), il porterait le filtre de comptes, que
  // `categories.overview` ignore : la part pourrait alors dépasser 100 %.
  const expenses = sumBy(overview, (cat) => cat.totalAmount ?? 0);
  // Les postes **de dépense** : `overview` liste toutes les parentes de
  // l'espace, y compris celles sans aucun mouvement sur la période.
  const postes = overview.filter((cat) => cat.totalAmount !== null).length;

  return (
    <div className="flex min-w-0 flex-none items-center gap-3">
      {/* Poste ouvert : la vignette est la sortie, sur toutes les tailles —
          sur téléphone l'anneau et son bouton central n'existent pas, et Échap
          n'a pas de clavier. L'icône du poste reste en tête de la colonne. */}
      {selected ? (
        <button
          type="button"
          title="Revenir à toutes les catégories"
          aria-label="Revenir à toutes les catégories"
          onClick={() => setSearch({ category: undefined })}
          className="touch-target flex size-7 flex-none items-center justify-center rounded-lg hover:opacity-70"
          style={{
            background: softCategoryColor(selectedColor),
            color: selectedColor,
          }}
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
        </button>
      ) : (
        <span className="bg-sunken text-subtle flex size-7 flex-none items-center justify-center rounded-lg">
          <LayersIcon className="size-4" aria-hidden />
        </span>
      )}
      <div className="flex min-w-0 flex-col lg:flex-row lg:items-center lg:gap-3">
        <span className="text-heading min-w-0 truncate">
          {selected ? selected.name : "Toutes catégories"}
        </span>
        <span className="text-subtle text-control truncate lg:flex-none">
          {selected
            ? `${subCount} sous-catégorie${subCount > 1 ? "s" : ""} · ${sharePercent(selected.totalAmount ?? 0, expenses)} des sorties`
            : `${postes} poste${postes > 1 ? "s" : ""} de dépense`}
        </span>
      </div>

      <Link
        to={isTable ? "/" : "/transactions"}
        search={search}
        title={isTable ? "Retour" : "Ouvrir la liste des transactions"}
        className="border-border bg-card text-muted-foreground hover:border-subtle hover:text-foreground hover:bg-accent text-control ml-auto flex h-7 flex-none items-center gap-1.5 rounded-full border pr-2 pl-3 font-medium whitespace-nowrap"
      >
        {isTable ? (
          <>
            <ArrowLeftIcon className="text-subtle size-3.5" aria-hidden />
            Retour
          </>
        ) : (
          <>
            Voir les transactions
            <ArrowRightIcon className="text-subtle size-3.5" aria-hidden />
          </>
        )}
      </Link>
    </div>
  );
}
