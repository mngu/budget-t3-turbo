import type { Breakdown, BreakdownParent } from "@budget/shared";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

/**
 * Le niveau que la revue affiche, dérivé de l'arbre rendu par
 * `transactions.breakdownByCategories`.
 *
 * **Seule** définition de ce niveau : l'anneau de `/`, la colonne des postes,
 * l'en-tête et le forage (`useDrill`) en sortent tous, et c'est ce qui les
 * empêche de se contredire. Module pur, sans composant : le layout en a besoin
 * comme valeur alors qu'il ne rend jamais l'anneau.
 *
 * Ce fichier ne regroupe, ne totalise et ne trie plus rien — Postgres rend
 * l'arbre déjà groupé, trié et totalisé. Il ne reste ici que ce qui est de la
 * présentation : les libellés français, les sentinelles d'URL et le choix du
 * niveau ouvert.
 */

/** Libellé du poste sans rattachement, et sentinelle de son search param. */
const NO_CATEGORY = "Sans catégorie";
const NO_CATEGORY_FILTER = "none";

export interface BreakdownSlice {
  /** Libellé affiché. */
  name: string;
  /**
   * Valeur à poser dans le search param `category` pour désigner cette part.
   * Le libellé affiché n'en tient pas lieu : le poste sans rattachement se
   * filtre par la sentinelle `"none"`.
   */
  filter: string;
  /**
   * La dépense posée sur la parente elle-même, sans sous-catégorie. Ce n'est
   * plus un défaut à signaler — le filtre « à classer » a été supprimé — mais
   * l'anneau a besoin de la reconnaître : c'est la seule part qu'aucune valeur
   * de `category` ne désigne en propre.
   */
  unallocated: boolean;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide, `null` sur une sous-catégorie (elles n'en ont pas). */
  icon: string | null;
  /** Budget mensuel du poste, `null` s'il n'en a pas. */
  budget: number | null;
  /**
   * Ce poste ouvre-t-il un niveau ? Faux dès qu'il n'a pas de **vraie**
   * sous-catégorie — une racine sans enfant, le poste sans rattachement, et
   * toute part déjà au niveau du bas. L'anneau y serait vide.
   */
  drillable: boolean;
}

export interface BreakdownLevel {
  /** Le poste ouvert, `null` au niveau des parents. */
  parent: BreakdownSlice | null;
  /** Les parts du niveau, du plus gros au plus petit. */
  slices: BreakdownSlice[];
  /** Total du niveau affiché. */
  total: number;
  /** Total de toutes les sorties de la période, quel que soit le niveau. */
  expenses: number;
  /** Nombre de postes de dépense, quel que soit le niveau. */
  postes: number;
}

const hasSub = (parent: BreakdownParent) =>
  parent.children.some((child) => child.kind === "sub");

function parentSlice(parent: BreakdownParent): BreakdownSlice {
  return {
    name: parent.name ?? NO_CATEGORY,
    filter: parent.name ?? NO_CATEGORY_FILTER,
    unallocated: false,
    total: parent.total,
    color: parent.color ?? FALLBACK_CATEGORY_COLOR,
    icon: parent.icon,
    budget: parent.budget,
    drillable: hasSub(parent),
  };
}

function childSlices(parent: BreakdownParent): BreakdownSlice[] {
  return parent.children.map((child) => ({
    // Un enfant `unallocated` porte déjà le nom de sa parente — sa catégorie
    // *est* la parente. La ligne se lit donc « Logement » sous Logement, et son
    // filtre retombe naturellement sur la parente, ce qu'il montre de plus
    // précis : aucune valeur de `category` ne désigne ce reliquat seul.
    name: child.name ?? NO_CATEGORY,
    filter: child.name ?? NO_CATEGORY_FILTER,
    unallocated: child.kind === "unallocated",
    total: child.total,
    // Une sous-catégorie n'a pas de teinte propre : c'est un palier de celle de
    // sa parente, dérivé du rang au rendu (`shadeCategoryColor`).
    color: parent.color ?? FALLBACK_CATEGORY_COLOR,
    icon: null,
    budget: child.budget,
    drillable: false,
  }));
}

/**
 * La parente ouverte pour un filtre donné, ou `null`.
 *
 * Ce n'est **pas** « `category` est défini » — deux cas s'en écartent, et les
 * deux sont à l'écran : surligner une *sous*-catégorie pose le param sans
 * changer de niveau (c'est sa parente qui est ouverte), et une parente **sans
 * sous-catégorie** n'ouvre aucun niveau. `use-drill.test.ts` les verrouille.
 *
 * Un nom ne peut désigner qu'une parente *ou* une enfant (`categories.name` est
 * unique dans l'espace), l'ordre des deux recherches est donc indifférent.
 */
export function openParent(
  tree: Breakdown,
  category: string | undefined,
): BreakdownParent | null {
  if (category === undefined) return null;
  return (
    tree.parents.find(
      (parent) =>
        hasSub(parent) &&
        (parent.name === category ||
          parent.children.some((child) => child.name === category)),
    ) ?? null
  );
}

export function breakdownLevel(
  tree: Breakdown,
  category: string | undefined,
): BreakdownLevel {
  const open = openParent(tree, category);
  return {
    parent: open && parentSlice(open),
    slices: open ? childSlices(open) : tree.parents.map(parentSlice),
    total: open ? open.total : tree.expenses,
    expenses: tree.expenses,
    postes: tree.postes,
  };
}
