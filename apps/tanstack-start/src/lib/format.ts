import type { TransactionRow } from "@budget/api";

export const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export const dayMonthFr = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
});

// Normalize uppercase counterparty names, but keep transaction descriptions untouched.
export function titleCase(value: string) {
  return value
    .toLocaleLowerCase("fr-FR")
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_, boundary: string, letter: string) =>
        boundary + letter.toLocaleUpperCase("fr-FR"),
    );
}

const percentFr = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});

// Keep nonzero amounts distinguishable from zero after rounding.
export function sharePercent(part: number, whole: number) {
  if (whole === 0 || part === 0) return percentFr.format(0);
  const share = part / whole;
  return share < 0.01 ? "< 1 %" : percentFr.format(share);
}

export function signedAmount(
  row: Pick<TransactionRow, "direction" | "amount">,
) {
  return (row.direction === "debit" ? -1 : 1) * Number(row.amount);
}
