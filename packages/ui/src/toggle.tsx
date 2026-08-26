"use client";

import type { VariantProps } from "class-variance-authority";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cva } from "class-variance-authority";

import { cn } from "@budget/ui";

const toggleVariants = cva(
  // L'état enfoncé sort de la sortie de `shadcn add`, qui le pose sur
  // `bg-muted` : dans cette palette, `--muted` est à 2 % de `--card` et la
  // sélection est invisible. `accent-soft` + `primary` est le vocabulaire de
  // « choisi » du reste de l'app.
  "group/toggle text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:border-ring focus-visible:ring-accent-soft aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-accent-soft aria-pressed:text-primary data-[state=on]:bg-accent-soft data-[state=on]:text-primary dark:aria-invalid:ring-destructive/40 text-control inline-flex items-center justify-center gap-1 rounded-md whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-40 aria-pressed:font-semibold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
      },
      size: {
        default:
          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        sm: "h-7 min-w-7 px-2.5 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
