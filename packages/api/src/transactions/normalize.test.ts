import { describe, expect, it } from "vitest";

import type { EbTransaction } from "./normalize";
import { normalizeTransaction } from "./normalize";

const base: EbTransaction = {
  entry_reference: "750000000000002026-07-10-14.16.45.085503",
  transaction_amount: { currency: "EUR", amount: "500.00" },
  credit_debit_indicator: "CRDT",
  status: "BOOK",
  booking_date: "2026-07-10",
  value_date: null,
  transaction_date: null,
  remittance_information: ["VIREMENT DE M MAX"],
  creditor: null,
  debtor: null,
  bank_transaction_code: { code: "C2", sub_code: null, description: null },
  merchant_category_code: null,
};

describe("normalizeTransaction", () => {
  it("normalise un crédit comptabilisé (Caisse d'Épargne)", () => {
    const row = normalizeTransaction(base, 7);
    expect(row).toMatchObject({
      accountId: 7,
      entryReference: "750000000000002026-07-10-14.16.45.085503",
      amount: "500.00",
      currency: "EUR",
      direction: "credit",
      status: "booked",
      bookingDate: "2026-07-10",
      valueDate: null,
      description: "VIREMENT DE M MAX",
      counterparty: null,
      bankCode: "C2",
      mcc: null,
    });
    expect(row.raw).toEqual(base);
  });

  it("normalise un débit en attente (Revolut) avec contrepartie créancier", () => {
    const revolut: EbTransaction = {
      ...base,
      entry_reference: "054b403d-bc4c-e3a2-00c0-4b3cb375fafd",
      transaction_amount: { currency: "EUR", amount: "31.10" },
      credit_debit_indicator: "DBIT",
      status: "PDNG",
      booking_date: "2026-07-12",
      remittance_information: ["CARREFOUR PARIS"],
      creditor: { name: "CARREFOUR" },
      bank_transaction_code: {
        code: "CARD_PAYMENT",
        sub_code: null,
        description: null,
      },
      merchant_category_code: "5411",
    };
    const row = normalizeTransaction(revolut, 3);
    expect(row).toMatchObject({
      direction: "debit",
      status: "pending",
      counterparty: "CARREFOUR",
      mcc: "5411",
      description: "CARREFOUR PARIS",
    });
  });

  it("joint plusieurs lignes de libellé et retombe sur la contrepartie si vide", () => {
    const multi = { ...base, remittance_information: ["LIGNE 1", "LIGNE 2"] };
    expect(normalizeTransaction(multi, 1).description).toBe("LIGNE 1 LIGNE 2");

    const vide = {
      ...base,
      remittance_information: null,
      debtor: { name: "EMPLOYEUR SAS" },
    };
    expect(normalizeTransaction(vide, 1).description).toBe("EMPLOYEUR SAS");
  });

  it("rejette une transaction sans entry_reference", () => {
    expect(() =>
      normalizeTransaction({ ...base, entry_reference: "" }, 1),
    ).toThrow(/entry_reference/);
  });

  it("normalise un paiement carte OTHR (Caisse d'Épargne) sans booking_date, en attente, avec transaction_date en repli", () => {
    const othr: EbTransaction = {
      ...base,
      entry_reference: "7500000000000001072652629463424633426909",
      credit_debit_indicator: "DBIT",
      status: "OTHR",
      booking_date: null,
      value_date: null,
      transaction_date: "2026-06-29",
      remittance_information: ["AMAZON PAYMENTS"],
    };
    const row = normalizeTransaction(othr, 4);
    expect(row).toMatchObject({
      status: "pending",
      bookingDate: "2026-06-29",
    });
  });

  it("rejette une transaction sans aucune date (booking, transaction, value)", () => {
    const sansDate: EbTransaction = {
      ...base,
      booking_date: null,
      value_date: null,
      transaction_date: null,
    };
    expect(() => normalizeTransaction(sansDate, 1)).toThrow(/aucune date/);
  });
});
