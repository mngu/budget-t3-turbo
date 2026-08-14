"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

import { useCategoryColor } from "~/lib/category-color";
import { useTRPC } from "~/lib/trpc";

export interface ParentCategory {
  /** Nom d'icône Lucide, `null` quand la parente n'en a pas encore choisi. */
  icon: string | null;
  /** Teinte déjà résolue au thème. */
  color: string;
  /**
   * Vrai quand la parente a des sous-catégories. C'est *la* condition qui fait
   * qu'une transaction posée sur elle est « à classer » : sur une parente sans
   * enfant, la même transaction est simplement classée (voir CLAUDE.md, et le
   * prédicat `aClasser` côté serveur, qui teste exactement ça).
   */
  hasChildren: boolean;
}

/**
 * Index nom de catégorie parente → identité (icône, couleur, feuilles).
 *
 * `transactions.list` ne remonte que le libellé, le chemin et la couleur : ni
 * l'icône ni le fait d'avoir des enfants n'en font partie, et les deux sont
 * nécessaires pour rendre une cellule de catégorie. L'arborescence est déjà
 * préchargée dans le cache react-query par les loaders des écrans de la revue,
 * donc pas de requête supplémentaire ici.
 */
export function useParentCategories(): Map<string, ParentCategory> {
  const trpc = useTRPC();
  const resolveColor = useCategoryColor();
  const { data: tree } = useQuery(trpc.categories.tree.queryOptions());

  return useMemo(
    () =>
      new Map(
        (tree ?? []).map((parent) => [
          parent.name,
          {
            icon: parent.icon,
            color: resolveColor(parent.color ?? FALLBACK_CATEGORY_COLOR),
            hasChildren: parent.children.length > 0,
          },
        ]),
      ),
    [tree, resolveColor],
  );
}
