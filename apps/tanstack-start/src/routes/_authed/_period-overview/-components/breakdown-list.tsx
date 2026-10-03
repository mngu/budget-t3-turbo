import type { CategoryOverviewType } from "@budget/api/schemas";

import { LayersIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Toolbar } from "@budget/ui/toolbar";
import { useCategoryColor, useShadeCategoryColor } from "~/lib/category-color";
import { sumBy } from "~/lib/sum";
import { useFormat } from "~/lib/use-format";
import { useRevueSearch } from "~/lib/use-revue-search";

import { getCategoryLabel } from "../-lib/breakdown";
import { BudgetGauge } from "./budget-gauge";

interface BreakdownListProps {
  overview: CategoryOverviewType;
}

interface BreakdownRow {
  label: string;
  value: number;
  budget: number | null;
  iconName: string | null;
  color: string;
  drillable: boolean;
}

// A detailed parent holds no amount of its own: its budget is its children's sum.
const familyBudget = (cat: CategoryOverviewType[number]) =>
  cat.budgetDetailed
    ? sumBy(cat.children ?? [], (child) => child.budgetAmount ?? 0) || null
    : cat.budgetAmount;

export function BreakdownList({ overview }: BreakdownListProps) {
  const { euro } = useFormat();
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const shadeCategoryColor = useShadeCategoryColor();
  const { category } = search;
  const selectedCategory = category
    ? overview.find(({ name }) => name === category)
    : null;
  const children = selectedCategory?.children ?? [];

  const rows: BreakdownRow[] = selectedCategory
    ? children.map((child, index) => ({
        label: child.name,
        value: child.totalAmount ?? 0,
        budget: child.budgetAmount,
        iconName: selectedCategory.icon,
        color: shadeCategoryColor(
          resolveColor(selectedCategory.color),
          index,
          children.length,
        ),
        drillable: false,
      }))
    : overview.map((cat) => ({
        label: getCategoryLabel(cat.name),
        value: cat.totalAmount ?? 0,
        budget: familyBudget(cat),
        iconName: cat.icon,
        color: resolveColor(cat.color),
        drillable: (cat.children?.length ?? 0) > 0,
      }));

  const totalAmount = sumBy(rows, (row) => row.value);
  const childCount = sumBy(overview, (cat) => cat.children?.length ?? 0);

  const selectedCategoryBudget = selectedCategory
    ? familyBudget(selectedCategory)
    : null;
  const totalBudget = selectedCategory
    ? selectedCategoryBudget
    : sumBy(overview, (cat) => familyBudget(cat) ?? 0);

  const max = Math.max(totalAmount, totalBudget ?? 0);

  return (
    <div className="flex h-full flex-col gap-4">
      <div
        className={cn("px-2 md:h-28", !selectedCategory && "hidden md:block")}
      >
        {selectedCategory ? (
          <BudgetGauge
            value={selectedCategory.totalAmount ?? 0}
            max={Math.max(
              selectedCategory.totalAmount ?? 0,
              selectedCategoryBudget ?? 0,
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
              {overview.length} poste{overview.length > 1 ? "s" : ""} de dépense
              · {childCount} sous-catégorie{childCount > 1 ? "s" : ""}
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
        {rows
          .filter((row) => row.value > 0)
          .map((row, index) => (
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
