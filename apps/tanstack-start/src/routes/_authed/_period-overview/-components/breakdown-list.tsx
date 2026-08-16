import { LayersIcon } from "lucide-react";

import type { BreakdownByCategories } from "@budget/shared";
import { cn } from "@budget/ui";
import { Toolbar } from "@budget/ui/toolbar";

import { euro } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { NewBudgetGauge } from "./new-budget-gauge";

interface NewBreakdownListProps {
  breakdownByCategories: BreakdownByCategories[];
}

const NO_CATEGORY = "no-category";

export function BreakdownList({
  breakdownByCategories,
}: NewBreakdownListProps) {
  const { search, setSearch } = useRevueSearch();
  const { category: searchCategory } = search;

  let grandTotal = 0;
  const data = breakdownByCategories.reduce<
    Record<
      string,
      {
        total: number;
        budgetAmount: number | null;
        icon: string | null;
        parentColor: string | null;
      }
    >
  >(
    (
      acc,
      {
        parentName,
        categoryName,
        parentIcon,
        parentColor,
        budgetCatAmount,
        budgetParentAmount,
        total,
      },
    ) => {
      const name = searchCategory ? categoryName : parentName;
      if (searchCategory && searchCategory !== parentName) {
        return acc;
      }
      grandTotal += total;
      if (name === null) {
        acc[NO_CATEGORY] = {
          total,
          budgetAmount: null,
          icon: null,
          parentColor: null,
        };
      }
      if (name && acc[name]) {
        acc[name].total += total;
      }
      if (name && !acc[name]) {
        acc[name] = {
          total,
          budgetAmount: searchCategory ? budgetCatAmount : budgetParentAmount,
          parentColor,
          icon: parentIcon,
        };
      }

      return acc;
    },
    {},
  );

  const categoriesCount = Object.entries(data).length;
  const subCategoriesCount = breakdownByCategories.length;
  const parentCategoryElement = searchCategory
    ? breakdownByCategories.find(
        (breakdown) => breakdown.parentName === searchCategory,
      )
    : undefined;
  const maxValue = Math.max(
    grandTotal,
    parentCategoryElement?.budgetParentAmount ?? 0,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="h-28 px-2">
        {!searchCategory ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <LayersIcon aria-hidden />
                <span className="text-subheading">Toutes les catégories</span>
              </div>
              <strong className="num text-amount">
                {euro.format(grandTotal)}
              </strong>
            </div>
            <div className="text-subtle text-meta flex justify-end">
              {categoriesCount} poste
              {categoriesCount > 1 ? "s" : ""} de dépense · {subCategoriesCount}{" "}
              sous-catégorie
              {subCategoriesCount > 1 ? "s" : ""}
            </div>
          </div>
        ) : (
          parentCategoryElement && (
            <NewBudgetGauge
              value={grandTotal}
              max={maxValue}
              label={parentCategoryElement.parentName}
              iconName={parentCategoryElement.parentIcon}
              color={parentCategoryElement.parentColor}
              budget={parentCategoryElement.budgetParentAmount}
              valueSize="xl"
            />
          )
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
        {Object.entries(data).map(([categoryName, breakdown]) => (
          <Toolbar.Button
            key={categoryName}
            type="button"
            className={cn(
              "not-aria-disabled:hover:bg-accent focus-visible:ring-accent-soft flex flex-none cursor-pointer flex-col justify-center gap-1.5 rounded-lg p-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset motion-reduce:transition-none",
            )}
            onClick={() => setSearch({ category: categoryName })}
          >
            <NewBudgetGauge
              value={breakdown.total}
              budget={breakdown.budgetAmount}
              iconName={breakdown.icon}
              label={
                categoryName === NO_CATEGORY ? "Sans catégorie" : categoryName
              }
              color={breakdown.parentColor}
              max={maxValue}
            />
          </Toolbar.Button>
        ))}
      </Toolbar.Root>
    </div>
  );
}
