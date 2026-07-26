// Normalisation d'une transaction Enable Banking brute vers une ligne `transactions`.

import type { NewTransaction } from "@budget/db/schema";

export interface EbTransaction {
  entry_reference: string | null;
  transaction_amount: { currency: string; amount: string } | null;
  credit_debit_indicator: "CRDT" | "DBIT";
  status: string;
  booking_date: string | null;
  value_date: string | null;
  transaction_date: string | null;
  remittance_information: string[] | null;
  creditor: { name?: string | null } | null;
  debtor: { name?: string | null } | null;
  bank_transaction_code: {
    code?: string | null;
    sub_code?: string | null;
    description?: string | null;
  } | null;
  merchant_category_code: string | null;
  [key: string]: unknown;
}

export function normalizeTransaction(
  raw: EbTransaction,
  accountId: number,
): NewTransaction {
  if (!raw.entry_reference) throw new Error("entry_reference manquant");
  if (!raw.transaction_amount?.amount)
    throw new Error(`transaction_amount manquant (${raw.entry_reference})`);

  const bookingDate =
    raw.booking_date ?? raw.transaction_date ?? raw.value_date;
  if (!bookingDate)
    throw new Error(
      `aucune date (booking/transaction/value) (${raw.entry_reference})`,
    );

  const direction = raw.credit_debit_indicator === "DBIT" ? "debit" : "credit";
  // Pour un débit l'argent va au créancier ; pour un crédit il vient du débiteur.
  const counterparty =
    (direction === "debit" ? raw.creditor?.name : raw.debtor?.name) ?? null;
  const joined = (raw.remittance_information ?? []).join(" ").trim();

  return {
    accountId,
    entryReference: raw.entry_reference,
    amount: raw.transaction_amount.amount,
    currency: raw.transaction_amount.currency,
    direction,
    // Seul BOOK est « comptabilisée » ; OTHR, PDNG et tout statut inconnu restent « en attente »
    // (mieux vaut sous-afficher que de présenter à tort une transaction comme comptabilisée).
    status: raw.status === "BOOK" ? "booked" : "pending",
    bookingDate,
    valueDate: raw.value_date,
    // `||` volontaire, pas `??` : `joined` est une chaîne (vide quand
    // remittance_information est absent) et doit retomber sur la contrepartie.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    description: joined || counterparty || "(sans libellé)",
    counterparty,
    bankCode: raw.bank_transaction_code?.code ?? null,
    mcc: raw.merchant_category_code,
    raw,
  };
}
