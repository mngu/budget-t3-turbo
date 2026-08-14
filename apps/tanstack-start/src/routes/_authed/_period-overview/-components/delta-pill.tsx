import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { Delta } from "../-lib/history";
import { signedEuro0 } from "~/lib/format";

/**
 * Écart en pourcentage. Sa couleur ne suit pas son signe mais sa *polarité* :
 * des sorties en hausse sont une mauvaise nouvelle, des entrées en hausse non.
 */
export function DeltaPill({
  delta,
  worseWhenUp,
  className,
}: {
  delta: Delta | null;
  worseWhenUp: boolean;
  className?: string;
}) {
  // Pas de pourcentage quand la référence vaut zéro : « +∞ % » ne dit rien que
  // l'écart en euros ne dise mieux.
  if (delta?.pct == null) return null;
  const bad = worseWhenUp ? delta.amount > 0 : delta.amount < 0;
  return (
    <span
      className={cn(
        "num text-meta flex h-5 flex-none items-center gap-1 rounded-full px-2 font-semibold",
        bad ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok",
        className,
      )}
    >
      {/* Aucune flèche à l'écart nul, comme la maquette : il n'y a pas de sens
          à montrer. */}
      {delta.amount > 0 && <TrendingUpIcon className="size-3" aria-hidden />}
      {delta.amount < 0 && <TrendingDownIcon className="size-3" aria-hidden />}
      {signedPercent.format(delta.pct)} %
    </span>
  );
}

/** L'écart en euros, second rôle de la pastille. */
export function DeltaAmount({
  delta,
  worseWhenUp,
  className,
}: {
  delta: Delta | null;
  /** Absent = la mention reste neutre, comme sous le solde de la maquette. */
  worseWhenUp?: boolean;
  className?: string;
}) {
  if (!delta) return null;
  const bad =
    worseWhenUp === undefined
      ? undefined
      : worseWhenUp
        ? delta.amount > 0
        : delta.amount < 0;
  return (
    <span
      className={cn(
        "num flex-none text-right whitespace-nowrap",
        bad === undefined ? undefined : bad ? "text-bad" : "text-ok",
        className,
      )}
    >
      {signedEuro0.format(delta.amount)} vs moy.
    </span>
  );
}

const signedPercent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
