import { describe, expect, it } from "vitest";

import { cn } from "./index";

/**
 * Les neuf crans typographiques vivent dans l'espace de noms `text-*`, que
 * `tailwind-merge` traite par défaut comme des **couleurs** : sans la
 * déclaration de `index.ts`, il rangeait `text-hero` avec `text-bad` et gardait
 * la dernière des deux.
 *
 * La panne était silencieuse — les classes existaient bien dans le CSS émis,
 * elles n'arrivaient simplement jamais sur l'élément — et généralisée : le
 * solde du bandeau, les montants de flux et toute la colonne des postes
 * retombaient à la taille héritée. Rien ne l'aurait rattrapée sauf l'écran.
 */
describe("cn : les crans typographiques ne sont pas des couleurs", () => {
  const CRANS = [
    "text-hero",
    "text-title",
    "text-amount",
    "text-heading",
    "text-subheading",
    "text-body",
    "text-control",
    "text-meta",
    "text-label",
  ];

  it.each(CRANS)("garde %s à côté d'une couleur", (cran) => {
    expect(cn(cran, "text-bad")).toBe(`${cran} text-bad`);
    expect(cn("text-subtle", cran)).toBe(`text-subtle ${cran}`);
  });

  it("départage deux crans entre eux, le dernier gagne", () => {
    expect(cn("text-body", "text-meta")).toBe("text-meta");
  });

  it("départage toujours deux couleurs entre elles", () => {
    expect(cn("text-subtle", "text-bad")).toBe("text-bad");
  });
});
