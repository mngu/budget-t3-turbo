"use client";

import { TriangleAlertIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { RevueCategory } from "~/lib/revue-categories";
import { shadeCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { CategoryIcon } from "../../categories/-components/category-icon";

export interface BreakdownItem {
  name: string;
  total: number;
  /** Teinte de la barre et de l'icône, déjà résolue au thème. */
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
   * elle-même. Barre hachurée plutôt que pleine et triangle d'alerte — c'est un
   * reste à ranger, pas une sous-catégorie de plus.
   */
  aClasser?: boolean;
  /** Absent = ligne de lecture seule (les sous-catégories ne se creusent pas). */
  onSelect?: () => void;
  /** Infobulle : ce que fera le clic. */
  title?: string;
}

/** Largeur de la colonne des postes, la même sur les deux écrans de la revue. */
const BREAKDOWN_WIDTH = "w-[254px]";

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
  categories: RevueCategory[],
  parent: RevueCategory | null,
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
 * Les postes du niveau affiché, du plus élevé au plus faible, chacun sous sa
 * barre proportionnelle — la colonne de droite de la revue, à droite de
 * l'anneau sur `/` et de la table sur `/transactions`.
 *
 * Montée par chaque écran et non par le layout `_revue` : sur `/`, cliquer une
 * ligne fait descendre l'anneau dans ses sous-catégories, et le niveau de
 * l'anneau est un état de l'écran. Le composant qui commande ce niveau doit donc
 * porter le gestionnaire de la ligne (voir `RevuePanel`).
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
      <div className="flex min-h-0 flex-1 [scrollbar-width:thin] [scrollbar-color:var(--border-strong)_transparent] flex-col gap-px overflow-y-auto pr-0.5">
        {/* Clé de **position** et non de nom : c'est ce qui fait exister la
            transition de la barre. Keyée par nom, chaque changement de niveau ou
            de période démonte toutes les lignes et les remonte à leur largeur
            finale — la transition est bien posée mais ne se déclenche jamais.
            Réutiliser le nœud de même rang le fait glisser de l'ancienne largeur
            à la nouvelle, comme le `sc-for` de la maquette. Sans danger ici : la
            ligne n'a ni état local ni champ de saisie. */}
        {shown.map((row, index) => (
          <BreakdownRow key={index} row={row} max={max} />
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
 * Emplacement d'icône : plus large que l'icône elle-même, et aligné par sa base
 * comme le reste de la rangée — d'où le décalage d'un pixel et demi, repris tel
 * quel de la maquette.
 */
const ICON_SLOT =
  "flex h-3.5 w-4 flex-none translate-y-[1.5px] items-center justify-center";

/**
 * Une ligne de répartition : l'icône du poste, l'intitulé, le montant, et sous
 * eux la barre proportionnelle. Partagée par les deux colonnes de postes de la
 * revue — seule la *source* des lignes et le geste attaché diffèrent d'un écran
 * à l'autre, le dessin de la ligne est le même (`Breakdown.dc.html`).
 *
 * La barre est **pleinement saturée sur sa propre rangée** et non un fond
 * translucide derrière le texte : c'est le changement du 2026-08-04, motivé
 * dans la maquette par la lisibilité de l'intitulé.
 */
function BreakdownRow({ row, max }: { row: BreakdownItem; max: number }) {
  return (
    // **Toujours un `<button>`**, désactivé quand la ligne ne se creuse pas, et
    // jamais un `<div>` selon le cas : React ne réutilise pas un nœud dont le
    // type d'élément change, et descendre dans un poste fait justement passer
    // toutes les lignes de cliquables à lecture seule. Le nœud était donc
    // reconstruit à sa largeur finale et la transition de la barre, pourtant
    // posée, ne se déclenchait jamais.
    <button
      type="button"
      title={row.title}
      disabled={!row.onSelect}
      onClick={row.onSelect}
      className="enabled:hover:bg-accent flex h-[37px] flex-none flex-col justify-center gap-1.5 rounded-lg pr-[9px] pl-2 text-left transition-colors duration-[130ms] motion-reduce:transition-none"
    >
      <div className="flex items-baseline gap-2">
        {row.aClasser ? (
          <span className={ICON_SLOT}>
            <TriangleAlertIcon className="text-warn size-[13px]" aria-hidden />
          </span>
        ) : (
          row.icon !== undefined && (
            <span className={ICON_SLOT} style={{ color: row.color }}>
              <CategoryIcon name={row.icon} className="size-3.5" />
            </span>
          )
        )}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-sm leading-[1.15] tracking-[-0.014em]",
            // Une ligne de poste et un reste à ranger pèsent leur plein poids ;
            // seules les sous-catégories rangées s'allègent.
            row.aClasser || row.icon !== undefined
              ? "font-semibold"
              : "font-[450]",
          )}
        >
          {row.name}
        </span>
        <span className="num flex-none text-[13px] leading-[1.15] tracking-[-0.02em]">
          {euro.format(row.total)}
        </span>
      </div>
      <div className="bg-border-strong/60 h-[3px] overflow-hidden rounded-full">
        {/* Le segment « à classer » ne se peint pas plein : sa barre est hachurée
            (`barBorder` dans la maquette), pour qu'il ne se lise pas comme une
            sous-catégorie de plus. */}
        <span
          className="block h-full min-w-[3px] rounded-full transition-[width] duration-[260ms] ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
          style={{
            width: `${((row.total / max) * 100).toFixed(2)}%`,
            background: row.aClasser
              ? `repeating-linear-gradient(90deg, ${row.color} 0 3px, transparent 3px 6px)`
              : row.color,
          }}
        />
      </div>
    </button>
  );
}
