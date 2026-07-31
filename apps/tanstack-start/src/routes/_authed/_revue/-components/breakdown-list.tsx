"use client";

import { euro } from "~/lib/format";

export interface BreakdownRow {
  name: string;
  total: number;
  /** Teinte de la barre de fond, déjà résolue au thème. */
  color: string;
  /** Absent = ligne de lecture seule (les sous-catégories ne se creusent pas). */
  onSelect?: () => void;
}

// La maquette coupe à 13 lignes et replie le reste : au-delà, les barres
// deviennent illisibles et la colonne déborde.
const MAX_ROWS = 13;

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
export function BreakdownList({ rows }: { rows: BreakdownRow[] }) {
  const shown = rows.slice(0, MAX_ROWS);
  const rest = rows.slice(MAX_ROWS);
  const restTotal = rest.reduce((acc, r) => acc + r.total, 0);
  const max = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div
      // `max-h-[45%]` en colonne : l'anneau garde la moitié haute de l'écran et
      // la liste défile pour son compte, comme elle le fait déjà à droite.
      className="flex max-h-[45%] w-full flex-none flex-col pt-0.5 lg:max-h-none lg:w-[300px] lg:pr-4"
      // Cliquer *à côté* de l'anneau referme la sélection ; la liste fait
      // partie de l'écran actif, pas du décor.
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-2.5">
        {shown.map((row) => (
          <Row key={row.name} row={row} max={max} />
        ))}
        {rest.length > 0 && (
          <Row
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

function Row({ row, max }: { row: BreakdownRow; max: number }) {
  const content = (
    <>
      <span
        className="absolute inset-y-0 left-0 rounded-md"
        style={{
          width: `${((row.total / max) * 100).toFixed(2)}%`,
          background: row.color,
          opacity: 0.42,
        }}
      />
      <span className="relative flex-1 truncate text-[11px]">{row.name}</span>
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
      onClick={(event) => {
        event.stopPropagation();
        row.onSelect?.();
      }}
      className={`${className} hover:bg-secondary`}
    >
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
