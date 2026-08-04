"use client";

import { cn } from "@budget/ui";

import { euro } from "~/lib/format";

export interface BreakdownItem {
  name: string;
  total: number;
  /** Teinte de la barre de fond, déjà résolue au thème. */
  color: string;
  /** Absent = ligne de lecture seule (les sous-catégories ne se creusent pas). */
  onSelect?: () => void;
  /** Ligne dont le filtre est posé : intitulé en gras. */
  active?: boolean;
  /** Un filtre est posé sur une *autre* ligne : barre estompée, pas masquée. */
  dimmed?: boolean;
  /** Infobulle : ce que fera le clic. */
  title?: string;
}

/**
 * Largeur de la colonne des postes, partagée par les deux listes qui
 * l'occupent — `BreakdownList` à droite de l'anneau, `CategorySideList` à droite
 * de la table : d'un écran à l'autre c'est la même colonne.
 */
export const BREAKDOWN_WIDTH = "lg:w-[300px]";

// La maquette coupe à 13 lignes et replie le reste : au-delà, les barres
// deviennent illisibles et la colonne déborde.
const MAX_ROWS = 13;

/** Le plus gros poste donne l'échelle des barres ; `1` évite la division par zéro. */
export const breakdownScale = (rows: BreakdownItem[]) =>
  Math.max(...rows.map((r) => r.total), 1);

/**
 * Les postes du niveau affiché, du plus élevé au plus faible, chacun avec sa
 * barre de fond proportionnelle — l'histogramme horizontal qui accompagne
 * l'anneau.
 *
 * Affiché à **toutes** les largeurs : à droite de l'anneau à partir de `lg`,
 * en dessous sur les fenêtres plus étroites.
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
      // `max-h-[45%]` en colonne : l'anneau garde la moitié haute de l'écran et
      // la liste défile pour son compte, comme elle le fait déjà à droite.
      className={cn(
        "flex max-h-[45%] w-full flex-none flex-col pt-0.5 lg:max-h-none",
        BREAKDOWN_WIDTH,
      )}
      // Cliquer *à côté* de l'anneau referme la sélection ; la liste fait
      // partie de l'écran actif, pas du décor.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
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
 * Une ligne de répartition : la barre de fond proportionnelle, l'intitulé, le
 * montant. Partagée par les deux colonnes de postes de la revue — seule la
 * *source* des lignes et l'enveloppe qui les défile diffèrent d'un écran à
 * l'autre, le dessin de la ligne est le même.
 *
 * `stopPropagation` est ici et non chez l'appelant : sur la revue, le conteneur
 * de l'anneau referme la sélection au clic (`onClick={clear}`), et sans ce
 * garde-fou cliquer un poste le sélectionnerait puis le refermerait aussitôt.
 * L'autre écran n'a aucun gestionnaire ancêtre, la garde y est inerte.
 */
export function BreakdownRow({
  row,
  max,
}: {
  row: BreakdownItem;
  max: number;
}) {
  const content = (
    <>
      <span
        className="absolute inset-y-0 left-0 rounded-md"
        style={{
          width: `${((row.total / max) * 100).toFixed(2)}%`,
          background: row.color,
          opacity: row.dimmed ? 0.16 : 0.42,
        }}
      />
      {/* `relative` sur les deux contenus : ils passent au-dessus de la barre,
          qui est en position absolue derrière eux. */}
      <span
        className={cn(
          "relative min-w-0 flex-1 truncate text-[11px]",
          row.active && "font-semibold",
        )}
      >
        {row.name}
      </span>
      <span className="num text-muted-foreground relative flex-none text-[10.5px]">
        {euro.format(row.total)}
      </span>
    </>
  );

  const className =
    "relative flex h-[23px] flex-none items-center gap-2 overflow-hidden rounded-md pr-2.5 pl-2 text-left";

  return row.onSelect ? (
    <button
      type="button"
      title={row.title}
      onClick={(event) => {
        event.stopPropagation();
        row.onSelect?.();
      }}
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
