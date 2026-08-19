import type { Breakdown, BreakdownChild, BreakdownParent } from "@budget/shared";

/**
 * L'arbre rendu par `transactions.breakdownByCategories`. Partagé par les tests
 * de `breakdown` et de `useDrill`, qui décrivent le même niveau vu de deux
 * places.
 *
 * Le tri et les totaux viennent de Postgres : les fixtures les posent donc
 * telles que la requête les rendrait, sans quoi elles testeraient un
 * regroupement que le TS ne fait plus.
 */
export const sub = (
  name: string,
  total: number,
  budget: number | null = null,
): BreakdownChild => ({ name, kind: "sub", total, budget });

/**
 * Le reliquat porté par la parente : sa catégorie *est* la parente, il en porte
 * donc le nom — c'est ce que rend le SQL, et ce dont dépend son `filter`.
 */
export const unallocated = (
  parentName: string,
  total: number,
  budget: number | null = null,
): BreakdownChild => ({
  name: parentName,
  kind: "unallocated",
  total,
  budget,
});

export const parent = (
  name: string | null,
  total: number,
  children: BreakdownChild[] = [],
  budget: number | null = null,
): BreakdownParent => ({
  name,
  kind: name === null ? "none" : "parent",
  icon: null,
  color: null,
  total,
  budget,
  children,
});

export const tree = (parents: BreakdownParent[]): Breakdown => ({
  expenses: parents.reduce((sum, p) => sum + p.total, 0),
  postes: parents.length,
  parents,
});
