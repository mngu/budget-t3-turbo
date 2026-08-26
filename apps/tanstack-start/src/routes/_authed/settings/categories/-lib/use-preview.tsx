import type { ReactNode } from "react";
import { useState } from "react";

import type { TransactionRow } from "@budget/api";

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
export interface PreviewRequest {
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

export interface PreviewState {
  title: string;
  description: string;
  txns: TransactionRow[];
  badge: PreviewBadge;
  footer: string;
}

const PREVIEW_FOOTER = "Aperçu limité aux 25 transactions les plus récentes.";

/** Le panneau d'aperçu : les transactions d'une catégorie, les 25 plus récentes. */
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
      internes: "toutes",
      category: name,
    });
    setPreview({
      title: name,
      description: `${result.rows.length} transaction(s) — aperçu de cette catégorie (25 plus récentes)${includesChildren ? ", y compris les sous-catégories" : ""}.`,
      txns: result.rows,
      badge: categoryBadge(color, soft, icon),
      footer: PREVIEW_FOOTER,
    });
  };

  return {
    preview,
    close: () => setPreview(null),
    openCategory,
  };
}

// Pastille d'en-tête du panneau d'aperçu : la teinte et l'aplat déjà résolus
// pour le thème par l'appelant (l'aplat est celui de la parente, jamais dérivé
// d'un palier de sous-catégorie — voir PreviewRequest), et l'icône de la
// catégorie, creuse si elle n'en a pas.
function categoryBadge(
  color: string,
  soft: string,
  icon: string | null,
): PreviewBadge {
  return {
    color,
    soft,
    icon: <CategoryIcon name={icon} className="size-3.5" />,
  };
}
