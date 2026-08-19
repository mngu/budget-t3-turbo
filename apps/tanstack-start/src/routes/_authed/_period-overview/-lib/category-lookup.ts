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
}

/**
 * Index nom de catégorie parente → identité (icône, couleur, feuilles).
 *
 * `transactions.list` ne remonte que le libellé, le chemin et la couleur :
 * l'icône n'en fait pas partie, et elle est nécessaire pour rendre une cellule
 * de catégorie.
 *
 * `useQuery` et non `useSuspenseQuery` : ce hook sert des cellules de tableau,
 * qui ne doivent pas suspendre. Il **dépend donc du préchargement** de
 * `categories.tree` par le loader du layout `_period-overview` — sans lui, le
 * rendu serveur voit un cache vide et rend la pastille creuse de
 * `CategoryIcon`, là où le client, dont le cache déshydraté est rempli par la
 * requête suspensive de `CategoryPathPicker` (même clé), rend la vraie icône :
 * l'hydratation casse. Ne pas retirer ce préchargement.
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
          },
        ]),
      ),
    [tree, resolveColor],
  );
}
