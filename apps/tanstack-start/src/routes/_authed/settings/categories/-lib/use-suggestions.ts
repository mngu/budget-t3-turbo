import { useState } from "react";

import type {
  CategoryOverviewNode,
  SuggestionsRun,
  TxnForAnalysis,
} from "@budget/api";
import { toast } from "@budget/ui/toast";

import type { GhostBranch } from "./suggestions";
import { useTRPCClient } from "~/lib/trpc";
import { deriveSuggestions } from "./suggestions";
import { useRun } from "./use-run";

/**
 * La proposition de l'analyse, telle que cet écran la retient — **en mémoire du
 * navigateur, nulle part ailleurs**. Le serveur ne garde rien : quitter la page
 * ou recharger la perd, et il suffit de relancer l'analyse. C'est assumé — elle
 * ne fait que proposer, rien n'est écrit en base tant qu'on n'a pas cliqué
 * « Ajouter ».
 *
 * Le seul ajout à ce que renvoie `generate` est l'horodatage : c'est le client
 * qui le pose, l'instant qui compte étant celui où *il* a reçu la proposition.
 */
interface Analysis extends SuggestionsRun {
  generatedAt: Date;
}

/**
 * Le panneau à afficher, ou `null`. Union discriminée plutôt qu'un booléen
 * `showReviewPanel` + une `analysis` nullable à côté : c'est elle qui porte
 * l'`analysis` non nulle jusqu'au rendu, sans `!` ni second test mort.
 */
/** Identité stable : `?? []` en ligne rendrait un tableau neuf à chaque rendu. */
const NO_SAMPLE: TxnForAnalysis[] = [];

export type SuggestionsPanel =
  | { kind: "wait" }
  | {
      kind: "review";
      generatedAt: Date;
      branchCount: number;
      touchedExistingParents: number;
      newParentCount: number;
    };

/**
 * L'analyse de catégories manquantes, de bout en bout : le run retenu côté
 * navigateur, les propositions croisées avec l'arbre réel, et l'acceptation
 * branche par branche.
 *
 * `tree` est un paramètre et non une lecture du loader : le hook vit dans
 * `-lib/`, lui faire appeler `Route.useLoaderData()` ferait un cycle
 * index → hook → index.
 */
export function useSuggestions(tree: CategoryOverviewNode[]) {
  const trpcClient = useTRPCClient();
  const run = useRun();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generating, setGenerating] = useState(false);
  const [panelClosed, setPanelClosed] = useState(false);
  // Le rejet d'une proposition n'a rien à écrire en base : la proposition
  // elle-même n'existe que dans cette page, et disparaît au prochain
  // « Lancer l'analyse ».
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());

  const suggestions = deriveSuggestions(
    analysis?.suggestions ?? [],
    tree,
    dismissed,
  );

  const panel: SuggestionsPanel | null = generating
    ? { kind: "wait" }
    : analysis !== null && !panelClosed && suggestions.branchCount > 0
      ? {
          kind: "review",
          generatedAt: analysis.generatedAt,
          branchCount: suggestions.branchCount,
          touchedExistingParents: suggestions.touchedExistingParents,
          newParentCount: suggestions.proposedParents.length,
        }
      : null;

  // Pas d'`invalidate` : l'analyse n'écrit rien, il n'y a rien à recharger.
  const generate = async () => {
    setGenerating(true);
    setPanelClosed(false);
    setDismissed(new Set());
    try {
      const result = await trpcClient.categories.suggestions.generate.mutate();
      setAnalysis({ ...result, generatedAt: new Date() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'analyse.");
    }
    setGenerating(false);
  };

  const acceptGhost = async (ghost: GhostBranch) => {
    setPending((s) => new Set(s).add(ghost.key));
    const result = await run(
      () =>
        trpcClient.categories.suggestions.accept.mutate({
          parent: ghost.parent,
          parentColor: ghost.parentColor,
          child: { name: ghost.name, txnIds: ghost.txnIds },
        }),
      "Échec de l'ajout de la catégorie.",
    );
    if (result) {
      toast.success(
        result.transactionsCategorized > 0
          ? `« ${ghost.name} » ajoutée — ${result.transactionsCategorized} transaction(s) rangée(s).`
          : `« ${ghost.name} » ajoutée. Aucune transaction rangée : elles ont toutes reçu une catégorie depuis l'analyse.`,
      );
    }
    setPending((s) => {
      const next = new Set(s);
      next.delete(ghost.key);
      return next;
    });
  };

  return {
    suggestions,
    pending,
    /**
     * L'échantillon analysé — la seule chose que l'aperçu d'une branche
     * proposée a besoin de connaître du run. Passé en argument à
     * `openGhost` plutôt qu'importé par `usePreview` : le contact entre les
     * deux reste à sens unique.
     */
    sample: analysis?.sample ?? NO_SAMPLE,
    panel,
    generate,
    acceptGhost,
    dismissGhost: (ghost: GhostBranch) =>
      setDismissed((s) => new Set(s).add(ghost.key)),
    closePanel: () => setPanelClosed(true),
  };
}
