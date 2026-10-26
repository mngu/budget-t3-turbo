import type { CategoryOverviewType } from "@budget/api/schemas";

import { Button, Toolbar } from "@heroui/react";
import { LayersIcon } from "lucide-react";

import { familyBudget, getCategoryLabel } from "@budget/api/schemas";
import { cn } from "@budget/ui";
import { useCategoryColor, useShadeCategoryColor } from "~/lib/category-color";
import { sumBy } from "~/lib/sum";
import { useFormat } from "~/lib/use-format";
import { useRevueSearch } from "~/lib/use-revue-search";

import { spendingCategories } from "../-lib/spending";
import { BudgetGauge } from "./budget-gauge";

interface BreakdownListProps {
  overview: CategoryOverviewType;
}

interface BreakdownRow {
  name: string | null;
  label: string;
  value: number;
  budget: number | null;
  iconName: string | null;
  color: string;
}

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
        name: child.name,
        label: child.name,
        value: child.totalAmount ?? 0,
        budget: child.budgetAmount,
        iconName: selectedCategory.icon,
        color: shadeCategoryColor(
          resolveColor(selectedCategory.color),
          index,
          children.length,
        ),
      }))
    : overview.map((cat) => ({
        name: cat.name,
        label: getCategoryLabel(cat.name),
        value: cat.totalAmount ?? 0,
        budget: familyBudget(cat),
        iconName: cat.icon,
        color: resolveColor(cat.color),
      }));

  const totalAmount = sumBy(rows, (row) => row.value);
  const postes = spendingCategories(overview);
  const childCount = sumBy(
    postes,
    (cat) =>
      cat.children?.filter((child) => (child.totalAmount ?? 0) > 0).length ?? 0,
  );

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
            label={getCategoryLabel(selectedCategory.name)}
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
            <div className="text-muted text-meta flex justify-end">
              {postes.length} poste{postes.length > 1 ? "s" : ""} de dépense ·{" "}
              {childCount} sous-catégorie{childCount > 1 ? "s" : ""}
            </div>
          </div>
        )}
      </div>

      <hr className="mx-2" />

      <Toolbar
        orientation="vertical"
        aria-label="Répartition par poste"
        // HeroUI lays toolbars out as a content-sized grid; the gauges must span the column.
        className="flex min-h-0 w-full flex-1 scrollbar-thin flex-col overflow-y-auto"
      >
        {rows
          .filter((row) => row.value > 0)
          .map((row, index) => (
            <Button
              key={index}
              variant="ghost"
              fullWidth
              isDisabled={!!selectedCategory || !row.name}
              // A gauge row is taller than a button; rows below a category are not drillable
              // but still carry data, so they must not fade like a disabled control.
              className="h-auto min-w-0 flex-none flex-col items-stretch gap-1.5 rounded-lg p-2 whitespace-normal disabled:opacity-100"
              onPress={() => setSearch({ category: row.name ?? undefined })}
            >
              <BudgetGauge
                value={row.value}
                budget={row.budget}
                iconName={row.iconName}
                label={row.label}
                color={row.color}
                max={max}
              />
            </Button>
          ))}
      </Toolbar>
    </div>
  );
}
