"use client";

import { cva } from "class-variance-authority";

const toggleVariants = cva(
  "group/toggle text-muted hover:bg-default hover:text-foreground focus-visible:border-ring focus-visible:ring-accent-soft aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-pressed:bg-accent-soft aria-pressed:text-primary data-[state=on]:bg-accent-soft data-[state=on]:text-primary dark:aria-invalid:ring-destructive/40 text-control inline-flex items-center justify-center gap-1 rounded-md whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-40 aria-pressed:font-semibold [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
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

export { toggleVariants };
