"use client";

import type { DateRange } from "react-day-picker";
import {
  addMonths,
  endOfMonth,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

import { Calendar } from "@budget/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import { monthBounds, toISODate } from "~/lib/date";
import { dateFr } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";

const monthFr = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Juillet 2026 » quand les bornes couvrent exactement un mois, sinon la plage
// complète : les flèches posent toujours un mois entier, mais le calendrier
// permet une période quelconque et l'intitulé doit rester honnête.
function periodLabel(from?: Date, to?: Date) {
  if (!from || !to) return "Toute la période";
  if (isSameDay(from, startOfMonth(from)) && isSameDay(to, endOfMonth(from)))
    return capitalize(monthFr.format(from));
  return `${dateFr.format(from)} – ${dateFr.format(to)}`;
}

export function PeriodStepper() {
  const { search, setSearch } = useRevueSearch();
  const from = search.dateFrom ? parseISO(search.dateFrom) : undefined;
  const to = search.dateTo ? parseISO(search.dateTo) : undefined;

  const shiftMonth = (delta: number) => {
    const anchor = from ?? new Date();
    setSearch(
      monthBounds(
        delta < 0 ? subMonths(anchor, -delta) : addMonths(anchor, delta),
      ),
    );
  };

  const onSelect = (range: DateRange | undefined) =>
    setSearch({
      dateFrom: range?.from ? toISODate(range.from) : undefined,
      dateTo: range?.to ? toISODate(range.to) : undefined,
    });

  return (
    <div className="bg-secondary border-border flex items-center gap-0.5 rounded-lg border p-0.5">
      <button
        type="button"
        title="Mois précédent"
        aria-label="Mois précédent"
        onClick={() => shiftMonth(-1)}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 items-center justify-center rounded-md"
      >
        ‹
      </button>
      <Popover>
        <PopoverTrigger
          render={(props) => (
            <button
              type="button"
              className="hover:bg-accent num rounded-md px-2.5 py-0.5 font-medium"
              {...props}
            >
              {periodLabel(from, to)}
            </button>
          )}
        />
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={fr}
            defaultMonth={from}
            selected={{ from, to }}
            onSelect={onSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
      <button
        type="button"
        title="Mois suivant"
        aria-label="Mois suivant"
        onClick={() => shiftMonth(1)}
        className="text-subtle hover:bg-accent hover:text-foreground flex size-6 items-center justify-center rounded-md"
      >
        ›
      </button>
    </div>
  );
}
