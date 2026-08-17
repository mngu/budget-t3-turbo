import type { BreakdownByCategories } from "@budget/shared";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

/**
 * La répartition des sorties, dérivée des lignes plates de
 * `transactions.breakdownByCategories` — une par couple (parente, catégorie).
 *
 * **Seule** définition du niveau affiché par la revue : l'anneau de `/`, la
 * colonne des postes et le forage (`useDrill`) en sortent tous, et c'est ce qui
 * les empêche de se contredire. Module pur, sans composant : le layout en a
 * besoin comme valeur alors qu'il ne rend jamais l'anneau.
 */

/** Libellé du groupe sans rattachement, et sentinelle de son search param. */
const NO_CATEGORY = "Sans catégorie";
const NO_CATEGORY_FILTER = "none";
const A_CLASSER = "À classer";

export interface BreakdownSlice {
  /** Libellé affiché. */
  name: string;
  /**
   * Valeur à poser dans le search param `category` pour désigner cette part.
   * Le libellé affiché n'en tient pas lieu : le groupe sans rattachement se
   * filtre par la sentinelle `"none"`, et « À classer » — que rien ne peut
   * désigner — porte celui de sa parente, ce qu'il montre de plus précis.
   */
  filter: string;
  /**
   * Le reliquat porté par la parente elle-même : un reste à ranger, pas une
   * sous-catégorie de plus. Il se dessine hachuré, et son `filter` désigne sa
   * parente et non lui.
   */
  aClasser: boolean;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide, `null` sur une sous-catégorie (elles n'en ont pas). */
  icon: string | null;
  /** Budget mensuel du poste, `null` s'il n'en a pas. */
  budget: number | null;
  /**
   * Nombre de vraies sous-catégories — 0 sur une part déjà au niveau du bas.
   * C'est **la** condition pour descendre : un poste sans sous-catégorie
   * n'ouvre aucun niveau, l'anneau y serait vide.
   */
  subs: number;
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

interface Group {
  parent: BreakdownSlice;
  rows: BreakdownByCategories[];
}

/**
 * Une ligne dont la catégorie est sa propre parente est le reliquat « À
 * classer », pas une sous-catégorie. C'est aussi la forme que prend une
 * catégorie **racine** sans enfant — d'où le décompte `subs`, qui seul
 * distingue les deux.
 */
const isReliquat = (row: BreakdownByCategories) =>
  row.categoryName === row.parentName;

function groupByParent(rows: BreakdownByCategories[]): Group[] {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const key = row.parentName ?? NO_CATEGORY_FILTER;
    let group = groups.get(key);
    if (!group) {
      group = {
        parent: {
          name: row.parentName ?? NO_CATEGORY,
          filter: row.parentName ?? NO_CATEGORY_FILTER,
          aClasser: false,
          total: 0,
          color: row.parentColor ?? FALLBACK_CATEGORY_COLOR,
          icon: row.parentIcon,
          budget: row.budgetParentAmount,
          subs: 0,
        },
        rows: [],
      };
      groups.set(key, group);
    }
    group.parent.total += row.total;
    if (!isReliquat(row)) group.parent.subs += 1;
    group.rows.push(row);
  }
  // La requête trie les lignes par montant décroissant, ce qui donne l'ordre des
  // sous-catégories ; les parents, eux, se retrient sur leur somme. L'ordre
  // n'est pas cosmétique : la nuance d'une sous-catégorie dérive de son rang.
  return [...groups.values()].sort((a, b) => b.parent.total - a.parent.total);
}

function subSlices(group: Group): BreakdownSlice[] {
  return group.rows.map((row) => ({
    name: isReliquat(row) ? A_CLASSER : (row.categoryName ?? NO_CATEGORY),
    // Le reliquat n'est pas une ligne de `categories` : aucune valeur de
    // `category` ne le sélectionne, il renvoie donc à sa parente.
    filter: row.categoryName ?? NO_CATEGORY_FILTER,
    aClasser: isReliquat(row),
    total: row.total,
    // La teinte propre d'une sous-catégorie n'existe pas : c'est un palier de
    // celle de sa parente, dérivé du rang au rendu (`shadeCategoryColor`).
    color: group.parent.color,
    icon: null,
    budget: row.budgetCatAmount,
    subs: 0,
  }));
}

/**
 * Le niveau que la revue affiche pour un filtre donné : les sous-catégories de
 * la parente désignée, ou tous les postes.
 *
 * Ce n'est pas `search.category` tel quel — surligner une **sous**-catégorie ne
 * change pas le niveau, et une parente sans sous-catégorie n'en ouvre aucun.
 * Un nom ne peut désigner qu'une parente *ou* une enfant (`categories.name` est
 * unique dans l'espace), l'ordre des deux recherches est donc indifférent.
 */
export function breakdownLevel(
  rows: BreakdownByCategories[],
  category: string | undefined,
): BreakdownLevel {
  const groups = groupByParent(rows);
  const expenses = groups.reduce((acc, g) => acc + g.parent.total, 0);
  const open =
    category === undefined
      ? undefined
      : groups.find(
          (g) =>
            g.parent.subs > 0 &&
            (g.parent.filter === category ||
              g.rows.some((row) => row.categoryName === category)),
        );

  return {
    parent: open?.parent ?? null,
    slices: open ? subSlices(open) : groups.map((g) => g.parent),
    total: open?.parent.total ?? expenses,
    expenses,
    postes: groups.length,
  };
}
