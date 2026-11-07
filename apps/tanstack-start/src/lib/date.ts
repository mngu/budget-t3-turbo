import {
  endOfQuarter,
  endOfYear,
  startOfQuarter,
  startOfYear,
  subDays,
} from "date-fns";

import { cycleOf } from "@budget/api/schemas";

export const MONTH_START_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// Shortcuts are relative to today, never to the period on screen.
export function periodPresets(today: Date, startDay = 1) {
  const current = cycleOf(today, startDay);
  const previous = cycleOf(subDays(current.start, 1), startDay);
  return [
    { label: "Ce mois", from: current.start, to: current.end },
    { label: "Mois dernier", from: previous.start, to: previous.end },
    { label: "30 derniers jours", from: subDays(today, 29), to: today },
    {
      label: "Ce trimestre",
      from: startOfQuarter(today),
      to: endOfQuarter(today),
    },
    { label: "Cette année", from: startOfYear(today), to: endOfYear(today) },
  ];
}
