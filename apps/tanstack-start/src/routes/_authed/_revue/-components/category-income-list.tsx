"use client";

import { Link } from "@tanstack/react-router";

import type { CategoryBreakdownItem } from "@budget/api";

import { euro, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import {
  CategoryBar,
  CategoryBreakdownCard,
  categorySegments,
} from "./category-segments";

/**
 * « Entrées · d'où vient l'argent » : le pendant de {@link CategorySpendList}
 * côté crédits.
 *
 * Volontairement plus pauvre que son homologue, et non une variante de celle-ci :
 * pas de tri, pas de part hachurée, pas de raccourci vers « À revoir ». Le
 * « à classer » de la revue est un compteur de *sorties* — la page « À revoir » ne
 * parle que de celles-là — et le porter ici laisserait croire qu'un salaire mal
 * sous-catégorisé pèse sur ce compteur.
 *
 * Les catégories d'entrée gardent la couleur `--ok` plutôt que la leur : ce qui
 * distingue ces lignes, c'est le sens, pas la famille. Leurs segments en sont
 * donc des paliers, comme côté sorties, mais tirés du vert et non de la teinte
 * de la famille.
 */
export function CategoryIncomeList({
  items,
  total,
  /** Nombre d'entrées de la file de relecture à contre-sens de leur catégorie. */
  oddDirectionCount,
}: {
  items: CategoryBreakdownItem[];
  total: number;
  oddDirectionCount: number;
}) {
  const { search } = useRevueSearch();
  const max = Math.max(...items.map((i) => i.total), 1);

  return (
    <>
      <div className="mt-8 mb-3.5 flex flex-wrap items-baseline gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
          Entrées · d'où vient l'argent
        </h2>
        <span className="text-subtle text-[11.5px]">
          {items.length} catégorie{items.length > 1 && "s"} · encaissements du
          mois
        </span>
      </div>

      {/* Pas d'`overflow-hidden` : le détail au survol doit pouvoir déborder. */}
      <div className="border-border bg-card rounded-xl border">
        {items.map((item) => {
          const label = item.category || "Sans catégorie";
          const segments = categorySegments(item, "var(--ok)", {
            hatch: false,
          });
          return (
            <Link
              key={label}
              to="/categorie/$name"
              params={{ name: label }}
              search={search}
              className="border-border hover:bg-secondary group relative grid h-[41px] grid-cols-[minmax(150px,178px)_minmax(90px,1fr)_108px_56px] items-center gap-2.5 border-b px-4 first:rounded-t-xl"
            >
              <CategoryBreakdownCard item={item} segments={segments} income />

              <span className="flex min-w-0 items-center gap-2">
                <span className="bg-ok size-2.5 flex-none rounded-[3px]" />
                <span className="truncate font-medium">{label}</span>
              </span>
              <span className="bg-track flex h-3.5 min-w-0 gap-px overflow-hidden rounded-[4px]">
                <CategoryBar segments={segments} max={max} />
              </span>
              <span className="num text-ok text-right text-[13px]">
                {euro.format(item.total)}
              </span>
              <span className="text-subtle num flex items-center justify-end gap-1.5 text-[11.5px] whitespace-nowrap">
                {sharePercent(item.total, total)}
                <span className="text-xs">›</span>
              </span>
            </Link>
          );
        })}

        {items.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-[11.5px]">
            Aucune entrée sur cette période.
          </p>
        )}

        <div className="text-subtle flex items-center gap-3.5 px-4 py-2.5 text-[11.5px]">
          {oddDirectionCount > 0 && (
            <span>
              {oddDirectionCount} transaction
              {oddDirectionCount > 1 ? "s vont" : " va"} à contre-sens de{" "}
              {oddDirectionCount > 1 ? "leur" : "sa"} catégorie —{" "}
              {oddDirectionCount > 1 ? "elles remontent" : "elle remonte"} dans
              « À revoir ».
            </span>
          )}
          <span className="num text-ok ml-auto">
            total {euro.format(total)}
          </span>
        </div>
      </div>
    </>
  );
}
