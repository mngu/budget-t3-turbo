import { describe, expect, it, vi } from "vitest";

import { CATEGORY_COLOR_HEXES } from "@budget/shared";

import type { CategoryTreeNode } from "../queries";
import type { TxnForAnalysis } from "./analyze";
import type { RawCategorySuggestion } from "./schema";

// Mocks explicites : importer le vrai module chargerait src/db/client.ts
// (POSTGRES_URL requise) et le SDK Anthropic — voir pipeline.test.ts.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { buildAnalysisPrompt, sampleWindowStart, sanitizeSuggestionColors } =
  await import("./analyze");

const txn = (id: number, category: string | null = null): TxnForAnalysis => ({
  id,
  description: "CARTE 12/07 CARREFOUR PARIS",
  counterparty: "Carrefour",
  amount: "42.10",
  direction: "debit",
  bankName: "Société Générale",
  mcc: "5411",
  category,
  parentCategory: category === null ? null : "Alimentation",
});

const parent = (
  id: number,
  name: string,
  children: string[],
  color: string | null = "#0084c8",
): CategoryTreeNode => ({
  id,
  name,
  color,
  icon: null,
  parentId: null,
  children: children.map((childName, i) => ({
    id: id * 100 + i,
    name: childName,
    color: null,
    icon: null,
    parentId: id,
  })),
});

const tree = [parent(1, "Transport", ["Essence", "Péage"])];

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
    const prompt = buildAnalysisPrompt(txns, tree);
    expect(prompt).toContain("2 transactions bancaires réelles");
    expect(prompt).toContain(JSON.stringify(txns));
  });

  it("demande une arborescence à 2 niveaux avec txnIds", () => {
    const prompt = buildAnalysisPrompt([txn(1)], tree);
    expect(prompt).toContain(
      "arborescence de catégories budgétaires à 2 niveaux",
    );
    expect(prompt).toContain('"txnIds"');
  });

  it("liste la palette de couleurs fermée pour parentColor", () => {
    const prompt = buildAnalysisPrompt([txn(1)], tree);
    expect(prompt).toContain('"parentColor"');
    for (const hex of CATEGORY_COLOR_HEXES) {
      expect(prompt).toContain(hex);
    }
  });

  // Sans ce bloc, le LLM ne voit aucun nom existant et propose des variantes
  // (« Transports » face à « Transport ») qui deviennent des doublons en base.
  it("liste les catégories existantes avec leur couleur et leurs enfants", () => {
    const prompt = buildAnalysisPrompt([txn(1)], tree);
    expect(prompt).toContain("« Transport » [#0084c8]");
    expect(prompt).toContain("« Essence »");
    expect(prompt).toContain("« Péage »");
  });

  it("signale une parente encore sans sous-catégorie", () => {
    const prompt = buildAnalysisPrompt([txn(1)], [parent(2, "Santé", [])]);
    expect(prompt).toContain("« Santé »");
    expect(prompt).toContain("aucune sous-catégorie pour l'instant");
  });

  it("exige la réutilisation verbatim des noms existants", () => {
    const prompt = buildAnalysisPrompt([txn(1)], tree);
    expect(prompt).toContain("Réutilise les noms existants au caractère près");
  });

  // Garde-fou : sur un delta, le LLM repart de zéro et réinvente des variantes
  // des noms déjà en base (voir buildAnalysisPrompt).
  it("demande l'arborescence complète et non un delta", () => {
    const prompt = buildAnalysisPrompt([txn(1)], tree);
    expect(prompt).toContain("Décris l'arborescence complète");
  });

  it("bascule sur une consigne de création intégrale quand l'arbre est vide", () => {
    const prompt = buildAnalysisPrompt([txn(1)], []);
    expect(prompt).toContain("Aucune catégorie n'existe encore");
    expect(prompt).not.toContain("Arborescence actuelle");
  });

  it("embarque la catégorie actuelle de chaque transaction", () => {
    const prompt = buildAnalysisPrompt([txn(1, "Courses")], tree);
    expect(prompt).toContain('"category":"Courses"');
    expect(prompt).toContain('"parentCategory":"Alimentation"');
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
