import type { ResolvedTheme } from "@budget/ui/theme";

import { Color } from "three";

import { FALLBACK_CATEGORY_COLOR, resolveCategoryColor } from "@budget/shared";
import { useTheme } from "@budget/ui/theme";

// La base ne stocke qu'un hex par catégorie (la valeur light canonique de
// CATEGORY_COLOR_PALETTE) : c'est ici, au rendu, qu'on le remplace par le pas
// prévu pour la surface sombre. Comme partout dans l'app, `resolvedTheme` vaut
// "light" au SSR et se corrige à l'hydratation.
export function useCategoryColor(): (hex: string | null) => string {
  const { resolvedTheme } = useTheme();
  return (hex) =>
    resolveCategoryColor(hex ?? FALLBACK_CATEGORY_COLOR, resolvedTheme);
}

// Les sous-catégories ont leur propre couleur en base, mais la peindre ferait
// éclater les barres en confettis et effacerait le regroupement par parent.
// Une sous-catégorie est donc un palier d'une même teinte — celle du parent —
// du plus dense (le plus gros) au plus proche de la surface de la carte. Le
// mélange vise `--card` et non du blanc : il s'inverse tout seul en thème sombre.
//
// Le mélange est calculé ici plutôt que par `color-mix()` parce que le palier
// sert aussi de couleur de matériau three.js, qui ne lit qu'un hex — d'où le
// thème en entrée, là où `var(--card)` s'inversait tout seul. `Color.lerp`
// interpole en sRGB linéaire, pas en OKLab comme l'ancien `color-mix` : la
// rampe est un peu plus claire au milieu, pas de quoi se battre pour une lib.
const SHADE_RANGE = 55;

// Les `--card` de styles.css, en hex parce que three ne lit pas `oklch()`. À
// tenir alignés avec le CSS : oklch(1 0 0) en clair, oklch(0.262 0.012 265)
// en sombre.
const CARD_HEX: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#22252b",
};

export function shadeHex(
  color: string,
  card: string,
  index: number,
  count: number,
): string {
  const ratio = count <= 1 ? 100 : 100 - (index * SHADE_RANGE) / (count - 1);
  // `lerp` mute l'instance et prend le poids de la *cible* : d'où le neuf et
  // le complément.
  return `#${new Color(color).lerp(new Color(card), 1 - ratio / 100).getHexString()}`;
}

export function useShadeCategoryColor(): (
  color: string,
  index: number,
  count: number,
) => string {
  const { resolvedTheme } = useTheme();
  return (color, index, count) =>
    shadeHex(color, CARD_HEX[resolvedTheme], index, count);
}

// Aplat très pâle de la teinte d'une catégorie : pastille de couleur, fond de
// puce. Même principe de mélange vers `--card`.
export function softCategoryColor(color: string) {
  return `color-mix(in oklab, ${color} 22%, var(--card))`;
}
