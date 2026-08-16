import { cn } from "@budget/ui";

interface GaugeProps {
  value: number;
  budget: number | null;
  max: number;
  color: string | null;
}

export function Gauge({ max, value, budget, color }: GaugeProps) {
  const pct = (value: number) => `${((value / max) * 100).toFixed(2)}%`;

  const over = budget === null ? null : Math.max(0, value - budget);
  const computedValue = budget ? Math.min(value, budget) : value;

  const valuePct = pct(computedValue);
  const overPct = pct(over ?? 0);
  const budgetPct = pct(budget ?? 0);

  return (
    <span className="bg-track relative block h-2 overflow-hidden rounded-full">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: valuePct, background: color ?? "grey" }}
      />
      {over && over > 0 ? (
        <span
          className={cn("bg-bad absolute inset-y-0 min-w-1 rounded-full")}
          style={{
            left: `calc(${valuePct} + 2px)`,
            width: `calc(${overPct} - 2px)`,
          }}
        />
      ) : (
        over !== null && (
          <span
            className="bg-foreground absolute top-0 h-4 w-[2px]"
            style={{ left: budgetPct }}
          />
        )
      )}
    </span>
  );
}
