import { describe, expect, it } from "vitest";

import { breakdownLevel } from "./breakdown";
import { parent, sub, tree, unallocated } from "./breakdown.fixture";

// Postgres rend l'arbre déjà groupé, trié et totalisé : ce qui se teste ici est
// tout ce qui *reste* côté app — les libellés, les sentinelles d'URL et le
// choix du niveau ouvert. Le regroupement et le tri, eux, se testeront contre
// une vraie base.
const rows = tree([
  parent("Épargne", 200),
  parent(
    "Logement",
    100,
    [sub("Loyer", 60, 55), sub("Électricité", 30), unallocated("Logement", 10)],
    100,
  ),
  parent("Santé", 20),
  parent(null, 5),
]);

describe("breakdownLevel — niveau des parents", () => {
  const level = breakdownLevel(rows, undefined);

  it("nomme et filtre le poste sans rattachement par sa sentinelle", () => {
    expect(level.slices.at(-1)).toMatchObject({
      name: "Sans catégorie",
      filter: "none",
    });
  });

  it("ne laisse descendre que les postes qui ont de vraies sous-catégories", () => {
    expect(
      Object.fromEntries(level.slices.map((s) => [s.name, s.drillable])),
    ).toEqual({
      Logement: true,
      Épargne: false,
      Santé: false,
      "Sans catégorie": false,
    });
  });

  it("reprend le total des sorties et le nombre de postes de la requête", () => {
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

  it("donne au reliquat le nom de sa parente et le renvoie vers elle", () => {
    expect(level.slices.find((s) => s.unallocated)).toMatchObject({
      name: "Logement",
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

  // La règle que « `category` est défini » ne rend pas : le param porte
  // l'enfant, le niveau ouvert est sa parente.
  it("descend aussi quand c'est une sous-catégorie qui est filtrée", () => {
    expect(breakdownLevel(rows, "Loyer").parent?.name).toBe("Logement");
  });
});
