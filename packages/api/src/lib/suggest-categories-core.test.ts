import { describe, expect, it, vi } from "vitest";

import type { TxnForAnalysis } from "./suggest-categories-core";

// Mocks explicites : importer le vrai module chargerait src/db/client.ts
// (POSTGRES_URL requise) et le SDK Anthropic — voir sync-core.test.ts.
vi.mock("@budget/db/client", () => ({ db: {} }));
vi.mock("../../scripts/categorize", () => ({ main: vi.fn() }));

const { buildAnalysisPrompt, sampleWindowStart } = await import(
  "./suggest-categories-core"
);

const txn = (id: number): TxnForAnalysis => ({
  id,
  description: "CARTE 12/07 CARREFOUR PARIS",
  counterparty: "Carrefour",
  amount: "42.10",
  direction: "debit",
  bankName: "Société Générale",
  mcc: "5411",
});

describe("sampleWindowStart", () => {
  it("recule de 6 mois par défaut", () => {
    expect(sampleWindowStart(new Date("2026-07-22T10:00:00.000Z"))).toBe(
      "2026-01-22",
    );
  });

  it("accepte un nombre de mois personnalisé", () => {
    expect(sampleWindowStart(new Date("2026-07-22T10:00:00.000Z"), 3)).toBe(
      "2026-04-22",
    );
  });
});

describe("buildAnalysisPrompt", () => {
  it("mentionne le nombre de transactions et embarque le JSON complet", () => {
    const txns = [txn(1), txn(2)];
    const prompt = buildAnalysisPrompt(txns);
    expect(prompt).toContain("2 transactions bancaires réelles");
    expect(prompt).toContain(JSON.stringify(txns));
  });

  it("demande une arborescence à 2 niveaux avec txnIds", () => {
    const prompt = buildAnalysisPrompt([txn(1)]);
    expect(prompt).toContain(
      "arborescence de catégories budgétaires à 2 niveaux",
    );
    expect(prompt).toContain('"txnIds"');
  });
});
