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

// Jour de départ du « mois » : 1 par défaut, réglable dans le sélecteur de
// période pour caler la revue sur un cycle de paie (« mon mois commence le 28 »).
// Gardé par navigateur, comme le thème — aucun écran serveur n'en dépend : le
// réglage ne fait que *produire* les bornes de l'URL, tout ce qui suit ne lit
// que `dateFrom`/`dateTo`.
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
    // localStorage indisponible : le réglage ne survivra pas au rechargement.
  }
}

// Le jour de départ ramené à un jour qui existe dans le mois de `base` : un
// cycle qui commence le 31 commence le 28 en février. Les cycles restent
// contigus et sans recouvrement, c'est tout ce qu'on lui demande.
const startIn = (base: Date, day: number) =>
  setDate(base, Math.min(day, getDaysInMonth(base)));

/** Bornes du cycle mensuel qui contient `d`. */
export function cycleOf(d: Date, startDay = 1): { start: Date; end: Date } {
  let start = startIn(d, startDay);
  if (d < start) start = startIn(subMonths(d, 1), startDay);
  return { start, end: subDays(startIn(addMonths(start, 1), startDay), 1) };
}

export function monthBounds(d: Date, startDay = 1) {
  const { start, end } = cycleOf(d, startDay);
  return { dateFrom: toISODate(start), dateTo: toISODate(end) };
}
