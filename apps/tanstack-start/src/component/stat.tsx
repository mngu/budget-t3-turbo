import { cn } from "@budget/ui";

/**
 * Un compteur : le nombre au-dessus de son étiquette capitale. Deux places dans
 * l'app, deux habits : l'en-tête d'une page (`aside`, filets à gauche, chiffre
 * en `heading`) et la tuile d'une grille (`tile`, filets à droite, chiffre en
 * `body`).
 *
 * Les filets font partie du composant et non de l'appelant : c'est ce qui tient
 * les compteurs ensemble comme un bloc plutôt que comme une rangée de boutons,
 * et une rangée où seul le premier oublierait `first:border-l-0` se verrait
 * immédiatement.
 */
export function Stat({
  value,
  label,
  warn,
  tile,
}: {
  value: number | string;
  label: string;
  /** Ambre : le compteur signale un état à traiter (postes sans budget, teintes en collision). */
  warn?: boolean;
  tile?: boolean;
}) {
  return (
    <div
      className={
        tile
          ? "border-border border-r px-4 py-2.5 last:border-r-0"
          : "border-border border-l px-3 text-right first:border-l-0 first:pl-0 last:pr-0"
      }
    >
      <div
        className={cn(
          "num font-medium",
          tile ? "text-body" : "text-heading",
          warn && "text-warn",
        )}
      >
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
      <div className="label-caps mt-0.5">{label}</div>
    </div>
  );
}
