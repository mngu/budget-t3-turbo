import { useCents } from "./preferences";

// Both bounds: EUR defaults its minimum to 2, which a lower maximum contradicts.
const currency = (digits: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const WITH_CENTS = currency(2);
const WHOLE = currency(0);

// Hermes ignores signDisplay, so the plus sign is added by hand.
const signed = (format: Intl.NumberFormat) => (amount: number) =>
  `${amount > 0 ? "+" : ""}${format.format(amount)}`;

// A transaction's amount is exact, as in the web table: only totals follow the preference.
export const signedEuro = signed(WITH_CENTS);

export function useFormat() {
  const euro = useCents() ? WITH_CENTS : WHOLE;
  return { euro, signedEuro: signed(euro) };
}
