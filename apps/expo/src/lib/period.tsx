import type { Dispatch, ReactNode, SetStateAction } from "react";

import { useQuery } from "@tanstack/react-query";
import { createContext, use, useState } from "react";

import { cycleMonth, cycleOf, monthBounds } from "@budget/api/schemas";

import { trpc } from "./trpc";

const monthLabel = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

interface Period {
  // Any day of the period on screen; the space's pay cycle sets its bounds.
  anchor: Date;
  setAnchor: Dispatch<SetStateAction<Date>>;
  startDay: number;
  // Undefined means all accounts, including any connected later.
  bank: string[] | undefined;
  setBank: Dispatch<SetStateAction<string[] | undefined>>;
}

// One period and account selection for every screen, as the web keeps them in
// the URL across the review and the table.
const PeriodContext = createContext<Period>({
  anchor: new Date(),
  setAnchor: () => undefined,
  startDay: 1,
  bank: undefined,
  setBank: () => undefined,
});

export function PeriodProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [bank, setBank] = useState<string[]>();
  const { data: startDay, isPending } = useQuery({
    ...trpc.spaces.monthStartDay.queryOptions(),
    enabled: signedIn,
  });
  // Wait for the cycle rather than load a calendar month the screens would then replace.
  if (signedIn && isPending) return null;
  return (
    <PeriodContext
      value={{ anchor, setAnchor, startDay: startDay ?? 1, bank, setBank }}
    >
      {children}
    </PeriodContext>
  );
}

export function usePeriod() {
  const period = use(PeriodContext);
  const cycle = cycleOf(period.anchor, period.startDay);
  return {
    ...period,
    cycle,
    label: monthLabel.format(cycleMonth(cycle)),
    scope: {
      ...monthBounds(period.anchor, period.startDay),
      bank: period.bank,
    },
  };
}
