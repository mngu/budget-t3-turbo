import { cn } from "@budget/ui";

export function DialogFacts({
  facts,
}: {
  facts: { n: number; label: string; tone?: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-2.5"
        >
          <span
            className={cn(
              "num text-body text-right font-medium",
              fact.tone ?? "text-destructive",
            )}
          >
            {fact.n}
          </span>
          <span className="text-muted text-control">{fact.label}</span>
        </div>
      ))}
    </div>
  );
}
