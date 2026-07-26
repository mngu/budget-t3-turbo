import { describe, expect, it } from "vitest";

import type { ExistingCategoryForReplace } from "./replace-plan";
import { computeReplacePlan, flattenProposedNames } from "./replace-plan";

const cat = (
  id: number,
  name: string,
  parentId: number | null,
  manualTransactionCount = 0,
): ExistingCategoryForReplace => ({
  id,
  name,
  parentId,
  manualTransactionCount,
});

describe("computeReplacePlan", () => {
  it("supprime une catégorie absente de la proposition sans transaction manuelle", () => {
    const existing = [cat(1, "Ancienne", null)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([1]);
    expect(plan.namesToDelete).toEqual(["Ancienne"]);
    expect(plan.namesKept).toEqual([]);
  });

  it("conserve une catégorie absente mais avec une transaction manuelle", () => {
    const existing = [cat(1, "Ancienne", null, 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Ancienne"]);
  });

  it("conserve un parent absent si un de ses enfants est protégé (bottom-up)", () => {
    const existing = [
      cat(1, "Alimentation", null),
      cat(2, "Boulangerie", 1, 1),
    ];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Alimentation", "Boulangerie"]);
  });

  it("supprime un parent dont l'unique enfant absent n'est pas protégé", () => {
    const existing = [cat(1, "Alimentation", null), cat(2, "Boulangerie", 1)];
    const plan = computeReplacePlan(existing, new Set(["Nouvelle"]));
    expect(plan.idsToDelete).toEqual([1, 2]);
    expect(plan.namesToDelete).toEqual(["Alimentation", "Boulangerie"]);
    expect(plan.namesKept).toEqual([]);
  });

  it("ne supprime jamais une catégorie présente dans la proposition, même sans transaction", () => {
    const existing = [cat(1, "Courses", null)];
    const plan = computeReplacePlan(existing, new Set(["Courses"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual([]);
  });

  it("un enfant protégé garde son parent même si un autre enfant du même parent est proposé", () => {
    const existing = [
      cat(1, "Alimentation", null),
      cat(2, "Boulangerie", 1, 1),
      cat(3, "Courses", 1),
    ];
    const plan = computeReplacePlan(existing, new Set(["Courses"]));
    expect(plan.idsToDelete).toEqual([]);
    expect(plan.namesKept).toEqual(["Alimentation", "Boulangerie"]);
  });
});

describe("flattenProposedNames", () => {
  it("aplatit parents et enfants en un seul Set de noms", () => {
    const names = flattenProposedNames([
      {
        parent: "Alimentation",
        parentColor: "#f59e0b",
        enfants: [
          { name: "Courses", txnIds: [] },
          { name: "Restaurants", txnIds: [] },
        ],
      },
      {
        parent: "Transport",
        parentColor: "#3b82f6",
        enfants: [{ name: "Essence", txnIds: [] }],
      },
    ]);
    expect(names).toEqual(
      new Set([
        "Alimentation",
        "Courses",
        "Restaurants",
        "Transport",
        "Essence",
      ]),
    );
  });
});
