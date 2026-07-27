import { describe, expect, it, vi } from "vitest";

import { CATEGORY_COLOR_HEXES } from "@budget/shared";

import type { TxnForAnalysis } from "./analyze";
import type { RawCategorySuggestion } from "./schema";

// Mocks explicites : importer le vrai module chargerait src/db/client.ts
// (POSTGRES_URL requise) et le SDK Anthropic — voir pipeline.test.ts.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { buildAnalysisPrompt, sampleWindowStart, sanitizeSuggestionColors } =
  await import("./analyze");

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

  it("liste la palette de couleurs fermée pour parentColor", () => {
    const prompt = buildAnalysisPrompt([txn(1)]);
    expect(prompt).toContain('"parentColor"');
    for (const hex of CATEGORY_COLOR_HEXES) {
      expect(prompt).toContain(hex);
    }
  });
});

describe("sanitizeSuggestionColors", () => {
  const rawSuggestion = (parentColor: string): RawCategorySuggestion => ({
    parent: "Alimentation",
    parentColor,
    enfants: [{ name: "Courses", txnIds: [1] }],
  });

  const firstHex = CATEGORY_COLOR_HEXES[0] ?? "";
  const secondHex = CATEGORY_COLOR_HEXES[1] ?? "";

  it("garde une couleur déjà valide inchangée", () => {
    const results = sanitizeSuggestionColors([rawSuggestion(firstHex)]);
    expect(results[0]?.parentColor).toBe(firstHex);
  });

  it("remplace une couleur hors palette par un repli déterministe (cycle par index)", () => {
    const results = sanitizeSuggestionColors([
      rawSuggestion("#000000"),
      rawSuggestion("#ffffff"),
    ]);
    expect(results[0]?.parentColor).toBe(firstHex);
    expect(results[1]?.parentColor).toBe(secondHex);
  });

  it("préserve le reste de la suggestion (nom, enfants)", () => {
    const results = sanitizeSuggestionColors([rawSuggestion("#000000")]);
    expect(results[0]?.parent).toBe("Alimentation");
    expect(results[0]?.enfants).toEqual([{ name: "Courses", txnIds: [1] }]);
  });
});
