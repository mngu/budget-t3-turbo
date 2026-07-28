"use client";

import { Link } from "@tanstack/react-router";

import type { CategoryBreakdownItem } from "@budget/api";

import { useCategoryColor } from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import {
  CategoryBar,
  CategoryBreakdownCard,
  categorySegments,
} from "./category-segments";

// Montant rattaché à la catégorie parente elle-même — le segment que
// `transactionsByCategory` marque `unallocated`.
const unallocatedOf = (item: CategoryBreakdownItem) =>
  item.breakdown.find((b) => b.unallocated)?.total ?? 0;

export function CategorySpendList({
  items,
  total,
}: {
  items: CategoryBreakdownItem[];
  total: number;
}) {
  const { search } = useRevueSearch();
  const resolveColor = useCategoryColor();

  // Toujours du plus gros au plus petit : c'est la question que pose l'écran.
  const sorted = [...items].sort((a, b) => b.total - a.total);
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
      </div>

      {/* Sans `overflow-hidden` : le détail au survol déborde de la carte, et
          c'est tout l'intérêt. Les lignes arrondissent donc elles-mêmes le haut
          de la carte, sans quoi leur fond de survol en carrerait les coins. */}
      <div className="border-border bg-card rounded-xl border">
        {sorted.map((item) => {
          const color = resolveColor(item.color);
          const segments = categorySegments(item, color);
          const unallocated = unallocatedOf(item);
          const label = item.category || "Sans catégorie";
          return (
            <div
              key={label}
              className="border-border hover:bg-secondary group relative grid h-[41px] grid-cols-[minmax(150px,178px)_minmax(90px,1fr)_108px_56px] items-center gap-2.5 border-b px-4 first:rounded-t-xl"
            >
              <CategoryBreakdownCard item={item} segments={segments} />

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
                  className="bg-track flex h-3.5 min-w-0 flex-1 gap-px overflow-hidden rounded-[4px]"
                  aria-label={`Détail de ${label}`}
                >
                  <CategoryBar segments={segments} max={max} />
                </Link>
                {unallocated > 0 && (
                  <Link
                    to="/classer"
                    search={{ ...search, category: label, page: 1 }}
                    title={`Classer — ${sharePercent(unallocated, item.total)} sans sous-catégorie`}
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
            hachuré = à classer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-warn border-warn rounded-[5px] border border-dashed px-1.5 text-[10px]">
              %
            </span>
            cliquer pour classer
          </span>
          <span className="num ml-auto">total {euro.format(total)}</span>
        </div>
      </div>
    </>
  );
}
