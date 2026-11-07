// Plain Date arithmetic so the mobile bundle does not need date-fns.
export const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Clamp to the month's last day so short months keep contiguous pay cycles.
const startIn = (year: number, month: number, day: number) =>
  new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));

export function cycleOf(d: Date, startDay = 1): { start: Date; end: Date } {
  let start = startIn(d.getFullYear(), d.getMonth(), startDay);
  if (d < start) start = startIn(d.getFullYear(), d.getMonth() - 1, startDay);
  const next = startIn(start.getFullYear(), start.getMonth() + 1, startDay);
  return {
    start,
    end: new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1),
  };
}

export function monthBounds(d: Date, startDay = 1) {
  const { start, end } = cycleOf(d, startDay);
  return { dateFrom: toISODate(start), dateTo: toISODate(end) };
}

// Name a cycle by its midpoint's month: a cycle starting June 28 is July.
export function cycleMonth({ start, end }: { start: Date; end: Date }) {
  return new Date((start.getTime() + end.getTime()) / 2);
}
