import { cn } from "@budget/ui";

export function Stat({
  value,
  label,
  warn,
  tile,
}: {
  value: number | string;
  label: string;
  /** Highlights counts that need attention, such as missing budgets or color collisions. */
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
