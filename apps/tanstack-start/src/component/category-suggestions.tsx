import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";

import type {
  CategorySuggestion,
  ReplacePlan,
  TxnForAnalysis,
} from "@budget/api";
import { Button } from "@budget/ui/button";
import { ButtonGroup } from "@budget/ui/button-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";
import { toast } from "@budget/ui/toast";

import type { EditableParent } from "./category-tree";
import { useTRPCClient } from "~/lib/trpc";
import { Route } from "~/routes/_authed/categories";
import { CategoryTree, newEditableId } from "./category-tree";
import { TransactionPreviewDrawer } from "./transaction-preview-drawer";

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

export interface ReadyStatus {
  suggestions: CategorySuggestion[];
  sample: TxnForAnalysis[];
  generatedAt: Date;
  newTransactionsCount: number;
}

type ApplyMode = "merge" | "replace";

export function SuggestionsWorkspace({ data }: { data: ReadyStatus }) {
  const trpcClient = useTRPCClient();
  const navigate = Route.useNavigate();
  const [tree, setTree] = useState<EditableParent[]>(() =>
    toEditable(data.suggestions),
  );
  const [mode, setMode] = useState<ApplyMode>("merge");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [replacePreview, setReplacePreview] = useState<ReplacePlan | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    txns: TxnForAnalysis[];
  } | null>(null);

  const sampleById = new Map(data.sample.map((txn) => [txn.id, txn]));

  const payload: CategorySuggestion[] = tree
    .map((p) => ({
      parent: p.name.trim(),
      enfants: p.children
        .filter((c) => c.enabled && c.name.trim().length > 0)
        .map((c) => ({ name: c.name.trim(), txnIds: c.txnIds })),
    }))
    .filter((p) => p.parent.length > 0 && p.enfants.length > 0);

  // L'aperçu du mode "replace" vient toujours du serveur (previewReplace,
  // même fonction computeReplacePlan que l'apply réel) — jamais recalculé
  // ici, pour ne jamais afficher un diff qui pourrait diverger de ce qui
  // sera réellement exécuté. Ne se déclenche qu'à l'ouverture de la dialog,
  // pas à chaque frappe pendant l'édition de l'arbre.
  useEffect(() => {
    if (mode !== "replace" || !confirmOpen) {
      setReplacePreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    trpcClient.categories.suggestions.previewReplace
      .query({ suggestions: payload })
      .then((plan) => {
        if (!cancelled) setReplacePreview(plan);
      })
      .catch(() => {
        if (!cancelled) setReplacePreview(null);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- payload est recalculé à chaque rendu, comparer par contenu suffit ici (petit nombre de catégories)
  }, [mode, confirmOpen, JSON.stringify(payload), trpcClient]);

  const openPreview = (title: string, txnIds: number[]) => {
    const txns = txnIds
      .map((id) => sampleById.get(id))
      .filter((t): t is TxnForAnalysis => t !== undefined);
    setPreview({ title, txns });
  };

  const apply = async () => {
    setApplying(true);
    try {
      const result = await trpcClient.categories.suggestions.apply.mutate({
        suggestions: payload,
        mode,
      });
      const summary =
        mode === "replace"
          ? `${result.categoriesCreated} créée(s), ${result.categoriesReused} réutilisée(s), ${result.categoriesDeleted} supprimée(s) — recatégorisation en cours.`
          : `${result.categoriesCreated} catégorie(s) créée(s) — recatégorisation en cours.`;
      toast.success(summary);
      setConfirmOpen(false);
      await navigate({
        to: "/",
        search: { page: 1, sort: "date", order: "desc" },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'application.",
      );
    } finally {
      setApplying(false);
    }
  };

  const confirmDisabled =
    applying || (mode === "replace" && (previewLoading || !replacePreview));

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Analyse de {data.sample.length} transactions · générée le{" "}
          {dateTimeFr.format(data.generatedAt)}
        </p>
        <div className="flex items-center gap-2">
          <ButtonGroup>
            <Button
              type="button"
              variant={mode === "merge" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode("merge")}
            >
              Fusionner
            </Button>
            <Button
              type="button"
              variant={mode === "replace" ? "destructive" : "outline"}
              size="sm"
              onClick={() => setMode("replace")}
            >
              Remplacer
            </Button>
          </ButtonGroup>
          <Button
            size="sm"
            variant={mode === "replace" ? "destructive" : "default"}
            disabled={payload.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            {mode === "replace" ? "Remplacer" : "Appliquer"}
          </Button>
        </div>
      </div>

      {data.newTransactionsCount > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {data.newTransactionsCount} nouvelle(s) transaction(s) arrivée(s)
          depuis cette analyse — les résultats peuvent être obsolètes.
        </div>
      )}

      {mode === "replace" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Mode remplacement : les catégories existantes absentes de cette
          sélection seront supprimées, sauf celles contenant des corrections
          manuelles.
        </div>
      )}

      <CategoryTree parents={tree} onChange={setTree} onPreview={openPreview} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "replace"
                ? "Remplacer les catégories existantes ?"
                : "Appliquer ces catégories ?"}
            </DialogTitle>
            <DialogDescription>
              {payload.length} catégorie(s) parente(s) et{" "}
              {payload.reduce((n, p) => n + p.enfants.length, 0)}{" "}
              sous-catégorie(s) seront{" "}
              {mode === "replace" ? "créées ou réutilisées" : "créées"}. Les
              transactions catégorisées automatiquement seront reclassées
              dans cette nouvelle arborescence.
              {mode === "replace" && previewLoading && (
                <> Calcul de l'impact en cours…</>
              )}
              {mode === "replace" && replacePreview && (
                <>
                  {replacePreview.namesToDelete.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.namesToDelete.length} catégorie(s)
                      existante(s) seront supprimées :{" "}
                      {replacePreview.namesToDelete.join(", ")}.
                    </>
                  )}
                  {replacePreview.namesKept.length > 0 && (
                    <>
                      {" "}
                      {replacePreview.namesKept.length} catégorie(s) seront
                      conservées malgré tout car elles contiennent des
                      corrections manuelles : {replacePreview.namesKept.join(", ")}.
                    </>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              onClick={apply}
              disabled={confirmDisabled}
            >
              {applying && <Loader2Icon className="animate-spin" />}
              Confirmer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionPreviewDrawer
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        transactions={preview?.txns ?? []}
      />
    </div>
  );
}

function toEditable(suggestions: CategorySuggestion[]): EditableParent[] {
  return suggestions.map((s) => ({
    id: newEditableId(),
    name: s.parent,
    children: s.enfants.map((e) => ({
      id: newEditableId(),
      name: e.name,
      txnIds: e.txnIds,
      enabled: true,
    })),
  }));
}
