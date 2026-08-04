"use client";

import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { EpureeCategory } from "./epuree-panel";
import { shadeCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { CategoryIcon } from "../../categories/-components/category-icon";

export interface BreakdownItem {
  name: string;
  total: number;
  /** Teinte de la barre de fond, déjà résolue au thème. */
  color: string;
  /**
   * Nom d'icône Lucide. Trois états, pas deux : **absent** = pas d'emplacement
   * d'icône du tout (les sous-catégories n'en ont pas, elles se lisent dans la
   * famille de leur parent), `null` = parente sans icône choisie, l'emplacement
   * porte le carré pointillé de `CategoryIcon`. Aplatir le test en
   * `row.icon && …` ferait disparaître le second cas.
   */
  icon?: string | null;
  /**
   * Le segment « à classer » du poste : ce qui reste porté par la parente
   * elle-même. Barre en pointillé plutôt que pleine et triangle d'alerte —
   * c'est un reste à ranger, pas une sous-catégorie de plus.
   */
  aClasser?: boolean;
  /** Absent = ligne de lecture seule (les sous-catégories ne se creusent pas). */
  onSelect?: () => void;
  /** Infobulle : ce que fera le clic. */
  title?: string;
}

/** Largeur de la colonne des postes, la même sur les deux écrans de la revue. */
const BREAKDOWN_WIDTH = "w-[300px]";

// La maquette coupe à 13 lignes et replie le reste : au-delà, les barres
// deviennent illisibles et la colonne déborde.
const MAX_ROWS = 13;

/** Le plus gros poste donne l'échelle des barres ; `1` évite la division par zéro. */
const breakdownScale = (rows: BreakdownItem[]) =>
  Math.max(...rows.map((r) => r.total), 1);

/**
 * Les lignes du niveau affiché : les postes parents, ou les sous-catégories du
 * poste ouvert. Fonction pure, sans geste attaché — chaque écran décore ensuite
 * ce que le clic doit faire, et les deux ne font pas la même chose : sur `/` il
 * fait *descendre* l'anneau, sur `/transactions` il pose le filtre de catégorie.
 */
export function breakdownRows(
  categories: EpureeCategory[],
  parent: EpureeCategory | null,
  resolveColor: (color: string) => string,
): BreakdownItem[] {
  if (!parent)
    return categories.map((category) => ({
      name: category.name,
      total: category.total,
      color: resolveColor(category.color),
      icon: category.icon,
    }));

  // Une sous-catégorie n'a pas de couleur propre : c'est un palier de la teinte
  // de son parent, du plus dense au plus proche de la surface.
  const base = resolveColor(parent.color);
  return parent.subs.map((sub, index) => ({
    name: sub.name,
    total: sub.total,
    color: shadeCategoryColor(base, index, parent.subs.length),
    // `filter: null` est la marque du segment fabriqué par `byCategory` — le
    // reliquat porté par la parente, qu'aucune ligne de `categories` ne décrit.
    aClasser: sub.filter === null,
  }));
}

/**
 * Les postes du niveau affiché, du plus élevé au plus faible, chacun avec sa
 * barre de fond proportionnelle — la colonne de droite de la revue, à droite de
 * l'anneau sur `/` et de la table sur `/transactions`.
 *
 * Montée par chaque écran et non par le layout `_revue` : sur `/`, cliquer une
 * ligne fait descendre l'anneau dans ses sous-catégories, et le niveau de
 * l'anneau est un état de l'écran. Le composant qui commande ce niveau doit donc
 * porter le gestionnaire de la ligne (voir `EpureePanel`).
 *
 * Masquée sous `lg` : elle ne peut pas s'empiler sous l'écran courant, la table
 * y prendrait toute la hauteur. L'anneau, lui, se lit seul — son centre affiche
 * déjà le poste survolé et sa part.
 *
 * Sans intitulé : la maquette calcule toujours son « du plus élevé au plus
 * faible » / « N sous-catégories » mais le masque (`listMetaDisplay: 'none'`) —
 * le décompte des sous-catégories a migré en tête de la colonne de droite du
 * bandeau, au-dessus du poste ouvert.
 */
export function BreakdownList({
  rows,
  fold = false,
}: {
  rows: BreakdownItem[];
  /**
   * Replier la queue de liste sous un « + N autres ». La maquette ne le fait
   * **que** sur les sous-catégories (`shown = subs.slice(0, LIST_MAX)`), jamais
   * sur les catégories parentes, dont elle rend toujours la liste entière : au
   * premier niveau chaque ligne est une porte d'entrée vers ses enfants, et le
   * repli la condamnerait — c'est ce qui faisait disparaître « Sans catégorie »,
   * dernière de la liste par construction, derrière un « + 1 autres ».
   */
  fold?: boolean;
}) {
  const shown = fold ? rows.slice(0, MAX_ROWS) : rows;
  const rest = fold ? rows.slice(MAX_ROWS) : [];
  const restTotal = rest.reduce((acc, r) => acc + r.total, 0);
  // L'échelle porte sur **toutes** les lignes, repliées comprises : sinon la
  // barre du « + N autres » dépasserait celle du plus gros poste affiché.
  const max = breakdownScale(rows);

  return (
    <div
      className={cn(
        "hidden flex-none flex-col pt-0.5 lg:flex",
        BREAKDOWN_WIDTH,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
        {shown.map((row) => (
          <BreakdownRow key={row.name} row={row} max={max} />
        ))}
        {rest.length > 0 && (
          <BreakdownRow
            row={{
              name: `+ ${rest.length} autres`,
              total: restTotal,
              color: "var(--border-strong)",
            }}
            max={max}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Une ligne de répartition : la barre de fond proportionnelle, l'icône du poste,
 * l'intitulé, le montant. Partagée par les deux colonnes de postes de la revue —
 * seule la *source* des lignes et le geste attaché diffèrent d'un écran à
 * l'autre, le dessin de la ligne est le même.
 */
function BreakdownRow({ row, max }: { row: BreakdownItem; max: number }) {
  const content = (
    <>
      {/* Le segment « à classer » ne se peint pas : sa barre est un contour en
          pointillé (`bar: 'transparent'` + `barBorder` dans la maquette), pour
          qu'il ne se lise pas comme une sous-catégorie de plus. */}
      <span
        className="absolute inset-y-0 left-0 rounded-[7px]"
        style={{
          width: `${((row.total / max) * 100).toFixed(2)}%`,
          background: row.aClasser ? "transparent" : row.color,
          border: row.aClasser ? `1.5px dotted ${row.color}` : undefined,
          opacity: row.aClasser ? 0.85 : 0.42,
        }}
      />
      {/* `relative` sur les contenus : ils passent au-dessus de la barre, qui
          est en position absolue derrière eux. */}
      {row.aClasser ? (
        <TriangleAlertIcon
          className="text-warn relative size-[13px] flex-none"
          aria-hidden
        />
      ) : (
        row.icon !== undefined && (
          <span
            className="relative flex flex-none"
            style={{ color: row.color }}
          >
            <CategoryIcon name={row.icon} className="size-3.5" />
          </span>
        )
      )}
      <span
        className={cn(
          "relative min-w-0 flex-1 truncate text-[12.5px] tracking-[-0.01em]",
          row.aClasser ? "font-semibold" : "font-[450]",
        )}
      >
        {row.name}
      </span>
      <span className="num relative flex-none text-[11.5px]">
        {euro.format(row.total)}
      </span>
    </>
  );

  const className =
    "relative flex h-[30px] flex-none items-center gap-2 overflow-hidden rounded-[7px] pr-[9px] pl-2 text-left";

  return row.onSelect ? (
    <button
      type="button"
      title={row.title}
      onClick={row.onSelect}
      className={`${className} hover:bg-secondary`}
    >
      {content}
    </button>
  ) : (
    <div className={className} title={row.title}>
      {content}
    </div>
  );
}
