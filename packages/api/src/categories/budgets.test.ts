import { describe, expect, it, vi } from "vitest";

// Mock explicite : importer le vrai module chargerait src/db/client.ts
// (POSTGRES_URL requise) — voir analyze.test.ts.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { budgetProposal } = await import("./budgets");

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
