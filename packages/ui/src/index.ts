import { cx } from "class-variance-authority";
import { extendTailwindMerge } from "tailwind-merge";

// Keep these roles aligned with styles.css. Otherwise tailwind-merge treats
// custom text sizes as colors and drops them when a text color follows.
const twMerge = extendTailwindMerge({
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
});

export const cn = (...inputs: Parameters<typeof cx>) => twMerge(cx(inputs));
