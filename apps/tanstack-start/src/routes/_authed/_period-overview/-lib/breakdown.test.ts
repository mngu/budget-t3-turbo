import { describe, expect, it } from "vitest";

import { breakdownLevel } from "./breakdown";
import { row } from "./breakdown.fixture";

const rows = [
  row("Logement", "Loyer", 60, { cat: 55, parent: 100 }),
  row("Logement", "Électricité", 30),
  // Le reliquat porté par la parente elle-même.
  row("Logement", "Logement", 10, { cat: 100, parent: 100 }),
  // Deux catégories **racines** sans enfant. Elles arrivent avec `parentName`
  // replié sur leur propre nom : sans ce repli côté SQL, elles tomberaient
  // toutes dans le même seau que les transactions sans catégorie.
  row("Épargne", "Épargne", 200),
  row("Santé", "Santé", 20),
  row(null, null, 5),
];

describe("breakdownLevel — niveau des parents", () => {
  const level = breakdownLevel(rows, undefined);

  it("ne mélange pas les catégories racines entre elles", () => {
    expect(level.slices.map((s) => s.name)).toEqual([
      "Épargne",
      "Logement",
      "Santé",
      "Sans catégorie",
    ]);
  });

  it("trie les postes du plus gros au plus petit", () => {
    expect(level.slices.map((s) => s.total)).toEqual([200, 100, 20, 5]);
  });

  it("ne laisse descendre que les postes qui ont de vraies sous-catégories", () => {
    expect(
      Object.fromEntries(level.slices.map((s) => [s.name, s.subs])),
    ).toEqual({
      Logement: 2,
      Épargne: 0,
      Santé: 0,
      "Sans catégorie": 0,
    });
  });

  it("filtre le groupe sans rattachement par sa sentinelle", () => {
    expect(level.slices.at(-1)?.filter).toBe("none");
  });

  it("rend le total des sorties et le nombre de postes", () => {
    expect(level.total).toBe(325);
    expect(level.expenses).toBe(325);
    expect(level.postes).toBe(4);
  });
});

describe("breakdownLevel — poste ouvert", () => {
  const level = breakdownLevel(rows, "Logement");

  it("descend dans la parente et garde le total des sorties comme référence", () => {
    expect(level.parent?.name).toBe("Logement");
    expect(level.total).toBe(100);
    expect(level.expenses).toBe(325);
  });

  it("nomme « À classer » le reliquat de la parente et le renvoie vers elle", () => {
    const aClasser = level.slices.find((s) => s.aClasser);
    expect(aClasser).toMatchObject({
      name: "À classer",
      filter: "Logement",
      total: 10,
    });
  });

  it("porte le budget de chaque sous-catégorie, pas celui de la parente", () => {
    expect(level.slices.find((s) => s.name === "Loyer")?.budget).toBe(55);
    expect(level.slices.find((s) => s.name === "Électricité")?.budget).toBe(
      null,
    );
  });

  it("descend aussi quand c'est une sous-catégorie qui est filtrée", () => {
    expect(breakdownLevel(rows, "Loyer").parent?.name).toBe("Logement");
  });
});
