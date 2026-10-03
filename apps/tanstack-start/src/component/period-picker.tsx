"use client";

import { useLoaderData } from "@tanstack/react-router";
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
} from "date-fns";
import { fr } from "date-fns/locale";
import { useState } from "react";

import { cn } from "@budget/ui";
import { Calendar } from "@budget/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";
import {
  cycleOf,
  MONTH_START_DAYS,
  monthBounds,
  monthStartDay,
  setMonthStartDay,
  toISODate,
} from "~/lib/date";
import {
  dateFr,
  dateNumFr,
  dayMonthFr,
  dayMonthNumFr,
  monthFr,
} from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Name full cycles by their midpoint's month: a cycle starting June 28 is July.
function periodLabel(
  from: Date | undefined,
  to: Date | undefined,
  startDay: number,
  dayMonth = dayMonthFr,
  date = dateFr,
) {
  if (!from || !to) return "Toute la période";
  const cycle = cycleOf(from, startDay);
  if (isSameDay(cycle.start, from) && isSameDay(cycle.end, to))
    return capitalize(
      monthFr.format(
        addDays(from, Math.floor(differenceInCalendarDays(to, from) / 2)),
      ),
    );
  const start =
    from.getFullYear() === to.getFullYear()
      ? dayMonth.format(from)
      : date.format(from);
  return `${start} – ${date.format(to)}`;
}

interface Preset {
  label: string;
  from: Date;
  to: Date;
}

// Anchor shortcuts to the displayed period so browsing history does not jump to today.
function buildPresets(anchor: Date, startDay: number): Preset[] {
  const current = cycleOf(anchor, startDay);
  const previous = cycleOf(subDays(current.start, 1), startDay);
  return [
    { label: "Ce mois", from: current.start, to: current.end },
    { label: "Mois dernier", from: previous.start, to: previous.end },
    {
      label: "30 derniers jours",
      from: subDays(current.end, 29),
      to: current.end,
    },
    {
      label: "Ce trimestre",
      from: startOfQuarter(anchor),
      to: endOfQuarter(anchor),
    },
    { label: "Cette année", from: startOfYear(anchor), to: endOfYear(anchor) },
  ];
}

/**
 * Keep incomplete ranges local so the loaders only run once both dates are chosen.
 */
export function PeriodPicker() {
  const { search, setSearch } = useRevueSearch();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  // SSR cannot read the saved pay cycle; the client corrects the URL and reloads data.
  const [startDay, setStartDay] = useState(monthStartDay);

  const from = search.dateFrom ? parseISO(search.dateFrom) : undefined;
  const to = search.dateTo ? parseISO(search.dateTo) : undefined;
  const anchor = from ?? new Date();

  const { earliestDate: earliest } = useLoaderData({
    from: "/_authed/_period-overview",
  });
  const today = new Date();
  const min = earliest ? parseISO(earliest) : undefined;
  // Any overlap keeps the first and current months reachable.
  const monthReachable = (date: Date) => {
    const cycle = cycleOf(date, startDay);
    return (!min || cycle.end >= min) && cycle.start <= today;
  };

  const commit = (start: Date, end: Date) => {
    setDraft(null);
    setOpen(false);
    setSearch({ dateFrom: toISODate(start), dateTo: toISODate(end) });
  };

  // Step from cycle boundaries: addMonths clamps short months and causes round-trip drift.
  const stepTarget = (delta: number) => {
    const cycle = cycleOf(anchor, startDay);
    return delta < 0 ? subDays(cycle.start, 1) : addDays(cycle.end, 1);
  };

  // Bookmarks and manual URLs can start outside the picker bounds.
  const shiftMonth = (delta: number) => {
    const target = stepTarget(delta);
    if (!monthReachable(target)) return;
    setSearch(monthBounds(target, startDay));
  };

  const changeStartDay = (day: number) => {
    setStartDay(day);
    setMonthStartDay(day);
    setSearch(monthBounds(anchor, day));
  };

  return (
    <div className="grid w-72 max-w-full grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] items-center gap-1 sm:grid-cols-[2rem_minmax(0,1fr)_2rem]">
      <StepButton
        label="Période précédente"
        onClick={() => shiftMonth(-1)}
        disabled={!monthReachable(stepTarget(-1))}
        glyph="‹"
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Discard incomplete selections when closing.
          if (!next) setDraft(null);
        }}
      >
        <PopoverTrigger
          render={(props) => (
            <button
              type="button"
              title="Choisir une période"
              className="num hover:text-foreground flex min-h-8 min-w-0 items-center justify-center font-medium tracking-[-0.01em]"
              {...props}
            >
              {/* SSR does not know the browser's pay-cycle preference. */}
              <span className="truncate sm:hidden" suppressHydrationWarning>
                {periodLabel(from, to, startDay, dayMonthNumFr, dateNumFr)}
              </span>
              <span
                className="hidden truncate sm:inline"
                suppressHydrationWarning
              >
                {periodLabel(from, to, startDay)}
              </span>
              <span
                className="text-subtle text-label ml-1.5 flex-none"
                aria-hidden="true"
              >
                ▾
              </span>
            </button>
          )}
        />
        <PopoverContent align="center" className="w-auto gap-0 p-3.5">
          <div className="flex gap-4">
            <div className="flex w-28 flex-none flex-col gap-0.5 pt-0.5">
              {buildPresets(anchor, startDay).map((preset) => {
                const active =
                  !!from &&
                  !!to &&
                  isSameDay(preset.from, from) &&
                  isSameDay(preset.to, to);
                // Preserve full periods for monthly budgets; disable rather than clip.
                const reachable =
                  (!min || preset.to >= min) && preset.from <= today;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={!reachable}
                    onClick={() => commit(preset.from, preset.to)}
                    className={cn(
                      "text-control py-1 text-left disabled:pointer-events-none disabled:opacity-40",
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}

              <label className="border-border text-subtle text-label mt-2 flex flex-col gap-1 border-t pt-2">
                Le mois commence le
                <select
                  value={startDay}
                  onChange={(e) => changeStartDay(Number(e.target.value))}
                  className="border-border bg-card text-foreground text-control rounded-md border px-1.5 py-1"
                >
                  {MONTH_START_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-col">
              <Calendar
                mode="range"
                locale={fr}
                numberOfMonths={1}
                defaultMonth={anchor}
                // Keep the full current month visible while disabling future days.
                startMonth={min ? startOfMonth(min) : undefined}
                endMonth={endOfMonth(today)}
                disabled={
                  min ? { before: min, after: today } : { after: today }
                }
                selected={
                  draft ? { from: draft } : from ? { from, to } : undefined
                }
                onSelect={(_range, day) => {
                  if (!draft) {
                    setDraft(day);
                    return;
                  }
                  const [start, end] =
                    day < draft ? [day, draft] : [draft, day];
                  commit(start, end);
                }}
                className="p-0"
              />

              <div className="mt-2.5 flex items-center gap-2.5">
                <button
                  type="button"
                  className="text-primary text-control ml-auto"
                  onClick={() => setOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <StepButton
        label="Période suivante"
        onClick={() => shiftMonth(1)}
        disabled={!monthReachable(stepTarget(1))}
        glyph="›"
      />
    </div>
  );
}

function StepButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-subtle hover:bg-accent hover:text-foreground text-body touch-target flex size-6 items-center justify-center rounded-sm disabled:pointer-events-none disabled:opacity-30 sm:size-8"
    >
      {glyph}
    </button>
  );
}
