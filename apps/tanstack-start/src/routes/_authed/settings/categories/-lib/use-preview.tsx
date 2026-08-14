import type { ReactNode } from "react";
import { useState } from "react";
import { TriangleAlertIcon } from "lucide-react";

import type { TxnForAnalysis } from "@budget/api";

import type { GhostBranch } from "./suggestions";
import { CategoryIcon } from "~/component/category-icon";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useTRPCClient } from "~/lib/trpc";
import { ghostTransactions } from "./suggestions";

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

// Sous-ensemble minimal commun à TxnForAnalysis (échantillon LLM) et
// TransactionRow (données réelles de la table transactions) — le drawer ne
// lit que ces champs, pas besoin de caster l'un ou l'autre.
//
// Les trois derniers sont optionnels parce que l'échantillon d'analyse ne les
// porte pas : `TxnForAnalysis` est sérialisé tel quel dans `buildAnalysisPrompt`
// (`JSON.stringify(txns)`), y ajouter une date pour la seule vitrine changerait
// un prompt calibré. La colonne de date disparaît alors au lieu de laisser une
// cellule vide, qui se lirait comme une ligne cassée.
export interface PreviewableTransaction {
  id: number;
  description: string;
  counterparty: string | null;
  bankName: string;
  amount: string | number;
  direction: "debit" | "credit";
  bookingDate?: string;
  /** Chemin affiché « Parent › Enfant », ou la feuille seule. */
  categoryPath?: string | null;
  category?: string | null;
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
