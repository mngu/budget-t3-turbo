import { describe, expect, it } from "vitest";

import { wholeMonths } from "./revue-budgets";

describe("wholeMonths", () => {
  it("compte les mois calendaires", () => {
    expect(wholeMonths("2026-07-01", "2026-07-31")).toBe(1);
    expect(wholeMonths("2026-07-01", "2026-09-30")).toBe(3);
    expect(wholeMonths("2026-01-01", "2026-12-31")).toBe(12);
  });

  it("compte les cycles décalés", () => {
    expect(wholeMonths("2026-06-28", "2026-07-27")).toBe(1);
    expect(wholeMonths("2026-06-28", "2026-09-27")).toBe(3);
  });

  it("rend 0 sur une plage qui n'est pas faite de mois pleins", () => {
    expect(wholeMonths("2026-06-28", "2026-07-20")).toBe(0);
    expect(wholeMonths("2026-07-02", "2026-07-31")).toBe(0);
    expect(wholeMonths(undefined, "2026-07-31")).toBe(0);
  });
});
