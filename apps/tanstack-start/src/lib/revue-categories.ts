import type { Delta } from "~/lib/history";

/**
 * Un poste de sortie de la revue, tel que le loader du layout `_revue` le
 * construit et que l'anneau, la colonne et le bandeau le manipulent.
 *
 * Ici et non dans un composant : le layout (donc `/transactions`) en a besoin
 * comme **valeur** pour `focusedCategory`, et un module sans composant lui
 * évite de tirer l'anneau qu'il ne rend jamais.
 */
export interface RevueCategory {
  /** Libellé affiché — « Sans catégorie » pour le groupe sans rattachement. */
  name: string;
  /**
   * Valeur à poser dans le search param `category` pour désigner ce poste :
   * le libellé affiché n'en tient pas lieu, le groupe sans rattachement se
   * filtrant par la sentinelle `"none"` (voir `categoryFilterLabel`).
   */
  filter: string;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide de `categories.icon`, `null` si aucune n'est choisie. */
  icon: string | null;
  /**
   * Sous-catégories, déjà triées du plus gros au plus petit, « À classer »
   * compris — c'est l'ordre que `transactions.byCategory` garantit, et dont les
   * nuances de la teinte parente dérivent.
   *
   * `filter: null` désigne le segment « À classer », que `byCategory` fabrique
   * (le reliquat porté par la parente elle-même) et qui n'est **pas** une ligne
   * de `categories` : aucune valeur de `category` ne le sélectionne, le poser
   * dans l'URL donnerait un filtre sans résultat.
   *
   * Vide = le poste n'a rien au niveau du dessous : l'anneau n'y descend pas
   * (voir `RevuePanel`).
   */
  subs: { name: string; total: number; filter: string | null }[];
  delta: Delta | null;
}

/**
 * Le poste que désigne le search param : la parente filtrée, ou celle qui
 * possède la sous-catégorie filtrée. **Seule** définition du poste ouvert de la
 * revue — le fil d'ariane et l'anneau sur `/`, `KpiFocus` dans le layout — et
 * c'est ce qui les empêche de se contredire.
 *
 * Un nom de catégorie ne peut désigner qu'une parente *ou* une enfant
 * (`categories.name` est unique sur toute la table), l'ordre des deux
 * recherches est donc indifférent.
 */
export function focusedCategory(
  categories: RevueCategory[],
  category: string | undefined,
) {
  if (category === undefined) return null;
  return (
    categories.find((c) => c.filter === category) ??
    categories.find((c) => c.subs.some((s) => s.filter === category)) ??
    null
  );
}
