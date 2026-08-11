import type { VariantProps } from "class-variance-authority";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva } from "class-variance-authority";

import { cn } from "@budget/ui";

// §4.6 du handoff. Trois écarts avec la sortie de `shadcn add`, tous voulus :
// le rayon est `md` (8 px) et non `lg` (12) — un bouton est un *contrôle*, la
// carte seule a droit à 12 ; le texte est le cran `control` (12 px) et non
// `text-sm` (14) ; et la graisse descend dans les variantes, parce que le
// système en donne une par rôle (plein 600, contour 550, tertiaire courant) là
// où shadcn en pose une seule pour tous.
const buttonVariants = cva(
  "group/button focus-visible:border-ring focus-visible:ring-accent-soft aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 text-control inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding whitespace-nowrap transition-all outline-none select-none focus-visible:ring-3 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:ring-3 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground font-semibold hover:bg-primary/80",
        // Secondaire : contour marqué sur fond transparent, survol *teinté*
        // (`--tint`) et non neutre — c'est le seul bouton que la maquette
        // teinte au survol, le tertiaire prenant le survol de ligne.
        outline:
          "border-border-strong text-foreground hover:bg-tint aria-expanded:bg-tint bg-transparent font-medium",
        secondary:
          "bg-secondary text-secondary-foreground aria-expanded:bg-secondary aria-expanded:text-secondary-foreground font-medium hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
        // Rouge *plein*, conformément au tableau des boutons — la version douce
        // de shadcn n'existe pas dans le système. « Le rouge plein n'apparaît
        // que sur une destruction confirmée » : c'est donc au dialogue de
        // confirmation de le porter, pas à un bouton de liste.
        destructive:
          "bg-destructive text-primary-foreground focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 font-semibold hover:bg-destructive/90",
        link: "text-primary font-medium underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 px-2 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        // 28 px : le « contrôle de barre » du tableau des gabarits.
        sm: "h-7 gap-1 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        // 28 × 28 : le gabarit du bouton icône de la maquette.
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
