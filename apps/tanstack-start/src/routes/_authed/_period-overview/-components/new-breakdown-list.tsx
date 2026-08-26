import type { NewCategoryOverviewType } from "@budget/api/schemas";

import { LayersIcon } from "lucide-react";

import { Toolbar } from "@budget/ui/toolbar";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { sumBy } from "~/lib/sum";
import { useRevueSearch } from "~/lib/use-revue-search";

import { NO_CATEGORY, openParent } from "../-lib/breakdown";
import { BudgetGauge } from "./budget-gauge";

interface NewBreakdownListProps {
  newOverview: NewCategoryOverviewType;
}

// Une ligne de la colonne, quel que soit le niveau affiché. Les deux niveaux
// n'ont pas la même forme en base — seule une parente porte couleur, icône et
// enfants — et rien ne relierait pour TypeScript le niveau courant à la forme
// que `map` rend. Les deux sont donc aplaties ici, une fois, là où l'on sait
// encore de laquelle on parle.
interface BreakdownRow {
  label: string;
  value: number;
  budget: number | null;
  iconName: string | null;
  color: string;
  drillable: boolean;
}

export function NewBreakdownList({ newOverview }: NewBreakdownListProps) {
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const { category } = search;
  // Même définition du niveau ouvert que `OverviewHeader` : sans elle, un
  // filtre posé sur une *sous*-catégorie ouvrait l'en-tête sur sa parente
  // pendant que la colonne restait à la racine.
  const selectedCategory = openParent(newOverview, category);
  // `children` est nullable en base : le `json_array` d'une parente sans
  // sous-catégorie rend `null`, pas un tableau vide.
  const children = selectedCategory?.children ?? [];

  const rows: BreakdownRow[] = selectedCategory
    ? children.map((child, index) => ({
        label: child.name,
        value: child.totalAmount ?? 0,
        budget: child.budgetAmount,
        // Une sous-catégorie n'a ni icône ni couleur propre : elle emprunte
        // celles de sa parente, en palier de teinte selon son rang.
        iconName: selectedCategory.icon,
        color: shadeCategoryColor(
          resolveColor(selectedCategory.color),
          index,
          children.length,
        ),
        drillable: false,
      }))
    : newOverview.map((cat) => ({
        // `null` sur le poste des transactions sans catégorie.
        label: cat.name ?? NO_CATEGORY,
        value: cat.totalAmount ?? 0,
        budget: cat.budgetAmount,
        iconName: cat.icon,
        color: resolveColor(cat.color),
        drillable: (cat.children?.length ?? 0) > 0,
      }));

  const totalAmount = sumBy(rows, (row) => row.value);
  const childCount = sumBy(newOverview, (cat) => cat.children?.length ?? 0);

  // Une parente détaillée n'a pas de montant propre (CHECK
  // `categories_detailed_no_amount`) : son budget est la somme de ses enfants.
  // Une parente globale porte le sien, et ceux de ses enfants sont dormants.
  const selectedCategoryBudget = selectedCategory?.budgetAmount ?? null;
  const totalBudget = selectedCategory
    ? selectedCategory.budgetDetailed
      ? sumBy(rows, (row) => row.budget ?? 0)
      : selectedCategory.budgetAmount
    : sumBy(newOverview, (cat) =>
        cat.budgetDetailed
          ? sumBy(cat.children ?? [], (child) => child.budgetAmount ?? 0)
          : (cat.budgetAmount ?? 0),
      );

  const max = Math.max(totalAmount, totalBudget ?? 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="h-28 px-2">
        {selectedCategory ? (
          <BudgetGauge
            value={selectedCategory.totalAmount ?? 0}
            max={Math.max(
              selectedCategory.totalAmount ?? 0,
              selectedCategory.budgetAmount ?? 0,
            )}
            label={selectedCategory.name}
            iconName={selectedCategory.icon}
            color={resolveColor(selectedCategory.color)}
            budget={selectedCategoryBudget}
            valueSize="xl"
          />
        ) : (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayersIcon aria-hidden />
                <span className="text-subheading">Toutes les catégories</span>
              </div>
              <strong className="num text-amount">
                {euro.format(totalAmount)}
              </strong>
            </div>
            <div className="text-subtle text-meta flex justify-end">
              {newOverview.length} poste{newOverview.length > 1 ? "s" : ""} de
              dépense · {childCount} sous-catégorie{childCount > 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <hr className="w-64" />
      </div>

      <Toolbar.Root
        orientation="vertical"
        aria-label="Répartition par poste"
        className="flex min-h-0 flex-1 scrollbar-thin flex-col overflow-y-auto"
      >
        {rows.map((row, index) => (
          <Toolbar.Button
            key={index}
            type="button"
            disabled={!row.drillable}
            className="not-aria-disabled:hover:bg-accent focus-visible:ring-accent-soft flex flex-none cursor-pointer flex-col justify-center gap-1.5 rounded-lg p-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset motion-reduce:transition-none"
            onClick={() => setSearch({ category: row.label })}
          >
            <BudgetGauge
              value={row.value}
              budget={row.budget}
              iconName={row.iconName}
              label={row.label}
              color={row.color}
              max={max}
            />
          </Toolbar.Button>
        ))}
      </Toolbar.Root>
    </div>
  );
}
