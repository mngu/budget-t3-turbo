import { describe, expect, it } from "vitest";

import { row } from "../-lib/breakdown.fixture";
import { levelKey } from "./use-drill";

const rows = [
  row("Logement", "Loyer", 60),
  row("Logement", "Électricité", 30),
  // Le reliquat porté par la parente : sa catégorie est elle-même.
  row("Logement", "Logement", 10),
  // Une catégorie racine sans enfant prend la *même* forme que le reliquat —
  // seul le décompte de vraies sous-catégories les sépare.
  row("Épargne", "Épargne", 40),
  row(null, null, 5),
];

// Le niveau que l'anneau affiche, et donc ce qui le replie : c'est *cette*
// valeur qui doit changer, jamais `search.category` (voir `levelKey`).
describe("levelKey", () => {
  it("rend le niveau des parents sans filtre", () => {
    expect(levelKey({}, rows)).toBe("");
  });

  it("descend dans une parente qui a des sous-catégories", () => {
    expect(levelKey({ category: "Logement" }, rows)).toBe("Logement");
  });

  it("reste dans la parente quand une sous-catégorie est surlignée", () => {
    expect(levelKey({ category: "Loyer" }, rows)).toBe("Logement");
  });

  it("ne descend pas dans une catégorie racine sans enfant", () => {
    expect(levelKey({ category: "Épargne" }, rows)).toBe("");
  });

  it("ne descend pas dans le groupe sans rattachement", () => {
    expect(levelKey({ category: "none" }, rows)).toBe("");
  });

  it("ignore un filtre que le niveau ne connaît pas", () => {
    expect(levelKey({ category: "Disparue" }, rows)).toBe("");
  });
});
