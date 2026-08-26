import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cva } from "class-variance-authority";

import { cn } from "@budget/ui";

// §4.10. Deux écarts avec la sortie de `shadcn add`, dictés par la maquette :
// le fond est le `*-soft` de l'état (shadcn laisse toutes les variantes sur
// `--card` et ne colore que le texte), et **le texte reste en `--fg`** — seule
// la vignette porte la teinte. C'est la règle « chaque état a sa couleur, pas
// son icône » lue à l'envers : la couleur dit l'état une fois, à un endroit,
// et un titre en ambre sur fond ambre ne se lirait pas mieux pour autant.
const alertVariants = cva(
  "group/alert relative grid w-full gap-1 rounded-lg border px-5 py-4 text-left has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-4 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive: "bg-bad-soft border-bad-soft *:[svg]:text-destructive",
        // Même ajout que sur `Badge` : le vocabulaire d'états de l'app compte
        // trois couleurs, le registre n'en connaît qu'une.
        ok: "bg-ok-soft border-ok-soft *:[svg]:text-ok",
        warn: "bg-warn-soft border-warn-soft *:[svg]:text-warn",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "[&_a]:hover:text-foreground text-subheading group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3",
        className,
      )}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground [&_a]:hover:text-foreground text-control text-balance md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
        className,
      )}
      {...props}
    />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
