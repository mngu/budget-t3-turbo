import type * as React from "react";

import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@budget/ui";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "border-border-strong bg-background file:text-foreground placeholder:text-subtle focus-visible:border-ring focus-visible:ring-accent-soft disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 text-control file:text-control h-8 w-full min-w-0 rounded-md border px-2.5 py-1 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-3",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
