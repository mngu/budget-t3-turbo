import { cn } from "@budget/ui";

/**
 * Un compteur d'en-tête de page : le nombre au-dessus de son étiquette
 * capitale. `/budgets` et `/categories` en avaient chacun une définition, à
 * l'octet près.
 *
 * Les filets verticaux font partie du composant et non de l'appelant : c'est ce
 * qui tient les compteurs ensemble comme un bloc plutôt que comme une rangée de
 * boutons, et une rangée où seul le premier oublierait `first:border-l-0` se
 * verrait immédiatement.
 */
export function Stat({
  value,
  label,
  warn,
}: {
  value: number | string;
  label: string;
  /** Ambre : le compteur signale un état à traiter (postes sans budget, teintes en collision). */
  warn?: boolean;
}) {
  return (
    <div className="border-border border-l px-3 text-right first:border-l-0 first:pl-0 last:pr-0">
      <div className={cn("num text-heading font-medium", warn && "text-warn")}>
        {value}
      </div>
      <div className="label-caps mt-0.5">{label}</div>
    </div>
  );
}
