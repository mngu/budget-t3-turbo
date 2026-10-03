export const FALLBACK_CATEGORY_COLOR = "#94a3b8";

export interface CategoryColor {
  name: string;
  /** Canonical value stored in categories.color. */
  light: string;
  dark: string;
}

// Compare every pair in both themes before extending this palette: chart order varies.
// Colors alone are not sufficiently distinct; retain category names and icons.
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

// Preserve legacy and fallback colors that have no palette variant.
export function resolveCategoryColor(
  hex: string,
  theme: "light" | "dark",
): string {
  if (theme === "light") return hex;
  return CATEGORY_COLOR_PALETTE.find((c) => c.light === hex)?.dark ?? hex;
}

// Shade children toward the card surface to preserve their parent's visual group.
// Linear sRGB keeps the result a hex color, which Three and React Native both accept.
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
