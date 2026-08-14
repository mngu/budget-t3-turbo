import { describe, expect, it } from "vitest";

import { monthBounds } from "./date";

const bounds = (iso: string, startDay?: number) =>
  monthBounds(new Date(`${iso}T12:00:00`), startDay);

describe("monthBounds", () => {
  it("rend le mois calendaire par défaut", () => {
    expect(bounds("2026-07-15")).toEqual({
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
    });
  });

  it("rend le cycle qui contient la date", () => {
    // Avant le jour de départ : on est encore dans le cycle précédent.
    expect(bounds("2026-07-15", 28)).toEqual({
      dateFrom: "2026-06-28",
      dateTo: "2026-07-27",
    });
    // Le jour de départ lui-même ouvre le cycle suivant.
    expect(bounds("2026-07-28", 28)).toEqual({
      dateFrom: "2026-07-28",
      dateTo: "2026-08-27",
    });
  });

  it("écrête le jour de départ sur les mois plus courts", () => {
    expect(bounds("2026-02-10", 31)).toEqual({
      dateFrom: "2026-01-31",
      dateTo: "2026-02-27",
    });
    expect(bounds("2026-03-01", 31)).toEqual({
      dateFrom: "2026-02-28",
      dateTo: "2026-03-30",
    });
  });

  it("enchaîne les cycles sans trou ni recouvrement", () => {
    let cursor = new Date("2026-01-05T12:00:00");
    for (let i = 0; i < 24; i++) {
      const { dateFrom, dateTo } = monthBounds(cursor, 29);
      expect(dateFrom <= dateTo).toBe(true);
      const next = new Date(`${dateTo}T12:00:00`);
      next.setDate(next.getDate() + 1);
      // Le lendemain de la fin doit ouvrir le cycle suivant, pas retomber dans
      // celui qu'on vient de quitter.
      expect(monthBounds(next, 29).dateFrom > dateFrom).toBe(true);
      cursor = next;
    }
  });
});
