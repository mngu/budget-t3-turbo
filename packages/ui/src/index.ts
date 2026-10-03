import { extendTailwindMerge } from "tailwind-merge";
import { defaultConfig } from "tailwind-variants";

// Keep these roles aligned with styles.css. Otherwise tailwind-merge treats
// custom text sizes as colors and drops them when a text color follows.
const twMergeConfig = {
  extend: {
    classGroups: {
      "font-size": [
        "text-hero",
        "text-title",
        "text-amount",
        "text-heading",
        "text-subheading",
        "text-body",
        "text-control",
        "text-meta",
        "text-label",
      ],
    },
  },
};

export const cn = extendTailwindMerge(twMergeConfig);

// HeroUI merges className through tailwind-variants' own tailwind-merge, which would drop
// the same classes. Its components captured this object at import, so it is filled in place.
defaultConfig.twMergeConfig = Object.assign(
  defaultConfig.twMergeConfig ?? {},
  twMergeConfig,
);
