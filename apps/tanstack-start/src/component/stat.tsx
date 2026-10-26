import { cn } from "@budget/ui";

export function Stat({
  value,
  label,
  tone,
}: {
  value: number | string;
  label: string;
  /** Text color class for the value, e.g. a running or failed state. */
  tone?: string;
}) {
  return (
    <div className="border-border border-l px-3 text-right first:border-l-0 first:pl-0 last:pr-0">
      <div className={cn("num text-heading font-medium", tone)}>
        {typeof value === "number" ? value.toLocaleString("fr-FR") : value}
      </div>
      <div className="label-caps mt-0.5">{label}</div>
    </div>
  );
}
