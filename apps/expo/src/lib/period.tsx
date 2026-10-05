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

interface Period {
  month: Date;
  setMonth: Dispatch<SetStateAction<Date>>;
  // Undefined means all accounts, including any connected later.
  bank: string[] | undefined;
  setBank: Dispatch<SetStateAction<string[] | undefined>>;
}

// One period and account selection for every screen, as the web keeps them in
// the URL across the review and the table.
const PeriodContext = createContext<Period>({
  month: thisMonth(),
  setMonth: () => undefined,
  bank: undefined,
  setBank: () => undefined,
});

export function PeriodProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(thisMonth);
  const [bank, setBank] = useState<string[]>();
  return (
    <PeriodContext value={{ month, setMonth, bank, setBank }}>
      {children}
    </PeriodContext>
  );
}

export function usePeriod() {
  const period = use(PeriodContext);
  return {
    ...period,
    label: monthLabel.format(period.month),
    scope: { ...monthRange(period.month), bank: period.bank },
  };
}
