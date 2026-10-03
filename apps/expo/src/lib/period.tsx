import type { Dispatch, ReactNode, SetStateAction } from "react";

import { createContext, use, useState } from "react";

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

// ponytail: calendar months only; the web's custom month start day lives in its localStorage.
const thisMonth = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), 1);
};

export const monthRange = (month: Date) => ({
  dateFrom: isoDate(month),
  dateTo: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
});

// One period for every screen, as the web keeps it in the URL across the review and the table.
const PeriodContext = createContext<[Date, Dispatch<SetStateAction<Date>>]>([
  thisMonth(),
  () => undefined,
]);

export function PeriodProvider({ children }: { children: ReactNode }) {
  return <PeriodContext value={useState(thisMonth)}>{children}</PeriodContext>;
}

export function usePeriod() {
  const [month, setMonth] = use(PeriodContext);
  return {
    month,
    setMonth,
    label: monthLabel.format(month),
    range: monthRange(month),
  };
}
