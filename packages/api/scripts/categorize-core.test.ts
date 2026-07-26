import { describe, expect, it } from "vitest";

import type { SimilarTxn } from "../src/lib/similar-transactions";
import type { TxnForLlm } from "./categorize-core";
import {
  buildCategorizationOutputSchema,
  buildFewShotPrompt,
  buildFewShotUserMessage,
  buildSystemPrompt,
  buildUserMessage,
  chunkTransactions,
  partitionResults,
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

describe("chunkTransactions", () => {
  it("découpe en lots de 50 par défaut", () => {
    const chunks = chunkTransactions(
      Array.from({ length: 120 }, (_, i) => txn(i)),
    );
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
    // La création des catégories manquantes est le rôle de suggest-categories.
    const prompt = buildSystemPrompt(CATEGORY_NAMES);
    expect(prompt).not.toContain("Revenus");
    expect(prompt).not.toContain("Autres");
    expect(prompt).not.toContain("Apport Alex");
  });

  it("offre explicitement l'échappatoire null", () => {
    expect(buildSystemPrompt(CATEGORY_NAMES)).toContain("null");
  });
});

describe("buildCategorizationOutputSchema", () => {
  it("valide la forme (id + categorie) sans imposer l'énumération des catégories connues", () => {
    // Le filtrage des catégories inconnues (ex. si le LLM invente ou répète
    // un nom de catégorie qui n'existe plus après un remplacement) est
    // délégué à partitionResults, pas au schéma — un z.enum() ici ferait
    // planter le parsing structured-output de tout le lot au lieu d'ignorer
    // juste la transaction concernée (voir partitionResults ci-dessous).
    const schema = buildCategorizationOutputSchema();
    expect(
      schema.safeParse({ resultats: [{ id: 1, categorie: "Alimentation" }] })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ resultats: [{ id: 1, categorie: "Cryptomonnaie" }] })
        .success,
    ).toBe(true);
    expect(
      schema.safeParse({ resultats: [{ id: "1", categorie: "Alimentation" }] })
        .success,
    ).toBe(false);
  });

  it("accepte categorie: null (aucune catégorie ne convient)", () => {
    expect(
      buildCategorizationOutputSchema().safeParse({
        resultats: [{ id: 1, categorie: null }],
      }).success,
    ).toBe(true);
  });
});

describe("partitionResults", () => {
  it("sépare les catégorisations valides, les refus assumés et les réponses aberrantes", () => {
    const { valid, declined, rejected } = partitionResults(
      [
        { id: 1, categorie: "Alimentation" },
        { id: 2, categorie: null }, // aucune catégorie ne convient → assumé
        { id: 3, categorie: "Cryptomonnaie" }, // catégorie inventée → aberrant
        { id: 99, categorie: "Transport" }, // id hors lot → aberrant
      ],
      new Set([1, 2, 3]),
      CATEGORY_NAMES,
    );
    expect(valid).toEqual([{ id: 1, categorie: "Alimentation" }]);
    expect(declined).toEqual([2]);
    expect(rejected).toEqual([
      { id: 3, categorie: "Cryptomonnaie" },
      { id: 99, categorie: "Transport" },
    ]);
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
