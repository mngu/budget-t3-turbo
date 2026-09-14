"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@budget/ui";

/**
 * Ajout au jeu de `shadcn add` : la barre porte parfois un état plutôt qu'une
 * simple avancée (une échéance qui approche, par exemple). Même vocabulaire à
 * trois couleurs que `Badge` et `Alert` — l'indicateur est rendu par `Progress`
 * lui-même, il n'y a pas d'autre façon de le teindre depuis l'appelant.
 */
const INDICATOR_VARIANT = {
  default: "bg-primary",
  ok: "bg-ok",
  warn: "bg-warn",
  destructive: "bg-destructive",
};

function Progress({
  className,
  children,
  value,
  variant = "default",
  ...props
}: ProgressPrimitive.Root.Props & {
  variant?: keyof typeof INDICATOR_VARIANT;
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator className={INDICATOR_VARIANT[variant]} />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        // `bg-track` et non le `bg-muted` de `shadcn add` : `--muted` est à 2 %
        // de `--card`, la piste vide y est invisible. `--track` est le token que
        // toutes les autres barres de l'app utilisent (jauges de budget,
        // bandeau) — une piste doit se lire même à zéro.
        "bg-track relative flex h-1 w-full items-center overflow-x-hidden rounded-full",
        className,
      )}
      data-slot="progress-track"
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full transition-all", className)}
      {...props}
    />
  );
}

export { Progress };
