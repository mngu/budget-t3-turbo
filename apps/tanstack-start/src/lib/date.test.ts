import { describe, expect, it } from "vitest";

import { toISODate } from "@budget/api/schemas";

import { periodPresets } from "./date";

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
