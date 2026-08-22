import { describe, expect, it, vi } from "vitest";

// Mock explicite : importer le vrai module chargerait src/db/client.ts
// (POSTGRES_URL requise) — voir analyze.test.ts.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { budgetProposal, budgetSlots } = await import("./budgets");

describe("budgetSlots", () => {
  const tree = [
    { id: 1, children: [{ id: 10 }, { id: 11 }] },
    { id: 2, children: [] },
  ];

  it("compte la parente quand elle est globale", () => {
    expect(budgetSlots(tree, new Set())).toEqual([1, 2]);
  });

  it("s'efface derrière les sous-catégories quand elle est détaillée", () => {
    expect(budgetSlots(tree, new Set([1]))).toEqual([10, 11, 2]);
  });

  // Sinon une parente détaillée puis vidée de ses sous-catégories
  // disparaîtrait des compteurs : plus aucun poste ne porterait son budget.
  it("ignore le drapeau d'une parente sans sous-catégorie", () => {
    expect(budgetSlots(tree, new Set([1, 2]))).toEqual([10, 11, 2]);
  });
});

describe("budgetProposal", () => {
  it("moyenne sur 6 mois, mois vides compris", () => {
    // 600 sur 6 mois = 100, et non 150 sur les 4 mois actifs.
    expect(budgetProposal([150, 150, 150, 150, 0, 0])).toEqual({
      average: 100,
      irregular: false,
    });
  });

  it("arrondit à 5 €", () => {
    expect(budgetProposal([317, 317, 317, 317, 317, 317]).average).toBe(315);
  });

  it("refuse de proposer sous 4 mois actifs sur 6", () => {
    expect(budgetProposal([300, 300, 300, 0, 0, 0])).toEqual({
      average: 150,
      irregular: true,
    });
  });
});
