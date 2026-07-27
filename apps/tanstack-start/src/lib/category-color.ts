import { resolveCategoryColor } from "@budget/shared";
import { useTheme } from "@budget/ui/theme";

// La base ne stocke qu'un hex par catégorie (la valeur light canonique de
// CATEGORY_COLOR_PALETTE) : c'est ici, au rendu, qu'on le remplace par le pas
// prévu pour la surface sombre. Comme partout dans l'app, `resolvedTheme` vaut
// "light" au SSR et se corrige à l'hydratation.
export function useCategoryColor(): (hex: string) => string {
  const { resolvedTheme } = useTheme();
  return (hex) => resolveCategoryColor(hex, resolvedTheme);
}

// Les sous-catégories ont leur propre couleur en base, mais la peindre ferait
// éclater les barres en confettis et effacerait le regroupement par parent.
// Une sous-catégorie est donc un palier d'une même teinte — celle du parent —
// du plus dense (le plus gros) au plus proche de la surface de la carte. Le
// mélange vise `--card` et non du blanc : il s'inverse tout seul en thème sombre.
const SHADE_RANGE = 55;

export function shadeCategoryColor(
  color: string,
  index: number,
  count: number,
) {
  const ratio = count <= 1 ? 100 : 100 - (index * SHADE_RANGE) / (count - 1);
  return `color-mix(in oklab, ${color} ${ratio}%, var(--card))`;
}

// Aplat très pâle de la teinte d'une catégorie : fond de la portion non
// ventilée des barres, sous les hachures. Même principe de mélange vers `--card`.
export function softCategoryColor(color: string) {
  return `color-mix(in oklab, ${color} 22%, var(--card))`;
}

// Hachures à 115° : c'est le motif qui signale « non ventilé » partout dans la
// revue — barres de catégories, jauges des tuiles, rangs du rail de ventilation.
export function hatchedBackground(color: string, background: string) {
  return `repeating-linear-gradient(115deg, ${color} 0 4px, transparent 4px 9px), ${background}`;
}
