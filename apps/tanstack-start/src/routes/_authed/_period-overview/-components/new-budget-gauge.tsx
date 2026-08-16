import { cn } from "@budget/ui";

import { CategoryIcon } from "~/component/category-icon";
import { euro } from "~/lib/format";
import { Gauge } from "~/routes/_authed/_period-overview/-components/gauge";

interface NewBudgetGaugeProps {
  value: number;
  budget: number | null;
  label: string | null;
  iconName: string | null;
  max: number;
  color: string | null;
  valueSize?: "xl" | "md";
}

export function NewBudgetGauge({
  value,
  label,
  iconName,
  max,
  color,
  budget = null,
  valueSize = "md",
}: NewBudgetGaugeProps) {
  const balance = (budget ?? 0) - value;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryIcon name={iconName} aria-hidden color={color} />
          <span className="text-subheading">{label}</span>
        </div>
        <span
          className={cn("num text-amount", { "text-body": valueSize === "md" })}
        >
          {euro.format(value)}
        </span>
      </div>
      <Gauge value={value} budget={budget} max={max} color={color} />

      {budget && (
        <div className="text-subtle num text-label flex justify-between">
          <span>Budget: {euro.format(budget)}</span>
          {balance < 0 ? (
            <span className="text-bad font-semibold">
              +{euro.format(Math.abs(balance))}
            </span>
          ) : (
            <span>reste {euro.format(balance)}</span>
          )}
        </div>
      )}
    </div>
  );
}
