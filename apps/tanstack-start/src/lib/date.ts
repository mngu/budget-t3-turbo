import { endOfMonth, format, startOfMonth } from "date-fns";

export function toISODate(d: Date | string = new Date()) {
  return format(d, "yyyy-MM-dd");
}

export function monthBounds(d: Date) {
  return {
    dateFrom: toISODate(startOfMonth(d)),
    dateTo: toISODate(endOfMonth(d)),
  };
}
