import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { TxnForAnalysis } from "@budget/api";

import type { PreviewRequest } from "../-components/category-overview-tree";
import type {
  PreviewableTransaction,
  PreviewBadge,
} from "../-components/transaction-preview-drawer";
import type { GhostBranch } from "./suggestions";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useTRPCClient } from "~/lib/trpc";
import { CategoryIcon } from "../-components/category-icon";
import { ghostTransactions } from "./suggestions";

export interface PreviewState {
  title: string;
  description: string;
  txns: PreviewableTransaction[];
  badge: PreviewBadge;
  footer: string;
}

const PREVIEW_FOOTER = "Aperçu limité aux 25 transactions les plus récentes.";

/**
 * Le panneau d'aperçu et ses trois entrées : une catégorie existante, les
 * transactions sans catégorie, une branche proposée. Elles ne partagent que
 * leur destination — d'où un hook plutôt que trois helpers, dont l'un devait
 * jusqu'ici recevoir `setPreview` en paramètre.
 */
export function usePreview() {
  const trpcClient = useTRPCClient();
  const resolveColor = useCategoryColor();
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

  const openUncategorized = async (total: number) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      internes: "toutes",
      category: "none",
    });
    setPreview({
      title: "Sans catégorie",
      description: `${total} transaction(s) qu'aucune branche ne décrit — aperçu des ${result.rows.length} plus récentes.`,
      txns: result.rows,
      // Pas de catégorie, donc pas de teinte : c'est le seul aperçu qui porte
      // l'avertissement plutôt qu'une famille de couleur.
      badge: {
        color: "var(--warn)",
        soft: "var(--warn-soft)",
        icon: <TriangleAlertIcon className="size-3.5" />,
      },
      footer: "Une transaction sans catégorie signale une branche manquante.",
    });
  };

  const openGhost = (ghost: GhostBranch, sample: TxnForAnalysis[]) => {
    const color = resolveColor(ghost.parentColor);
    setPreview({
      title: `${ghost.parent} › ${ghost.name}`,
      description: `${ghost.txnIds.length} transaction(s) sans catégorie qui se ressemblent — aperçu.`,
      txns: ghostTransactions(ghost, sample),
      // Une branche proposée n'a pas encore d'icône : la pastille creuse dans
      // la teinte de sa parente est exactement l'état « aucune icône choisie ».
      badge: categoryBadge(color, softCategoryColor(color), null),
      footer: "Proposition : elles seraient rangées ici.",
    });
  };

  return {
    preview,
    close: () => setPreview(null),
    openCategory,
    openUncategorized,
    openGhost,
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
