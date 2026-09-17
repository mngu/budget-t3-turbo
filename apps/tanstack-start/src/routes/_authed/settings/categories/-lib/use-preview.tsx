import type { TransactionRow } from "@budget/api";
import type { ReactNode } from "react";

import { TagIcon } from "lucide-react";
import { useState } from "react";

import { CategoryIcon } from "~/component/category-icon";
import { useTRPCClient } from "~/lib/trpc";

/**
 * Ce que le panneau d'aperçu a besoin de savoir de la ligne cliquée : son nom,
 * mais aussi sa teinte et son icône — l'en-tête du panneau les reprend, et les
 * deux vont ensemble (une couleur sans icône y ferait une pastille creuse au
 * milieu d'un titre). Une sous-catégorie porte son palier de teinte et l'icône
 * de son parent, comme partout ailleurs.
 *
 * `soft` est fourni plutôt que dérivé de `color` : l'aplat de fond est toujours
 * celui de la **parente**, y compris pour une sous-catégorie, où `color` est
 * déjà un palier mélangé vers `--card`. Le repasser dans `softCategoryColor`
 * mélangerait deux fois et rendrait la pastille indiscernable de la carte.
 */
interface PreviewRequest {
  name: string;
  includesChildren: boolean;
  color: string;
  soft: string;
  icon: string | null;
}

/** Teinte + icône de ce que le panneau montre, reprises de la ligne cliquée. */
export interface PreviewBadge {
  color: string;
  soft: string;
  icon: ReactNode;
}

interface PreviewState {
  title: string;
  description: string;
  txns: TransactionRow[];
  badge: PreviewBadge;
}

// Une seule valeur pour la requête, les descriptions et le pied du tiroir :
// PAGE_SIZE (20) ne la fournit pas, et le texte annonçait 25 lignes pour 20.
export const PREVIEW_LIMIT = 25;

/** Le panneau d'aperçu : les transactions d'une catégorie, les plus récentes. */
export function usePreview() {
  const trpcClient = useTRPCClient();
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const openCategory = async ({
    name,
    includesChildren,
    color,
    soft,
    icon,
  }: PreviewRequest) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: name,
      limit: PREVIEW_LIMIT,
    });
    setPreview({
      title: name,
      description: `${result.rows.length} transaction(s) — aperçu de cette catégorie (${PREVIEW_LIMIT} plus récentes)${includesChildren ? ", y compris les sous-catégories" : ""}.`,
      txns: result.rows,
      badge: {
        color,
        soft,
        icon: <CategoryIcon name={icon} className="size-3.5" />,
      },
    });
  };

  // Le poste des transactions qu'aucune catégorie ne range : la sentinelle
  // `none` de `transactions.list`, en teinte d'alerte comme les lignes sans
  // catégorie du tiroir.
  const openUncategorized = async (count: number) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: "none",
      limit: PREVIEW_LIMIT,
    });
    setPreview({
      title: "Sans catégorie",
      description: `${count} transaction(s) sans catégorie, les ${PREVIEW_LIMIT} plus récentes.`,
      txns: result.rows,
      badge: {
        color: "var(--warn)",
        soft: "var(--warn-soft)",
        icon: <TagIcon className="size-3.5" />,
      },
    });
  };

  return {
    preview,
    close: () => setPreview(null),
    openCategory,
    openUncategorized,
  };
}
