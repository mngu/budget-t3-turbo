import type { ResolvedTheme } from "@budget/ui/theme";

import {
  FALLBACK_CATEGORY_COLOR,
  resolveCategoryColor,
  shadeHex,
} from "@budget/shared";
import { useTheme } from "@budget/ui/theme";

// Stored colors use the light palette; resolve their dark variants at render time.
export function useCategoryColor(): (hex: string | null) => string {
  const { resolvedTheme } = useTheme();
  return (hex) =>
    resolveCategoryColor(hex ?? FALLBACK_CATEGORY_COLOR, resolvedTheme);
}

// Keep these hex equivalents aligned with --card in styles.css; Three cannot read oklch().
const CARD_HEX: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#22252b",
};

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
