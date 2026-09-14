import { cn } from "@budget/ui";

/**
 * Les chiffres d'un dialogue de confirmation, avant la phrase : ce qui décide,
 * c'est le nombre de lignes que le geste touche. `tone` colore le chiffre
 * (`text-bad`, `text-ok`) ; sans lui, il est `destructive`.
 */
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
          <span className="text-muted-foreground text-control">
            {fact.label}
          </span>
        </div>
      ))}
    </div>
  );
}
