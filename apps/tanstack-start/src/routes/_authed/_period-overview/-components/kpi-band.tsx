import type { BudgetStats, GlobalStats } from "@budget/api/schemas";

import { cn } from "@budget/ui";
import { useCategoryColor } from "~/lib/category-color";
import { useFormat } from "~/lib/use-format";

import { Gauge } from "./gauge";

interface KpiBandProps {
  budgetStats: BudgetStats;
  globalStats: GlobalStats;
}

export function KpiBand({ budgetStats, globalStats }: KpiBandProps) {
  const { signedEuro } = useFormat();
  const getColor = useCategoryColor();
  const { credit, debit } = globalStats;
  const balance = credit - debit;
  const maxValue = Math.max(debit, credit);
  const { totalAmount, totalBudget } = budgetStats;

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-10">
      <div>
        <div className="label-caps">Solde</div>
        <div
          className={cn(
            "num text-hero mt-0.5",
            balance < 0 ? "text-bad" : "text-ok",
          )}
        >
          {signedEuro.format(balance)}
        </div>
      </div>

      <div className="lg:w-1/2">
        <KpiBar
          label="Entrées"
          value={credit}
          color={getColor("#00c65a")}
          max={maxValue}
        />

        <KpiBar
          label="Sorties"
          value={debit}
          color={getColor("#fb2c36")}
          max={maxValue}
        />

        <KpiBar
          label="Budget"
          value={totalAmount}
          budget={totalBudget}
          color="#888888"
          max={maxValue}
        />
      </div>
    </div>
  );
}

interface KpiBarProps {
  value: number;
  budget?: number | null;
  max: number;
  color: string;
  label: string;
}

function KpiBar({ value, budget, max, color, label }: KpiBarProps) {
  const { euro } = useFormat();
  return (
    <div className="flex items-center gap-4">
      <span className="label-caps w-12 flex-none">{label}</span>
      <div className="flex-1">
        <Gauge value={value} budget={budget} max={max} color={color} />
      </div>
      <span className="num text-amount text-muted-foreground w-30 flex-none text-right">
        {euro.format(value)}
      </span>
    </div>
  );
}
