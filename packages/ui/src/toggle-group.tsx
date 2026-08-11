"use client";

import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";

import { cn } from "@budget/ui";

import { toggleVariants } from "./toggle";

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    orientation?: "horizontal" | "vertical";
  }
>({
  size: "default",
  variant: "default",
  orientation: "horizontal",
});

/**
 * La bascule segmentée du système (§4.7) : un rail creux `--sunken` contouré,
 * rayon 8, marge intérieure de 2 px, dans lequel l'option retenue est une
 * *carte* posée (`--card` + contour) et les autres du texte `--muted`.
 *
 * Le rail est porté par le composant et non par l'appelant, qui le refaisait
 * jusqu'ici à la main (`variant="outline" spacing={0}` plus un commentaire
 * expliquant pourquoi l'état actif par défaut ne se voyait pas) — c'est très
 * exactement le signal décrit par l'ADR-0001 : une classe à l'appel dit qu'il
 * manque une variante.
 *
 * Le prop `spacing` est parti avec : des options séparées par une gouttière ne
 * forment pas un segmenté, elles forment trois boutons. La machinerie de
 * bordures jointes qu'il pilotait (`rounded-none` plus un rayon rendu au
 * premier et au dernier) n'a plus d'objet une fois chaque option posée en carte
 * dans le rail.
 */
function ToggleGroup({
  className,
  variant,
  size,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    orientation?: "horizontal" | "vertical";
  }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-orientation={orientation}
      className={cn(
        "group/toggle-group bg-sunken border-border flex w-fit flex-row items-center rounded-md border p-0.5 data-vertical:flex-col data-vertical:items-stretch",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant ?? variant}
      data-size={context.size ?? size}
      className={cn(
        "shrink-0 border border-transparent focus:z-10 focus-visible:z-10",
        toggleVariants({
          variant: context.variant ?? variant,
          size: context.size ?? size,
        }),
        // Posé *après* `toggleVariants` : l'option retenue d'un segmenté est
        // une carte surélevée sur le rail, pas la teinte pâle que porte un
        // `Toggle` isolé. Même variante, même utilitaire — `tailwind-merge`
        // écarte donc la règle précédente au lieu de laisser l'ordre du CSS
        // décider.
        "data-[state=on]:bg-card data-[state=on]:border-border data-[state=on]:text-foreground aria-pressed:bg-card aria-pressed:border-border aria-pressed:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
