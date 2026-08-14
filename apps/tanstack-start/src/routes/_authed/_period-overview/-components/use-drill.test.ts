import { describe, expect, it } from "vitest";

import type { RevueCategory } from "~/lib/revue-categories";
import { levelKey } from "./use-drill";

const category = (filter: string, subs: string[] = []): RevueCategory => ({
  name: filter,
  filter,
  total: 100,
  color: "#000000",
  icon: null,
  subs: subs.map((name) => ({ name, filter: name, total: 10, budget: null })),
  delta: null,
  budget: null,
  covered: 0,
});

const categories = [
  category("Logement", ["Loyer", "Électricité"]),
  category("Sans catégorie"),
];

// Le niveau que l'anneau affiche, et donc ce qui le replie : c'est *cette*
// valeur qui doit changer, jamais `search.category` (voir `levelKey`).
describe("levelKey", () => {
  it("rend le niveau des parents sans filtre", () => {
    expect(levelKey({}, categories)).toBe("");
  });

  it("descend dans une parente qui a des sous-catégories", () => {
    expect(levelKey({ category: "Logement" }, categories)).toBe("Logement");
  });

  it("reste dans la parente quand une sous-catégorie est surlignée", () => {
    expect(levelKey({ category: "Loyer" }, categories)).toBe("Logement");
  });

  it("ne descend pas dans une parente sans sous-catégorie", () => {
    expect(levelKey({ category: "Sans catégorie" }, categories)).toBe("");
  });

  it("ignore un filtre que le niveau ne connaît pas", () => {
    expect(levelKey({ category: "Disparue" }, categories)).toBe("");
  });
});
