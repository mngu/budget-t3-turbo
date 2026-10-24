import { describe, expect, it } from "vitest";

import { monthBounds, periodPresets, toISODate } from "./date";

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
    expect(bounds("2026-07-15", 28)).toEqual({
      dateFrom: "2026-06-28",
      dateTo: "2026-07-27",
    });
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
      expect(monthBounds(next, 29).dateFrom > dateFrom).toBe(true);
      cursor = next;
    }
  });
});

const presets = (iso: string, startDay?: number) =>
  Object.fromEntries(
    periodPresets(new Date(`${iso}T12:00:00`), startDay).map(
      ({ label, from, to }) => [label, [toISODate(from), toISODate(to)]],
    ),
  );

describe("periodPresets", () => {
  it("rend les périodes calendaires autour d'aujourd'hui", () => {
    expect(presets("2026-10-24")).toEqual({
      "Ce mois": ["2026-10-01", "2026-10-31"],
      "Mois dernier": ["2026-09-01", "2026-09-30"],
      "30 derniers jours": ["2026-09-25", "2026-10-24"],
      "Ce trimestre": ["2026-10-01", "2026-12-31"],
      "Cette année": ["2026-01-01", "2026-12-31"],
    });
  });

  it("suit le cycle de paie pour le mois", () => {
    expect(presets("2026-10-24", 28)).toMatchObject({
      "Ce mois": ["2026-09-28", "2026-10-27"],
      "Mois dernier": ["2026-08-28", "2026-09-27"],
    });
    expect(presets("2026-10-29", 28)).toMatchObject({
      "Ce mois": ["2026-10-28", "2026-11-27"],
      "Mois dernier": ["2026-09-28", "2026-10-27"],
    });
  });

  it("écrête le cycle de paie sur février", () => {
    expect(presets("2026-03-01", 31)).toMatchObject({
      "Ce mois": ["2026-02-28", "2026-03-30"],
      "Mois dernier": ["2026-01-31", "2026-02-27"],
      "30 derniers jours": ["2026-01-31", "2026-03-01"],
    });
  });

  it("change d'année en janvier", () => {
    expect(presets("2026-01-05")).toMatchObject({
      "Mois dernier": ["2025-12-01", "2025-12-31"],
      "Cette année": ["2026-01-01", "2026-12-31"],
    });
  });
});
