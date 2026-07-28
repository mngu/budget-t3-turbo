"use client";

import type { CategoryBreakdownItem } from "@budget/api";

import {
  hatchedBackground,
  shadeCategoryColor,
  softCategoryColor,
} from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";

export interface CategorySegment {
  label: string;
  total: number;
  /** Aplat de la pastille de légende. */
  color: string;
  /** Remplissage de la barre — hachuré pour le reliquat à classer. */
  fill: string;
  /**
   * Vrai pour le seul reliquat à classer, et seulement là où il est signalé
   * comme tel : côté entrées il reste un segment ordinaire (voir `hatch`).
   */
  flagged: boolean;
}

/**
 * Une barre par catégorie parente, découpée en un segment par sous-catégorie.
 *
 * Le reliquat à classer est épinglé en fin de barre alors que l'API le trie
 * avec les autres : sa nuance ne vient pas de son rang (c'est l'aplat pâle de la
 * famille, sous des hachures) et l'y laisser au milieu couperait le dégradé du
 * plus dense au plus clair qui rend les segments lisibles.
 */
export function categorySegments(
  item: CategoryBreakdownItem,
  color: string,
  /**
   * Côté entrées, le reliquat garde l'aplat pâle mais perd ses hachures : le
   * motif hachuré est la promesse d'un passage par `/classer`, qui ne traite
   * que les sorties (son loader force `direction: "debit"`). Le montrer là
   * annoncerait une correction que l'écran suivant ne rendrait pas.
   */
  { hatch = true }: { hatch?: boolean } = {},
): CategorySegment[] {
  const subs = item.breakdown.filter((b) => !b.unallocated);
  const segments = subs.map((sub, index) => {
    const shade = shadeCategoryColor(color, index, subs.length);
    return {
      label: sub.category,
      total: sub.total,
      color: shade,
      fill: shade,
      flagged: false,
    };
  });

  const unallocated = item.breakdown.find((b) => b.unallocated);
  if (unallocated) {
    const soft = softCategoryColor(color);
    segments.push({
      label: unallocated.category,
      total: unallocated.total,
      color: soft,
      fill: hatch ? hatchedBackground(color, soft) : soft,
      flagged: hatch,
    });
  }

  // Une catégorie sans enfant n'a pas de détail : elle reste d'un seul tenant.
  if (segments.length === 0)
    return [
      {
        label: item.category,
        total: item.total,
        color,
        fill: color,
        flagged: false,
      },
    ];

  return segments;
}

/**
 * `max` est le plus gros total de la *liste*, pas celui de la catégorie : les
 * barres se comparent d'une ligne à l'autre, elles ne remplissent pas chacune
 * toute la largeur.
 */
export function CategoryBar({
  segments,
  max,
}: {
  segments: CategorySegment[];
  max: number;
}) {
  return (
    <>
      {segments.map((segment) => (
        <span
          key={segment.label}
          className="h-full"
          style={{
            width: `${(segment.total / max) * 100}%`,
            background: segment.fill,
          }}
        />
      ))}
    </>
  );
}

/**
 * Détail au survol de la ligne : la répartition en sous-catégories que la barre
 * ne fait que suggérer. Purement CSS (`group-hover`) — il n'y a rien à y
 * cliquer, la ligne entière est déjà un lien vers le zoom de la catégorie.
 */
export function CategoryBreakdownCard({
  item,
  segments,
  income,
}: {
  item: CategoryBreakdownItem;
  segments: CategorySegment[];
  income?: boolean;
}) {
  return (
    <div className="border-border-strong bg-card pointer-events-none absolute top-[38px] left-[170px] z-30 hidden w-[300px] rounded-xl border px-3 py-2.5 shadow-[0_20px_44px_-18px_oklch(0_0_0/0.42)] group-hover:block">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="truncate text-[12.5px] font-semibold">
          {item.category || "Sans catégorie"}
        </span>
        <span className="text-subtle flex-none text-[11px]">
          {segments.length > 1
            ? `${segments.length} sous-catégories`
            : "1 sous-catégorie"}
        </span>
        <span
          className={
            income ? "num text-ok ml-auto text-xs" : "num ml-auto text-xs"
          }
        >
          {euro.format(item.total)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className="grid grid-cols-[9px_minmax(0,1fr)_74px_34px] items-center gap-2"
          >
            <span
              className="size-2.5 rounded-[2px]"
              style={{ background: segment.color }}
            />
            <span
              className={
                segment.flagged
                  ? "text-warn truncate text-[11.5px]"
                  : "text-muted-foreground truncate text-[11.5px]"
              }
            >
              {segment.label}
            </span>
            <span className="num text-right text-[11px]">
              {euro.format(segment.total)}
            </span>
            <span className="text-subtle num text-right text-[11px]">
              {sharePercent(segment.total, item.total)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
