import { describe, expect, it, vi } from "vitest";

vi.mock("@budget/db/client", () => ({ db: {} }));

import type { Similar } from "./categorization";

import {
  buildSystemPrompt,
  buildUserMessage,
  unanimousCategory,
  validResults,
} from "./categorization";

const similar = (over: Partial<Similar>): Similar => ({
  id: 1,
  description: "CB SPOTIFY",
  counterparty: null,
  amount: "9.99",
  categoryName: "Abonnements",
  similarity: 0.9,
  ...over,
});

describe("unanimousCategory", () => {
  it("classe sur un seul candidat sûr", () => {
    expect(unanimousCategory([similar({})], null)).toBe("Abonnements");
  });

  it("classe sur la contrepartie exacte même avec un libellé éloigné", () => {
    const s = similar({ counterparty: "Spotify", similarity: 0.2 });
    expect(unanimousCategory([s], "Spotify")).toBe("Abonnements");
  });

  it("ignore un candidat faible qui n'a ni la contrepartie ni le seuil haut", () => {
    const weak = similar({ similarity: 0.55, counterparty: "Autre" });
    expect(unanimousCategory([weak], "Spotify")).toBeNull();
    expect(unanimousCategory([weak], null)).toBeNull();
  });

  it("passe la main au LLM dès qu'un désaccord existe parmi les candidats sûrs", () => {
    const a = similar({ categoryName: "Abonnements" });
    const b = similar({ id: 2, categoryName: "Loisirs" });
    expect(unanimousCategory([a, b], null)).toBeNull();
  });

  it("ne laisse pas un candidat faible casser l'unanimité des sûrs", () => {
    const strong = similar({ categoryName: "Abonnements" });
    const weak = similar({ id: 2, similarity: 0.55, categoryName: "Loisirs" });
    expect(unanimousCategory([strong, weak], null)).toBe("Abonnements");
  });
});

describe("validResults", () => {
  const byName = new Map([
    ["Alimentation", 10],
    ["Loyer", 11],
  ]);

  it("ne garde que les ids du lot et les catégories connues", () => {
    expect(
      validResults(
        [
          { id: 1, categorie: "Alimentation" },
          { id: 2, categorie: null },
          { id: 3, categorie: "Inconnue" },
          { id: 99, categorie: "Loyer" },
        ],
        new Set([1, 2, 3]),
        byName,
      ),
    ).toEqual([{ id: 1, categoryId: 10 }]);
  });
});

describe("prompts", () => {
  it("le system prompt liste exactement les catégories de l'espace", () => {
    const prompt = buildSystemPrompt(["Alimentation", "Loyer"]);
    expect(prompt).toContain("- Alimentation\n- Loyer");
  });

  it("le message injecte les exemples de la transaction, et rien quand il n'y en a pas", () => {
    const txn = {
      id: 7,
      description: "CB SPOTIFY",
      counterparty: null,
      direction: "debit" as const,
      amount: "9.99",
      currency: "EUR",
      bankName: "SG",
    };
    const withExamples = buildUserMessage(
      [txn],
      new Map([[7, [similar({ counterparty: "Spotify" })]]]),
    );
    expect(withExamples).toContain(
      '- "CB SPOTIFY" (Spotify), 9.99 → Abonnements',
    );
    expect(withExamples).toContain('"id":7');

    const without = buildUserMessage([txn], new Map());
    expect(without).not.toContain("similaires");
    expect(without).toMatch(/^Nouvelle transaction/);
  });
});
