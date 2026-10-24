"use client";

import {
  Button,
  Label,
  ListBox,
  Popover,
  RangeCalendar,
  Select,
} from "@heroui/react";
import { parseDate } from "@internationalized/date";
import { useLoaderData } from "@tanstack/react-router";
import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  parseISO,
  subDays,
} from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import {
  cycleOf,
  MONTH_START_DAYS,
  monthBounds,
  monthStartDay,
  periodPresets,
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

export function PeriodPicker() {
  const { search, setSearch } = useRevueSearch();
  const [open, setOpen] = useState(false);
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
    <div className="flex max-w-full items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label="Période précédente"
        isDisabled={!monthReachable(stepTarget(-1))}
        onPress={() => shiftMonth(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <Popover isOpen={open} onOpenChange={setOpen}>
        {/* Fits "Septembre 2026" so the arrows stay put from month to month. */}
        <Button variant="ghost" size="sm" className="min-w-0 sm:min-w-36">
          {/* An aria-label would hide the period itself from screen readers. */}
          <span className="sr-only">Choisir une période : </span>
          {/* SSR does not know the browser's pay-cycle preference. */}
          <span className="truncate sm:hidden" suppressHydrationWarning>
            {periodLabel(from, to, startDay, dayMonthNumFr, dateNumFr)}
          </span>
          <span className="hidden truncate sm:inline" suppressHydrationWarning>
            {periodLabel(from, to, startDay)}
          </span>
        </Button>
        <Popover.Content>
          <Popover.Dialog className="flex w-min flex-col gap-4 sm:w-auto sm:flex-row">
            <div className="flex flex-wrap gap-1 sm:w-40 sm:flex-none sm:flex-col">
              {periodPresets(today, startDay).map((preset) => (
                <Button
                  key={preset.label}
                  size="sm"
                  variant={
                    from &&
                    to &&
                    isSameDay(preset.from, from) &&
                    isSameDay(preset.to, to)
                      ? "secondary"
                      : "ghost"
                  }
                  // Preserve full periods for monthly budgets; disable rather than clip.
                  isDisabled={!!min && preset.to < min}
                  onPress={() => commit(preset.from, preset.to)}
                >
                  {preset.label}
                </Button>
              ))}

              <Select
                className="mt-2 w-full"
                value={startDay}
                onChange={(day) => changeStartDay(Number(day))}
              >
                <Label>Le mois commence le</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {MONTH_START_DAYS.map((day) => (
                      <ListBox.Item key={day} id={day} textValue={String(day)}>
                        {day}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>

            <RangeCalendar
              aria-label="Période"
              value={
                from && to
                  ? {
                      start: parseDate(toISODate(from)),
                      end: parseDate(toISODate(to)),
                    }
                  : null
              }
              onChange={({ start, end }) =>
                commit(parseISO(start.toString()), parseISO(end.toString()))
              }
              defaultFocusedValue={parseDate(toISODate(anchor))}
              minValue={min ? parseDate(toISODate(min)) : undefined}
              maxValue={parseDate(toISODate(today))}
            >
              <RangeCalendar.Header>
                <RangeCalendar.Heading />
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => (
                    <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
                  )}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label="Période suivante"
        isDisabled={!monthReachable(stepTarget(1))}
        onPress={() => shiftMonth(1)}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  );
}
