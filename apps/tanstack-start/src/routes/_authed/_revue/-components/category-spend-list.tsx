"use client";

import { Link } from "@tanstack/react-router";

import type { CategoryBreakdownItem } from "@budget/api";
import { cn } from "@budget/ui";

import {
  hatchedBackground,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";

const SORTS = [
  { value: "montant", label: "Montant" },
  { value: "ecart", label: "Écart vs moy." },
  { value: "nv", label: "Non ventilé" },
] as const;

// Montant rattaché à la catégorie parente elle-même — le segment que
// `transactionsByCategory` marque `unallocated`.
const unallocatedOf = (item: CategoryBreakdownItem) =>
  item.breakdown.find((b) => b.unallocated)?.total ?? 0;

export function CategorySpendList({
  items,
  total,
  averages,
}: {
  items: CategoryBreakdownItem[];
  total: number;
  /** Moyenne mensuelle des 3 mois précédents, par catégorie parente. */
  averages: Map<string, number>;
}) {
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();

  // `catSort` est optionnel dans l'URL (voir schemas.ts) : le défaut vit ici.
  const catSort = search.catSort ?? "montant";

  const sorted = [...items].sort((a, b) => {
    if (catSort === "nv") return unallocatedOf(b) - unallocatedOf(a);
    if (catSort === "ecart")
      return (
        b.total -
        (averages.get(b.category) ?? b.total) -
        (a.total - (averages.get(a.category) ?? a.total))
      );
    return b.total - a.total;
  });
  const max = Math.max(...items.map((i) => i.total), 1);

  return (
    <>
      <div className="mt-6 mb-2.5 flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
          Sorties · où est parti l'argent
        </h2>
        <span className="text-subtle text-[11.5px]">
          {items.length} catégories · cliquer pour ouvrir le détail
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {SORTS.map((sort) => {
            const active = catSort === sort.value;
            return (
              <button
                key={sort.value}
                type="button"
                onClick={() => setSearch({ catSort: sort.value })}
                className={cn(
                  "hover:bg-accent rounded-[7px] border px-2.5 py-[3px] text-[11.5px]",
                  active
                    ? "border-border-strong bg-card text-foreground font-medium"
                    : "text-muted-foreground border-transparent",
                )}
              >
                {sort.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-border bg-card overflow-hidden rounded-xl border">
        {sorted.map((item) => {
          const color = resolveColor(item.color);
          const unallocated = unallocatedOf(item);
          const label = item.category || "Sans catégorie";
          return (
            <div
              key={label}
              className="border-border hover:bg-secondary grid h-[41px] grid-cols-[minmax(150px,178px)_minmax(90px,1fr)_108px_56px] items-center gap-2.5 border-b px-4"
            >
              <Link
                to="/categorie/$name"
                params={{ name: label }}
                search={search}
                className="flex h-full min-w-0 items-center gap-2 text-left"
              >
                <span
                  className="size-2.5 flex-none rounded-[3px]"
                  style={{ background: color }}
                />
                <span className="truncate font-medium">{label}</span>
              </Link>

              <span className="flex min-w-0 items-center gap-2">
                <Link
                  to="/categorie/$name"
                  params={{ name: label }}
                  search={search}
                  className="bg-track flex h-3.5 min-w-0 flex-1 overflow-hidden rounded-[4px]"
                  aria-label={`Détail de ${label}`}
                >
                  {/* La portion hachurée est ce qui reste à ventiler ; elle est
                      en tête de barre pour être comparable d'une ligne à l'autre. */}
                  <span
                    className="h-full"
                    style={{
                      width: `${(unallocated / max) * 100}%`,
                      background: hatchedBackground(
                        color,
                        softCategoryColor(color),
                      ),
                    }}
                  />
                  <span
                    className="h-full"
                    style={{
                      width: `${((item.total - unallocated) / max) * 100}%`,
                      background: color,
                    }}
                  />
                </Link>
                {unallocated > 0 && (
                  <Link
                    to="/ventiler"
                    search={{ ...search, category: label, page: 1 }}
                    title={`Ventiler — ${sharePercent(unallocated, item.total)} sans sous-catégorie`}
                    className="text-warn border-warn hover:bg-warn-soft flex-none rounded-[5px] border border-dashed px-1.5 text-[10px] font-semibold whitespace-nowrap"
                  >
                    {sharePercent(unallocated, item.total)}
                  </Link>
                )}
              </span>

              <Link
                to="/categorie/$name"
                params={{ name: label }}
                search={search}
                className="num text-right text-[13px]"
              >
                {euro.format(item.total)}
              </Link>
              <Link
                to="/categorie/$name"
                params={{ name: label }}
                search={search}
                className="text-subtle num flex items-center justify-end gap-1.5 text-[11.5px] whitespace-nowrap"
              >
                {sharePercent(item.total, total)}
                <span className="text-xs">›</span>
              </Link>
            </div>
          );
        })}

        <div className="text-subtle flex items-center gap-3.5 px-4 py-2.5 text-[11.5px]">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-4 rounded-[3px]"
              style={{
                background:
                  "repeating-linear-gradient(115deg,var(--subtle) 0 3px,transparent 3px 7px)",
              }}
            />
            hachuré = non ventilé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-warn border-warn rounded-[5px] border border-dashed px-1.5 text-[10px]">
              %
            </span>
            cliquer pour ventiler
          </span>
          <span className="num ml-auto">total {euro.format(total)}</span>
        </div>
      </div>
    </>
  );
}
