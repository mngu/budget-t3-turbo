"use client";

import { cn } from "@budget/ui";

import type { Comparison } from "~/lib/history";
import { euro } from "~/lib/format";

const signedPercent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

// Sparkline de 6 mois : la forme suffit, il n'y a ni axe ni échelle à lire.
// Volontairement sans point ni tooltip — c'est un repère, pas un graphique.
function Sparkline({ points, tone }: { points: number[]; tone: string }) {
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const path = points
    .map((value, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * 60;
      const y = 16 - ((value - min) / span) * 14;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width="66"
      height="18"
      viewBox="0 0 60 18"
      aria-hidden
      className="ml-auto block overflow-visible"
    >
      <polyline
        points={path}
        fill="none"
        stroke={tone}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Les trois chiffres du mois tiennent dans une seule carte séparée par des
// filets, et non en tuiles détachées : ils se lisent comme une équation
// (sorties, entrées, ce qu'il reste), pas comme trois indicateurs distincts.
const cellClass =
  "border-border flex flex-col justify-center gap-1 px-4.5 py-3 not-last:border-r";
const amountClass =
  "num text-[clamp(18px,1.5vw,24px)] font-medium tracking-[-0.03em] whitespace-nowrap";

function ComparisonRow({
  comparison,
  /** Sens dans lequel une hausse est une mauvaise nouvelle. */
  worseWhenUp,
}: {
  comparison: Comparison;
  worseWhenUp: boolean;
}) {
  if (comparison.deltaPct === null)
    return (
      <div className="text-subtle min-h-[18px] text-[11px]">
        Pas d'historique de comparaison
      </div>
    );

  const bad = worseWhenUp ? comparison.deltaPct > 0 : comparison.deltaPct < 0;
  return (
    <div className="flex min-h-[18px] flex-wrap items-center gap-2">
      <span
        className={cn(
          "rounded-[5px] px-1.5 py-px text-[11.5px] font-semibold",
          bad
            ? "text-warn bg-warn-soft"
            : "text-muted-foreground bg-secondary border-border border",
        )}
      >
        {signedPercent.format(comparison.deltaPct)} %
      </span>
      <span className="text-subtle text-[11px]">vs moy. 3 mois</span>
    </div>
  );
}

export function SummaryTiles({
  expenses,
  revenues,
  expensesComparison,
  revenuesComparison,
  negativeMonths,
}: {
  expenses: number;
  revenues: number;
  expensesComparison: Comparison;
  revenuesComparison: Comparison;
  negativeMonths: number;
}) {
  const balance = revenues - expenses;

  return (
    <div className="border-border bg-card grid grid-cols-[repeat(3,minmax(0,1fr))] overflow-hidden rounded-xl border">
      <div className={cellClass}>
        <div className="text-muted-foreground text-[11.5px]">Sorties</div>
        <div className="flex items-baseline gap-3">
          <span className={amountClass}>{euro.format(expenses)}</span>
          <Sparkline
            points={expensesComparison.points}
            tone={
              (expensesComparison.deltaPct ?? 0) > 0
                ? "var(--warn)"
                : "var(--muted-foreground)"
            }
          />
        </div>
        <ComparisonRow comparison={expensesComparison} worseWhenUp />
      </div>

      <div className={cellClass}>
        <div className="text-muted-foreground text-[11.5px]">Entrées</div>
        <div className="flex items-baseline gap-3">
          <span className={cn(amountClass, "text-ok")}>
            {euro.format(revenues)}
          </span>
          <Sparkline
            points={revenuesComparison.points}
            tone={
              (revenuesComparison.deltaPct ?? 0) < 0
                ? "var(--warn)"
                : "var(--muted-foreground)"
            }
          />
        </div>
        <ComparisonRow comparison={revenuesComparison} worseWhenUp={false} />
      </div>

      <div className={cellClass}>
        <div className="text-muted-foreground text-[11.5px]">Solde du mois</div>
        <div className={cn(amountClass, balance < 0 ? "text-bad" : "text-ok")}>
          {euro.format(balance)}
        </div>
        <div className="text-subtle min-h-[18px] text-[11px]">
          {negativeMonths > 1
            ? `${negativeMonths}ᵉ mois négatif d'affilée`
            : negativeMonths === 1
              ? "Premier mois négatif"
              : "Mois à l'équilibre"}
        </div>
      </div>
    </div>
  );
}
