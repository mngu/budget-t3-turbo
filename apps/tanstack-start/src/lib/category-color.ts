import { useTheme } from "@budget/ui/theme";
import { resolveCategoryColor } from "@budget/shared";

// La base ne stocke qu'un hex par catégorie (la valeur light canonique de
// CATEGORY_COLOR_PALETTE) : c'est ici, au rendu, qu'on le remplace par le pas
// prévu pour la surface sombre. Comme partout dans l'app, `resolvedTheme` vaut
// "light" au SSR et se corrige à l'hydratation.
export function useCategoryColor(): (hex: string) => string {
  const { resolvedTheme } = useTheme();
  return (hex) => resolveCategoryColor(hex, resolvedTheme);
}
