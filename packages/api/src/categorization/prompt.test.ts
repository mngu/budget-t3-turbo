import { describe, expect, it } from "vitest";

import type { TxnForLlm } from "./prompt";
import type { SimilarTxn } from "./similar";
import {
  buildFewShotPrompt,
  buildFewShotUserMessage,
  buildSystemPrompt,
} from "./prompt";

const CATEGORY_NAMES = ["Alimentation", "Transport"];

const txn = (id: number): TxnForLlm => ({
  id,
  description: "CARTE 12/07 CARREFOUR PARIS",
  counterparty: "Carrefour",
  direction: "debit",
  amount: "42.10",
  currency: "EUR",
  bankName: "Société Générale",
  bankCode: "CARD_PAYMENT",
  mcc: "5411",
});

const similarTxn = (overrides: Partial<SimilarTxn> = {}): SimilarTxn => ({
  id: 1,
  description: "CARTE 05/07 CARREFOUR CITY",
  counterparty: "Carrefour",
  amount: "38.50",
  direction: "debit",
  categoryName: "Alimentation",
  categorySource: "manual",
  ...overrides,
});

describe("buildSystemPrompt", () => {
  it("ne s'appuie que sur les catégories fournies", () => {
    const prompt = buildSystemPrompt(CATEGORY_NAMES);
    expect(prompt).toContain("- Alimentation");
    expect(prompt).toContain("- Transport");
  });

  it("ne code en dur aucune catégorie par défaut", () => {
    // Ces trois noms étaient codés en dur dans les règles métier alors qu'ils
    // n'existent pas forcément en base : le LLM les renvoyait obstinément et
    // les transactions concernées étaient droppées, donc jamais catégorisées.
    // La création des catégories manquantes est le rôle des suggestions.
    const prompt = buildSystemPrompt(CATEGORY_NAMES);
    expect(prompt).not.toContain("Revenus");
    expect(prompt).not.toContain("Autres");
    expect(prompt).not.toContain("Apport Alex");
  });

  it("offre explicitement l'échappatoire null", () => {
    expect(buildSystemPrompt(CATEGORY_NAMES)).toContain("null");
  });
});

describe("buildFewShotPrompt", () => {
  it("inclut la section des transactions similaires quand il y en a", () => {
    const prompt = buildFewShotPrompt(txn(1), [
      similarTxn(),
      similarTxn({ id: 2, counterparty: null, direction: "credit" }),
    ]);
    expect(prompt).toContain("Transactions similaires déjà catégorisées :");
    expect(prompt).toContain(
      '- "CARTE 05/07 CARREFOUR CITY" (Carrefour), -38.50 → Alimentation',
    );
    expect(prompt).toContain('- "CARTE 05/07 CARREFOUR CITY", +38.50 →');
    expect(prompt).toContain("Nouvelle transaction à catégoriser :");
    expect(prompt).toContain(JSON.stringify(txn(1)));
  });

  it("retombe sur le prompt générique sans section similaires", () => {
    const prompt = buildFewShotPrompt(txn(1), []);
    expect(prompt).not.toContain("Transactions similaires");
    expect(prompt).toBe(
      `Nouvelle transaction à catégoriser :\n${JSON.stringify(txn(1))}`,
    );
  });
});

describe("buildFewShotUserMessage", () => {
  it("construit un bloc par transaction avec ses propres similaires", () => {
    const msg = buildFewShotUserMessage(
      [txn(1), txn(2)],
      new Map([[1, [similarTxn()]]]),
    );
    const [first, second] = msg.split("\n\n---\n\n");
    expect(first).toContain("Transactions similaires");
    expect(second).not.toContain("Transactions similaires");
    expect(second).toContain(JSON.stringify(txn(2)));
  });
});
