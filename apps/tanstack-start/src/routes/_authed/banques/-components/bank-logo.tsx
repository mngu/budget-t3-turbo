"use client";

import { useState } from "react";

import { cn } from "@budget/ui";

/**
 * Vignette d'un établissement. Deux replis, tous les deux constatés sur les
 * données réelles d'Enable Banking : `logo` absent, et `logo` présent mais
 * inexploitable (l'`<img>` cassée laissait un carré vide dans la liste du
 * wizard). La maquette donne une teinte par banque ; la base n'en connaît
 * aucune, et en inventer une ferait varier l'écran d'un rendu à l'autre.
 *
 * Fond blanc quel que soit le thème : les logos de banque sont dessinés pour un
 * fond clair — celui de Revolut, noir sur transparent, disparaissait purement et
 * simplement sur la carte en thème sombre.
 */
export function BankLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!logoUrl || broken) {
    return (
      <span
        className={cn(
          "bg-sunken text-muted-foreground flex items-center justify-center rounded-md border font-semibold",
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      onError={() => setBroken(true)}
      className={cn("rounded-md border bg-white object-contain p-1", className)}
    />
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}
