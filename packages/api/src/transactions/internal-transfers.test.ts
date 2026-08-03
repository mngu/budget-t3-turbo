import { describe, expect, it, vi } from "vitest";

import type { OwnIbans, TransferLeg } from "./internal-transfers";

// Mock explicite : importer le vrai module chargerait @budget/db/client
// (POSTGRES_URL requise) — même motif que similar.test.ts. Seul l'appariement,
// qui est pur, est testé ici.
vi.mock("@budget/db/client", () => ({ db: {} }));

const { matchInternalTransfers } = await import("./internal-transfers");

// Comptes réels : les deux Caisse d'Épargne, Revolut, et un SG sans IBAN en
// base (le compte 3, jamais synchronisé) — ce dernier vérifie que l'absence
// d'IBAN ne bloque pas la détection.
const CE_PERSO = "FR7610000000000000000000001";
const CE_COMMUN = "FR7610000000000000000000002";
const REVOLUT = "FR7610000000000000000000003";
const CAMILLE = "FR7610000000000000000000005"; // compte non connecté
const EMPLOYEUR = "FR7610000000000000000000006"; // employeur

const IBANS: OwnIbans = new Map([
  [1, REVOLUT],
  [4, CE_PERSO],
  [5, CE_COMMUN],
]);

let nextId = 1;
function leg(
  direction: "debit" | "credit",
  accountId: number,
  amount: string,
  bookingDate: string,
  extra: Partial<TransferLeg> = {},
): TransferLeg {
  return {
    id: nextId++,
    accountId,
    direction,
    amount,
    currency: "EUR",
    bookingDate,
    bankCode: null,
    counterpartyIban: null,
    ...extra,
  };
}

describe("matchInternalTransfers", () => {
  it("apparie une paire confirmée par IBAN le même jour", () => {
    // 03/08 : virement CE perso → Revolut, l'IBAN du débiteur est celui du
    // compte 4. Seule la jambe Revolut porte l'information, et cela suffit.
    const debit = leg("debit", 4, "2000.00", "2026-08-03");
    const credit = leg("credit", 1, "2000.00", "2026-08-03", {
      counterpartyIban: CE_PERSO,
    });

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([
      { debitId: debit.id, creditId: credit.id },
    ]);
  });

  it("préfère le candidat confirmé et refuse celui dont l'IBAN est externe", () => {
    // Le cas qui justifie tout le mécanisme : le même 03/08, deux crédits de
    // 2 000 € sur le compte commun. L'un vient du compte perso (interne),
    // l'autre du compte non connecté de la conjointe (vraie entrée du foyer).
    // Montant, date et compte destinataire sont identiques : seul l'IBAN les
    // distingue.
    const debit = leg("debit", 4, "2000.00", "2026-08-03");
    const interne = leg("credit", 1, "2000.00", "2026-08-03", {
      counterpartyIban: CE_PERSO,
    });
    const apportConjointe = leg("credit", 1, "2000.00", "2026-07-31", {
      counterpartyIban: CAMILLE,
    });

    expect(
      matchInternalTransfers([debit, interne, apportConjointe], IBANS),
    ).toEqual([{ debitId: debit.id, creditId: interne.id }]);
  });

  it("n'apparie jamais un salaire de même montant", () => {
    // 11/05 : un débit de 500 € et, trois jours plus tard, un virement de
    // l'employeur du même montant. Sans le veto par IBAN, la fenêtre de dates
    // les apparierait.
    const debit = leg("debit", 4, "500.00", "2026-05-11");
    const salaire = leg("credit", 1, "500.00", "2026-05-14", {
      counterpartyIban: EMPLOYEUR,
    });

    expect(matchInternalTransfers([debit, salaire], IBANS)).toEqual([]);
  });

  it("refuse un IBAN de contrepartie qui désigne un autre compte suivi", () => {
    // Virement CE perso → Revolut apparié par erreur au crédit du compte
    // commun : l'IBAN est bien l'un des nôtres, mais pas celui de la jumelle.
    const debit = leg("debit", 4, "300.00", "2026-06-01");
    const credit = leg("credit", 5, "300.00", "2026-06-01", {
      counterpartyIban: REVOLUT,
    });

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([]);
  });

  it("vetoe un paiement par carte de même montant", () => {
    // 19/07 : un paiement CB de 10 € face à un virement reçu de 10 € deux jours
    // plus tôt. Aucun IBAN d'aucun côté — c'est `bank_code` qui tranche.
    const carte = leg("debit", 1, "10.00", "2026-07-19", {
      bankCode: "CARD_PAYMENT",
    });
    const virement = leg("credit", 5, "10.00", "2026-07-17");

    expect(matchInternalTransfers([carte, virement], IBANS)).toEqual([]);
  });

  it("apparie sans aucun IBAN quand les dates coïncident", () => {
    // CE perso → CE commun : aucune des deux banques ne renseigne l'IBAN de
    // contrepartie, et pourtant c'est le virement interne le plus fréquent.
    const debit = leg("debit", 4, "648.60", "2026-07-06", { bankCode: "06" });
    const credit = leg("credit", 5, "648.60", "2026-07-06", { bankCode: "18" });

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([
      { debitId: debit.id, creditId: credit.id },
    ]);
  });

  it("refuse la même paire à trois jours d'écart faute de confirmation", () => {
    const debit = leg("debit", 4, "648.60", "2026-07-06", { bankCode: "06" });
    const credit = leg("credit", 5, "648.60", "2026-07-09", { bankCode: "18" });

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([]);
  });

  it("accepte trois jours d'écart quand l'IBAN confirme", () => {
    const debit = leg("debit", 4, "500.00", "2026-07-17");
    const credit = leg("credit", 1, "500.00", "2026-07-20", {
      counterpartyIban: CE_PERSO,
    });

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([
      { debitId: debit.id, creditId: credit.id },
    ]);
  });

  it("n'utilise chaque jambe qu'une fois", () => {
    // Un débit, deux crédits également plausibles : un seul appariement, et le
    // second crédit reste libre plutôt que d'être rattaché de force.
    const debit = leg("debit", 4, "50.00", "2026-05-11");
    const premier = leg("credit", 5, "50.00", "2026-05-11");
    const second = leg("credit", 1, "50.00", "2026-05-11");

    const pairs = matchInternalTransfers([debit, premier, second], IBANS);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.debitId).toBe(debit.id);
  });

  it("ignore un compte face à lui-même et les devises différentes", () => {
    const debit = leg("debit", 4, "100.00", "2026-05-11");
    const memeCompte = leg("credit", 4, "100.00", "2026-05-11");
    const autreDevise = leg("credit", 1, "100.00", "2026-05-11", {
      currency: "USD",
    });

    expect(
      matchInternalTransfers([debit, memeCompte, autreDevise], IBANS),
    ).toEqual([]);
  });

  it("tolère un compte sans IBAN en base", () => {
    // Le compte SG 3 n'a pas d'IBAN : il ne peut ni confirmer ni vetoer, la
    // paire retombe sur les seuls critères de date et de `bank_code`.
    const debit = leg("debit", 3, "280.00", "2026-07-10");
    const credit = leg("credit", 1, "280.00", "2026-07-10");

    expect(matchInternalTransfers([debit, credit], IBANS)).toEqual([
      { debitId: debit.id, creditId: credit.id },
    ]);
  });

  it("normalise la mise en forme du montant", () => {
    const debit = leg("debit", 4, "2000.0", "2026-06-02");
    const credit = leg("credit", 5, "2000.00", "2026-06-02");

    expect(matchInternalTransfers([debit, credit], IBANS)).toHaveLength(1);
  });
});
