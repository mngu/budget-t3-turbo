import { useColorScheme } from "react-native";

import {
  FALLBACK_CATEGORY_COLOR,
  resolveCategoryColor,
  shadeHex,
} from "@budget/shared";

// HeroUI Native's --surface in hex (white, and oklch(0.2103 0.0059 285.89)):
// shadeHex only reads hex.
const SURFACE_HEX = { light: "#ffffff", dark: "#18181b" };

export function useCategoryColors() {
  const theme = useColorScheme() === "dark" ? "dark" : "light";
  return {
    // Stored colors use the light palette; resolve their dark variants at render time.
    resolve: (hex: string | null) =>
      resolveCategoryColor(hex ?? FALLBACK_CATEGORY_COLOR, theme),
    // Children fade from their parent's color toward the card, as on the web.
    shade: (color: string, index: number, count: number) =>
      shadeHex(color, SURFACE_HEX[theme], index, count),
  };
}
