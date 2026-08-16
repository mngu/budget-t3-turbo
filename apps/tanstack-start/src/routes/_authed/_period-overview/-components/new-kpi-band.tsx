import type { BudgetStats, GlobalStats } from "@budget/shared";
import { cn } from "@budget/ui";

import { euro0, signedEuro0 } from "~/lib/format";
import { Gauge } from "./gauge";

interface NewKpiBandProps {
  budgetStats: BudgetStats;
  globalStats: GlobalStats;
}

export function NewKpiBand({ budgetStats, globalStats }: NewKpiBandProps) {
  const { credit, debit } = globalStats;
  const balance = credit - debit;
  const maxValue = Math.max(debit, credit);
  const { totalAmount, totalBudget } = budgetStats;

  return (
    <div className="flex gap-10">
      <div>
        <div className="label-caps">Solde</div>
        <div
          className={cn(
            "num text-hero mt-0.5",
            balance < 0 ? "text-bad" : "text-ok",
          )}
        >
          {signedEuro0.format(balance)}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-4">
          <span className="label-caps w-12 flex-none">Entrées</span>
          <div className="flex-1">
            <Gauge
              value={credit}
              budget={null}
              max={maxValue}
              color="#00ff00"
            />
          </div>
          <span className="num text-amount text-muted-foreground flex-none text-right">
            {euro0.format(credit)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="label-caps w-12 flex-none">Sorties</span>
          <div className="flex-1">
            <Gauge value={debit} budget={null} max={maxValue} color="#ff0000" />
          </div>
          <span className="num text-amount text-muted-foreground flex-none text-right">
            {euro0.format(debit)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span className="label-caps w-12 flex-none">Budget</span>
          <div className="flex-1">
            <Gauge
              value={totalAmount}
              budget={totalBudget}
              max={maxValue}
              color="#888888"
            />
          </div>
          <span className="num text-amount text-muted-foreground flex-none text-right">
            {euro0.format(totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
