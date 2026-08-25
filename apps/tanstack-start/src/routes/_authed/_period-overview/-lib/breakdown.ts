import type {
  NewCategoryOverviewElementType,
  NewCategoryOverviewType,
} from "@budget/api/schemas";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

import { sumBy } from "~/lib/sum";

/**
 * Le niveau que la revue affiche, dérivé de l'arbre rendu par
 * `categories.newOverview`.
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
export const NO_CATEGORY = "Sans catégorie";
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

/**
 * La parente ouverte pour un filtre donné, ou `null`. **Seule** définition du
 * niveau ouvert : l'anneau, la colonne des postes, l'en-tête et le forage en
 * sortent tous, et c'est ce qui les empêche de se contredire.
 *
 * Ce n'est **pas** « `category` est défini », ni un `find` par nom — deux cas
 * s'en écartent et les deux sont à l'écran : filtrer une *sous*-catégorie pose
 * le param sans changer de niveau (c'est sa parente qui est ouverte, cas vivant
 * sur `/transactions` où l'on filtre aux deux niveaux), et une parente **sans
 * sous-catégorie** n'ouvre aucun niveau — l'anneau y serait vide et le seul
 * moyen d'en ressortir serait le bouton du centre. `use-drill.test.ts` les
 * verrouille.
 *
 * Un nom ne peut désigner qu'une parente *ou* une enfant (`categories.name` est
 * unique dans l'espace), l'ordre des deux recherches est donc indifférent.
 */
export function openParent(
  tree: NewCategoryOverviewType,
  category: string | undefined,
): NewCategoryOverviewElementType | null {
  if (category === undefined) return null;
  return (
    tree.find(
      (parent) =>
        (parent.children?.length ?? 0) > 0 &&
        (parent.name === category ||
          (parent.children?.some((child) => child.name === category) ?? false)),
    ) ?? null
  );
}

function parentSlice(parent: NewCategoryOverviewElementType): BreakdownSlice {
  return {
    // `name` est null sur le poste des transactions sans catégorie : la requête
    // ne descend aucun libellé, ils se posent ici.
    name: parent.name ?? NO_CATEGORY,
    filter: parent.name ?? NO_CATEGORY_FILTER,
    unallocated: false,
    total: parent.totalAmount ?? 0,
    color: parent.color ?? FALLBACK_CATEGORY_COLOR,
    icon: parent.icon,
    budget: parent.budgetAmount,
    drillable: (parent.children?.length ?? 0) > 0,
  };
}

function childSlices(parent: NewCategoryOverviewElementType): BreakdownSlice[] {
  const children = parent.children ?? [];
  const slices: BreakdownSlice[] = children.map((child) => ({
    name: child.name,
    filter: child.name,
    unallocated: false,
    total: child.totalAmount ?? 0,
    // Une sous-catégorie n'a pas de teinte propre : palier de celle de sa
    // parente, dérivé du rang au rendu.
    color: parent.color ?? FALLBACK_CATEGORY_COLOR,
    icon: null,
    budget: child.budgetAmount,
    drillable: false,
  }));

  // Le reliquat — la dépense posée sur la parente elle-même. `newOverview` ne
  // lui donne aucune ligne (`children` ne contient que de vraies
  // sous-catégories), mais son montant s'en **déduit exactement** : le total
  // d'une parente couvre ses transactions directes *et* celles de ses enfants.
  // Sans lui la somme des arcs n'égalerait plus le centre de l'anneau.
  //
  // Il se range en dernier, là où l'ancien arbre le laissait trier par
  // Postgres : c'est une part d'une autre nature, pas un enfant de plus.
  const residual =
    (parent.totalAmount ?? 0) -
    sumBy(children, (child) => child.totalAmount ?? 0);
  // Au centime près : un résidu d'arrondi flottant peindrait un arc fantôme
  // sur chaque parente.
  if (Math.round(residual * 100) !== 0) {
    slices.push({
      name: parent.name ?? NO_CATEGORY,
      filter: parent.name ?? NO_CATEGORY_FILTER,
      unallocated: true,
      total: residual,
      color: parent.color ?? FALLBACK_CATEGORY_COLOR,
      icon: null,
      budget: null,
      drillable: false,
    });
  }
  return slices;
}

/**
 * Le niveau affiché, dérivé de l'arbre de `categories.newOverview`.
 *
 * Deux traitements tiennent à ce que la requête ne rend pas, et non à un choix :
 * elle liste **toutes** les parentes de l'espace, y compris celles sans
 * mouvement sur la période — écartées ici, un poste sans dépense n'ayant pas
 * d'arc — et le **reliquat** d'une parente n'a pas de ligne non plus, mais se
 * déduit exactement (voir `childSlices`).
 */
export function breakdownLevel(
  tree: NewCategoryOverviewType,
  category: string | undefined,
): BreakdownLevel {
  const open = openParent(tree, category);
  const moved = tree.filter((parent) => parent.totalAmount !== null);
  const expenses = sumBy(moved, (parent) => parent.totalAmount ?? 0);
  return {
    parent: open && parentSlice(open),
    slices: open ? childSlices(open) : moved.map(parentSlice),
    total: open ? (open.totalAmount ?? 0) : expenses,
    expenses,
    postes: moved.length,
  };
}
