import {
  addMonths,
  format,
  getDaysInMonth,
  setDate,
  subDays,
  subMonths,
} from "date-fns";

export function toISODate(d: Date | string = new Date()) {
  return format(d, "yyyy-MM-dd");
}

// The browser's pay-cycle preference only produces URL date bounds;
// server queries depend on dateFrom/dateTo, not this setting.
const MONTH_START_KEY = "month-start-day";

export const MONTH_START_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function monthStartDay(): number {
  if (typeof window === "undefined") return 1;
  try {
    const day = Number(localStorage.getItem(MONTH_START_KEY));
    return Number.isInteger(day) && day >= 1 && day <= 31 ? day : 1;
  } catch {
    return 1;
  }
}

export function setMonthStartDay(day: number) {
  try {
    localStorage.setItem(MONTH_START_KEY, String(day));
  } catch {
    // Keep the in-memory preference when localStorage is unavailable.
  }
}

// Clamp to the month's last day so short months keep contiguous pay cycles.
const startIn = (base: Date, day: number) =>
  setDate(base, Math.min(day, getDaysInMonth(base)));

export function cycleOf(d: Date, startDay = 1): { start: Date; end: Date } {
  let start = startIn(d, startDay);
  if (d < start) start = startIn(subMonths(d, 1), startDay);
  return { start, end: subDays(startIn(addMonths(start, 1), startDay), 1) };
}

export function monthBounds(d: Date, startDay = 1) {
  const { start, end } = cycleOf(d, startDay);
  return { dateFrom: toISODate(start), dateTo: toISODate(end) };
}
