import type { NewCategoryOverviewType } from "@budget/api/schemas";

/**
 * L'arbre rendu par `categories.newOverview`. Partagé par les tests de
 * `breakdownLevel` et de `levelKey` : les deux dérivent le même niveau et
 * doivent le faire dire la même chose.
 *
 * Deux formes comptent et sont faciles à oublier en écrivant un cas à la main :
 * une parente **sans** sous-catégorie (`children: []`), qui n'ouvre aucun
 * niveau, et le poste des transactions sans catégorie, dont `name` est `null` —
 * la requête ne descend aucun libellé.
 */
type Element = NewCategoryOverviewType[number];
type Child = NonNullable<Element["children"]>[number];

export const sub = (
  name: string,
  totalAmount: number | null,
  budgetAmount: number | null = null,
): Child => ({
  id: name.length,
  name,
  budgetAmount,
  transactionCount: totalAmount === null ? 0 : 1,
  totalAmount,
});

export const poste = (
  name: string | null,
  totalAmount: number | null,
  children: Child[] = [],
  budgetAmount: number | null = null,
  budgetDetailed = false,
): Element => ({
  id: (name ?? "sans").length,
  organization_id: "org_1",
  name,
  color: "#123456",
  icon: null,
  budgetAmount,
  budgetDetailed,
  transactionCount: totalAmount === null ? 0 : 1,
  totalAmount,
  children,
});

export const tree = (postes: Element[]): NewCategoryOverviewType => postes;
