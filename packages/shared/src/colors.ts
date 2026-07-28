export const FALLBACK_CATEGORY_COLOR = "#94a3b8";

export interface CategoryColor {
  name: string;
  /** Valeur canonique — c'est elle qui est stockée dans `categories.color`. */
  light: string;
  /**
   * Même teinte, re-steppée pour la surface sombre. Les pas ont été mesurés
   * contre un `--card` sombre plus foncé que l'actuel (la maquette l'a remonté
   * à oklch(0.262 0.012 265) le 2026-07-28) : les écarts de la palette entre
   * eux n'en dépendent pas, mais un re-calage tiendrait compte de ce fond.
   */
  dark: string;
}

// Palette fermée pour les catégories parentes — source unique de vérité,
// partagée entre le prompt LLM de suggestion de catégories (packages/api)
// et son affichage (apps/tanstack-start), pour ne jamais dupliquer une
// liste de couleurs codée en dur à plusieurs endroits.
//
// Dérivée avec la méthode du skill dataviz : 13 familles Tailwind v4, pas
// choisis par optimisation conjointe des deux modes (all-pairs, car l'ordre
// des parts du camembert dépend des filtres, donc l'adjacence est
// imprévisible). Bande de clarté OKLCH et plancher de chroma validés dans les
// deux modes ; la séparation CVD (pire paire ΔE 4,2 light / 4,3 dark) et la
// vision normale (8,1 / 7,1) restent sous les seuils du skill (8 et 15) —
// c'est le plafond mathématique à 13 slots, aucune palette de cette taille ne
// les passe. La méthode l'autorise sous « relief rule » : l'identité ne
// repose jamais sur la couleur seule ici (légende nommée + tooltip nommé).
// Pour mémoire, la palette précédente (10 couleurs) mesurait 1,2 / 6,3.
//
// Ne pas ajouter de 14e entrée sans re-mesurer : les rampes Tailwind sont
// épuisées au-delà et la recherche se met à produire des quasi-doublons.
export const CATEGORY_COLOR_PALETTE: readonly CategoryColor[] = [
  { name: "Rouge", light: "#fb2c36", dark: "#e40016" },
  { name: "Ambre", light: "#b55200", dark: "#da7700" },
  { name: "Citron vert", light: "#83cc00", dark: "#4b7d00" },
  { name: "Vert", light: "#00c65a", dark: "#00a447" },
  { name: "Émeraude", light: "#007857", dark: "#007857" },
  { name: "Turquoise", light: "#009488", dark: "#009488" },
  { name: "Cyan", light: "#00b6d4", dark: "#0091b3" },
  { name: "Bleu ciel", light: "#0084c8", dark: "#0069a2" },
  { name: "Bleu", light: "#1447e6", dark: "#3280ff" },
  { name: "Violet", light: "#8d56ff", dark: "#7008e7" },
  { name: "Pourpre", light: "#9810fa", dark: "#9810fa" },
  { name: "Fuchsia", light: "#ec6dff", dark: "#e12afb" },
  { name: "Rose", light: "#fb64b6", dark: "#e30076" },
] as const;

export const CATEGORY_COLOR_HEXES: string[] = CATEGORY_COLOR_PALETTE.map(
  (c) => c.light,
);

// FALLBACK_CATEGORY_COLOR n'est volontairement plus dans la palette : c'est un
// gris (chroma 0,035, sous le plancher) qui échoue les gates et écrasait la
// séparation CVD à 2,2. Il reste la couleur des catégories sans choix, jamais
// une couleur sélectionnable.
//
// Résout la couleur stockée (valeur light canonique) vers le pas du mode. Un
// hex hors palette — legacy, ou le repli — est rendu tel quel.
export function resolveCategoryColor(
  hex: string,
  theme: "light" | "dark",
): string {
  if (theme === "light") return hex;
  return CATEGORY_COLOR_PALETTE.find((c) => c.light === hex)?.dark ?? hex;
}
