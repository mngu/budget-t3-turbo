import type { ResolvedTheme } from "@budget/ui/theme";

import { FALLBACK_CATEGORY_COLOR, resolveCategoryColor } from "@budget/shared";
import { useTheme } from "@budget/ui/theme";

// Stored colors use the light palette; resolve their dark variants at render time.
export function useCategoryColor(): (hex: string | null) => string {
  const { resolvedTheme } = useTheme();
  return (hex) =>
    resolveCategoryColor(hex ?? FALLBACK_CATEGORY_COLOR, resolvedTheme);
}

// Shade children toward the card surface to preserve their parent's visual group.
// Linear sRGB produces Three-compatible hex colors without importing Three on mobile.
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

// Keep these hex equivalents aligned with --card in styles.css; Three cannot read oklch().
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

export function softCategoryColor(color: string) {
  return `color-mix(in oklab, ${color} 22%, var(--surface))`;
}
