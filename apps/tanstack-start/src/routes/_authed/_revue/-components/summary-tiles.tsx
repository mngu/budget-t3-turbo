"use client";

import { Link } from "@tanstack/react-router";

import { cn } from "@budget/ui";

import type { Comparison } from "~/lib/history";
import { euro } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";

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
      width="60"
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

const tileClass =
  "border-border bg-card rounded-xl border px-4 py-3.5 text-left";
const amountClass =
  "num my-1 text-[clamp(18px,1.7vw,24px)] font-medium tracking-[-0.03em] whitespace-nowrap";

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
      <div className="text-subtle text-[11px]">
        Pas d'historique de comparaison
      </div>
    );

  const bad = worseWhenUp ? comparison.deltaPct > 0 : comparison.deltaPct < 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      <Sparkline
        points={comparison.points}
        tone={bad ? "var(--warn)" : "var(--muted-foreground)"}
      />
    </div>
  );
}

export function SummaryTiles({
  expenses,
  revenues,
  expensesComparison,
  revenuesComparison,
  negativeMonths,
  unallocated,
  unallocatedShare,
  unallocatedCategories,
}: {
  expenses: number;
  revenues: number;
  expensesComparison: Comparison;
  revenuesComparison: Comparison;
  negativeMonths: number;
  unallocated: number;
  unallocatedShare: string;
  unallocatedCategories: number;
}) {
  const { search } = useRevueSearch();
  const balance = revenues - expenses;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
      <div className={tileClass}>
        <div className="text-muted-foreground text-[11.5px]">Dépenses</div>
        <div className={amountClass}>{euro.format(expenses)}</div>
        <ComparisonRow comparison={expensesComparison} worseWhenUp />
      </div>

      <div className={tileClass}>
        <div className="text-muted-foreground text-[11.5px]">Revenus</div>
        <div className={amountClass}>{euro.format(revenues)}</div>
        <ComparisonRow comparison={revenuesComparison} worseWhenUp={false} />
      </div>

      <div className={tileClass}>
        <div className="text-muted-foreground text-[11.5px]">Solde du mois</div>
        <div className={cn(amountClass, balance < 0 ? "text-bad" : "text-ok")}>
          {euro.format(balance)}
        </div>
        <div className="text-subtle text-[11px]">
          {negativeMonths > 1
            ? `${negativeMonths}ᵉ mois négatif d'affilée`
            : negativeMonths === 1
              ? "Premier mois négatif"
              : "Mois à l'équilibre"}
        </div>
      </div>

      {/* La tuile « non ventilé » est la seule action de la rangée : c'est le
          point d'entrée vers l'écran de ventilation. */}
      <Link
        to="/ventiler"
        search={search}
        className={cn(tileClass, "border-warn hover:bg-warn-soft block")}
      >
        <div className="flex items-center gap-2">
          <span className="text-warn text-[11.5px] font-semibold">
            Non ventilé
          </span>
          <span className="text-warn border-warn ml-auto rounded-full border px-2 text-[11px] font-semibold">
            Ventiler ›
          </span>
        </div>
        <div className={amountClass}>{euro.format(unallocated)}</div>
        <div className="bg-track mb-1.5 h-1.5 overflow-hidden rounded-full">
          <div
            className="h-full"
            style={{
              width: unallocatedShare,
              background:
                "repeating-linear-gradient(115deg,var(--warn) 0 4px,transparent 4px 8px),var(--warn-soft)",
            }}
          />
        </div>
        <div className="text-muted-foreground text-[11px]">
          {unallocatedShare} des dépenses · {unallocatedCategories} catégories
          concernées
        </div>
      </Link>
    </div>
  );
}
