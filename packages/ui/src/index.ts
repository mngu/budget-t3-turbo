import { cx } from "class-variance-authority";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Les neuf crans typographiques du design system remplacent l'échelle par
 * défaut de Tailwind (`--text-*: initial` dans `styles.css`). Il faut les
 * déclarer ici, sans quoi `tailwind-merge` ne peut pas les reconnaître : son
 * groupe `text-color` accepte **n'importe quel** mot après `text-`, si bien
 * qu'il rangeait `text-hero` parmi les couleurs et le supprimait dès qu'une
 * vraie couleur suivait dans le même `cn()`.
 *
 * Le symptôme était muet et généralisé — `cn("num text-hero", "text-bad")` ne
 * rendait que `text-bad`, et le solde du bandeau, les flux et toute la colonne
 * des postes retombaient à la taille héritée. Rien dans le CSS émis ne le
 * montrait : les classes existent, elles n'arrivaient simplement jamais sur
 * l'élément.
 *
 * Un cran ajouté à `styles.css` doit donc être ajouté ici **aussi**.
 */
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
