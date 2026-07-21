import { describe, expect, it } from "vitest";
import {
  buildCategorizationOutputSchema,
  buildUserMessage,
  chunkTransactions,
  filterValidResults,
  type TxnForLlm,
} from "./categorize-core";

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

describe("chunkTransactions", () => {
  it("découpe en lots de 50 par défaut", () => {
    const chunks = chunkTransactions(Array.from({ length: 120 }, (_, i) => txn(i)));
    expect(chunks.map((c) => c.length)).toEqual([50, 50, 20]);
  });

  it("renvoie [] pour une liste vide", () => {
    expect(chunkTransactions([])).toEqual([]);
  });
});

describe("buildUserMessage", () => {
  it("contient les champs utiles à la catégorisation", () => {
    const msg = buildUserMessage([txn(7)]);
    const parsed = JSON.parse(msg);
    expect(parsed).toEqual([
      {
        id: 7,
        description: "CARTE 12/07 CARREFOUR PARIS",
        counterparty: "Carrefour",
        direction: "debit",
        amount: "42.10",
        currency: "EUR",
        bankName: "Société Générale",
        bankCode: "CARD_PAYMENT",
        mcc: "5411",
      },
    ]);
  });
});

describe("buildCategorizationOutputSchema", () => {
  it("accepte une catégorie valide et rejette une inconnue", () => {
    const schema = buildCategorizationOutputSchema(CATEGORY_NAMES);
    expect(schema.safeParse({ resultats: [{ id: 1, categorie: "Alimentation" }] }).success).toBe(
      true,
    );
    expect(schema.safeParse({ resultats: [{ id: 1, categorie: "Cryptomonnaie" }] }).success).toBe(
      false,
    );
  });
});

describe("filterValidResults", () => {
  it("ignore les ids hors lot et les catégories hors enum, garde le reste", () => {
    const valid = filterValidResults(
      [
        { id: 1, categorie: "Alimentation" },
        { id: 2, categorie: "Cryptomonnaie" }, // catégorie inventée → rejetée
        { id: 99, categorie: "Transport" }, // id hors lot → rejeté
      ],
      new Set([1, 2]),
      CATEGORY_NAMES,
    );
    expect(valid).toEqual([{ id: 1, categorie: "Alimentation" }]);
  });
});
