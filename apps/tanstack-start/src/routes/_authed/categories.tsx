import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import type { CategorySuggestion, TxnForAnalysis } from "@budget/api";
import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";
import { toast } from "@budget/ui/toast";

import type { EditableParent } from "~/component/category-tree";
import { CategoryOverviewTree } from "~/component/category-overview-tree";
import { CategoryTree, newEditableId } from "~/component/category-tree";
import { TransactionPreviewDrawer } from "~/component/transaction-preview-drawer";
import { useTRPCClient } from "~/lib/trpc";

export const Route = createFileRoute("/_authed/categories")({
  loader: async ({ context }) => {
    const [status, overview] = await Promise.all([
      context.trpcClient.categories.suggestions.status.query(),
      context.trpcClient.categories.overview.query(),
    ]);
    return { status, overview };
  },
  component: CategoriesPage,
});

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

interface ReadyStatus {
  suggestions: CategorySuggestion[];
  sample: TxnForAnalysis[];
  generatedAt: Date;
  newTransactionsCount: number;
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

function CategoriesPage() {
  const { status, overview } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      await trpcClient.categories.suggestions.generate.mutate();
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de l'analyse LLM.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const ready: ReadyStatus | null =
    status.exists && status.suggestions && status.sample && status.generatedAt
      ? {
          suggestions: status.suggestions,
          sample: status.sample,
          generatedAt: status.generatedAt,
          newTransactionsCount: status.newTransactionsCount,
        }
      : null;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-8">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Retour aux transactions"
          render={
            <Link to="/" search={{ page: 1, sort: "date", order: "desc" }} />
          }
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="text-2xl font-bold">🏷️ Catégories</h1>
      </div>

      {overview.uncategorizedCount > 0 ? (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {overview.uncategorizedCount} transaction(s) sans catégorie.
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          Toutes les transactions sont catégorisées.
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={generate} disabled={generating}>
          <SparklesIcon />
          Suggérer des catégories
        </Button>
      </div>

      {generating && (
        <div className="text-muted-foreground flex flex-col items-center gap-3 py-8">
          <Loader2Icon className="size-6 animate-spin" />
          <p>Analyse en cours... (peut prendre une minute)</p>
        </div>
      )}

      {!generating && ready && <SuggestionsWorkspace data={ready} />}

      <CategoryOverviewTree tree={overview.tree} />
    </main>
  );
}

function SuggestionsWorkspace({ data }: { data: ReadyStatus }) {
  const trpcClient = useTRPCClient();
  const navigate = Route.useNavigate();
  const [tree, setTree] = useState<EditableParent[]>(() =>
    toEditable(data.suggestions),
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<{
    title: string;
    txns: TxnForAnalysis[];
  } | null>(null);

  const sampleById = useMemo(() => {
    const map = new Map<number, TxnForAnalysis>();
    for (const txn of data.sample) map.set(txn.id, txn);
    return map;
  }, [data.sample]);

  const payload = useMemo<CategorySuggestion[]>(
    () =>
      tree
        .map((p) => ({
          parent: p.name.trim(),
          enfants: p.children
            .filter((c) => c.enabled && c.name.trim().length > 0)
            .map((c) => ({ name: c.name.trim(), txnIds: c.txnIds })),
        }))
        .filter((p) => p.parent.length > 0 && p.enfants.length > 0),
    [tree],
  );

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
      });
      toast.success(
        `${result.categoriesCreated} catégorie(s) créée(s) — recatégorisation en cours.`,
      );
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

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Analyse de {data.sample.length} transactions · générée le{" "}
          {dateTimeFr.format(data.generatedAt)}
        </p>
        <Button
          size="sm"
          disabled={payload.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Appliquer
        </Button>
      </div>

      {data.newTransactionsCount > 0 && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {data.newTransactionsCount} nouvelle(s) transaction(s) arrivée(s)
          depuis cette analyse — les résultats peuvent être obsolètes.
        </div>
      )}

      <CategoryTree parents={tree} onChange={setTree} onPreview={openPreview} />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer ces catégories ?</DialogTitle>
            <DialogDescription>
              {payload.length} catégorie(s) parente(s) et{" "}
              {payload.reduce((n, p) => n + p.enfants.length, 0)}{" "}
              sous-catégorie(s) seront créées. Les transactions catégorisées
              automatiquement seront reclassées dans cette nouvelle
              arborescence.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={apply} disabled={applying}>
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
