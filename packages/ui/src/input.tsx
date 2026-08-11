import type * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@budget/ui";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        // §4.7 « Champ » : 32 px, rayon 8, fond `--bg`, contour `--border-strong`,
        // texte 12. Le fond est explicite et non `transparent` : un champ posé
        // dans une carte ou un dialogue doit rester *plus bas* que sa surface,
        // c'est ce qui le donne à voir comme une entrée. Le halo de focus est
        // `--primary-soft` (3 px), pas l'anneau translucide de shadcn.
        "border-border-strong bg-background file:text-foreground placeholder:text-subtle focus-visible:border-ring focus-visible:ring-accent-soft disabled:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 text-control h-8 w-full min-w-0 rounded-md border px-2.5 py-1 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-control file:font-medium focus-visible:ring-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:ring-3",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
