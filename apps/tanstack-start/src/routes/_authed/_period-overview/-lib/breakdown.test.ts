import { describe, expect, it } from "vitest";

import { breakdownLevel } from "./breakdown";
import { poste, sub, tree } from "./breakdown.fixture";

// `categories.newOverview` ne donne aucune ligne au reliquat — la dépense posée
// sur la parente elle-même — alors que l'anneau en a besoin : sans lui la somme
// des arcs n'égale plus le centre. Il se déduit du total de la parente, qui
// couvre ses transactions directes *et* celles de ses enfants. C'est le seul
// calcul de `breakdownLevel`, et donc l'essentiel de ce qui se teste ici.
const rows = tree([
  poste("Logement", 100, [sub("Loyer", 60), sub("Électricité", 30)]),
  poste("Vacances", null),
  poste(null, 5),
]);

describe("breakdownLevel — reliquat d'une parente", () => {
  it("ajoute la part directe de la parente, sous son propre nom", () => {
    expect(breakdownLevel(rows, "Logement").slices.at(-1)).toMatchObject({
      name: "Logement",
      filter: "Logement",
      unallocated: true,
      total: 10,
    });
  });

  it("fait la somme des arcs égale au total du poste", () => {
    const level = breakdownLevel(rows, "Logement");
    const arcs = level.slices.reduce((total, slice) => total + slice.total, 0);
    expect(arcs).toBeCloseTo(level.total, 6);
  });

  it("n'ajoute rien quand les enfants couvrent tout le poste", () => {
    const exact = tree([poste("Courses", 50, [sub("Supermarché", 50)])]);
    expect(breakdownLevel(exact, "Courses").slices).toHaveLength(1);
  });
});

describe("breakdownLevel — niveau des parents", () => {
  const level = breakdownLevel(rows, undefined);

  it("nomme et filtre le poste sans rattachement par sa sentinelle", () => {
    expect(level.slices.at(-1)).toMatchObject({
      name: "Sans catégorie",
      filter: "none",
    });
  });

  it("écarte les parentes sans mouvement sur la période", () => {
    expect(level.slices.map((slice) => slice.name)).not.toContain("Vacances");
    expect(level.postes).toBe(2);
  });
});
