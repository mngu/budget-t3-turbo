import type { ResolvedTheme } from "@budget/ui/theme";

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
// thème en entrée, là où `var(--card)` s'inversait tout seul. L'interpolation
// se fait en sRGB linéaire, comme le `Color.lerp` de three qu'elle remplace :
// importer three ici l'embarquait sur les téléphones, qui ne montent jamais
// l'anneau. Pas OKLab comme l'ancien `color-mix` : la rampe est un peu plus
// claire au milieu, pas de quoi se battre pour une lib.
const SHADE_RANGE = 55;

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = (c: number) =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
const parseHex = (hex: string) =>
  [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
const toHex = (c: number) =>
  Math.round(toSrgb(c) * 255)
    .toString(16)
    .padStart(2, "0");

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
  const weight = count <= 1 ? 0 : (index * SHADE_RANGE) / (count - 1) / 100;
  const target = parseHex(card);
  return `#${parseHex(color)
    .map((c, i) => toHex(c + ((target[i] ?? c) - c) * weight))
    .join("")}`;
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
