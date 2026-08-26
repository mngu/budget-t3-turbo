import { describe, expect, it } from "vitest";

import { sumBy } from "./sum";

describe("sumBy", () => {
  it("additionne le champ projeté", () => {
    expect(sumBy([{ n: 1 }, { n: 2 }, { n: 4 }], (item) => item.n)).toBe(7);
  });

  // Le cas que le `0` initial protège : sans lui, `reduce` lève sur une liste
  // vide — une parente sans sous-catégorie, un mois sans mouvement.
  it("rend 0 sur une liste vide", () => {
    expect(sumBy([], () => 1)).toBe(0);
  });
});
