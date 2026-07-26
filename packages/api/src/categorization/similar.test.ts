import { describe, expect, it, vi } from "vitest";

import type { BankCodeParentCount, SimilarTxn } from "./similar";

// Mock explicite : importer le vrai module chargerait @budget/db/client
// (POSTGRES_URL requise) — voir pipeline.test.ts. Seules les fonctions pures
// sont testées ici, les requêtes le sont en bout de chaîne.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { mergeSimilarCandidates, selectDiscriminativeBankCodes } = await import(
  "./similar"
);

const row = (
  bankCode: string,
  parentId: number,
  count: number,
): BankCodeParentCount => ({ bankCode, parentId, count });

describe("selectDiscriminativeBankCodes", () => {
  // Cas mesurés sur la base réelle au moment de l'introduction du filtre.
  it("garde un code parfaitement pur", () => {
    expect(selectDiscriminativeBankCodes([row("TOPUP", 303, 17)])).toEqual(
      new Set(["TOPUP"]),
    );
  });

  it("garde un code dont les sous-catégories partagent le même parent", () => {
    // `18` : 11 « Transferts personnels » + 9 « Remboursements reçus », tous
    // deux enfants de « Remboursements & Transferts » — pur au niveau parent.
    expect(selectDiscriminativeBankCodes([row("18", 303, 20)])).toEqual(
      new Set(["18"]),
    );
  });

  it("rejette un code fourre-tout", () => {
    // `CARD_PAYMENT` : 171 transactions réparties sur 11 catégories parentes.
    const rows = Array.from({ length: 11 }, (_, i) =>
      row("CARD_PAYMENT", i + 1, i === 0 ? 60 : 11),
    );
    expect(selectDiscriminativeBankCodes(rows)).toEqual(new Set());
  });

  it("rejette C2, le code qui produisait les exemples trompeurs", () => {
    // « virement reçu » chez SG, tel que mesuré en base : 4 transactions sous
    // « Remboursements & Transferts » et 1 loyer. Soit exactement 0,80 de
    // dominance — une première calibration à 5 observations / 80 % le laissait
    // passer, et il continuait à montrer un exemple « Loyer » à un virement
    // entrant. Régression à ne pas réintroduire en assouplissant les seuils.
    expect(
      selectDiscriminativeBankCodes([row("C2", 303, 4), row("C2", 2, 1)]),
    ).toEqual(new Set());
  });

  it("rejette un code pur mais trop peu observé", () => {
    // Pureté de 100 % sur 3 observations : pas assez pour conclure.
    expect(selectDiscriminativeBankCodes([row("RARE", 1, 3)])).toEqual(
      new Set(),
    );
  });

  it("tolère au plus un exemple aberrant sur un code bien observé", () => {
    expect(
      selectDiscriminativeBankCodes([row("OK", 1, 19), row("OK", 2, 1)]),
    ).toEqual(new Set(["OK"]));
    expect(
      selectDiscriminativeBankCodes([row("KO", 1, 8), row("KO", 2, 2)]),
    ).toEqual(new Set());
  });

  it("évalue chaque code indépendamment", () => {
    const kept = selectDiscriminativeBankCodes([
      row("TOPUP", 303, 17),
      row("B1", 282, 11),
      row("B1", 2, 6),
      row("B1", 290, 3),
      row("B1", 294, 1),
    ]);
    expect(kept).toEqual(new Set(["TOPUP"]));
  });
});

describe("mergeSimilarCandidates", () => {
  const txn = (id: number, categoryName: string): SimilarTxn => ({
    id,
    description: "CARTE 12/07 CARREFOUR",
    counterparty: "Carrefour",
    amount: "10.00",
    direction: "debit",
    categoryName,
    categorySource: "llm",
  });

  it("donne la priorité au tier le plus fiable en cas de doublon", () => {
    const merged = mergeSimilarCandidates([
      [txn(1, "Alimentation")],
      [txn(1, "Autres"), txn(2, "Transport")],
    ]);
    expect(merged).toEqual([txn(1, "Alimentation"), txn(2, "Transport")]);
  });

  it("plafonne à la limite demandée", () => {
    const merged = mergeSimilarCandidates(
      [[txn(1, "A"), txn(2, "B"), txn(3, "C")]],
      2,
    );
    expect(merged).toHaveLength(2);
  });
});
