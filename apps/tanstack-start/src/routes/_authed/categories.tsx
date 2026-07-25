import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";

import type { ReadyStatus } from "~/component/category-suggestions";
import type { PreviewableTransaction } from "~/component/transaction-preview-drawer";
import { CategoryOverviewTree } from "~/component/category-overview-tree";
import { SuggestionsWorkspace } from "~/component/category-suggestions";
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

function CategoriesPage() {
  const { status, overview } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [generating, setGenerating] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [uncategorizedPreview, setUncategorizedPreview] = useState<
    PreviewableTransaction[] | null
  >(null);

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

  const categorize = async () => {
    setCategorizing(true);
    try {
      const result = await trpcClient.categories.categorize.mutate();
      await router.invalidate();
      toast.success(
        result.remaining > 0
          ? `${result.categorized} transaction(s) catégorisée(s), ${result.remaining} restante(s).`
          : `${result.categorized} transaction(s) catégorisée(s) — tout est catégorisé.`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la catégorisation.",
      );
    } finally {
      setCategorizing(false);
    }
  };

  const openUncategorizedPreview = async () => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: "none",
    });
    setUncategorizedPreview(result.rows);
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
        <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <button
            type="button"
            className="text-left hover:underline"
            onClick={openUncategorizedPreview}
          >
            {overview.uncategorizedCount} transaction(s) sans catégorie.
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={categorize}
            disabled={categorizing}
          >
            {categorizing && <Loader2Icon className="animate-spin" />}
            Catégoriser
          </Button>
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

      <TransactionPreviewDrawer
        open={uncategorizedPreview !== null}
        onOpenChange={(open) => !open && setUncategorizedPreview(null)}
        title="Transactions sans catégorie"
        transactions={uncategorizedPreview ?? []}
        description={
          uncategorizedPreview
            ? `${overview.uncategorizedCount} transaction(s) sans catégorie${overview.uncategorizedCount > uncategorizedPreview.length ? ` (${uncategorizedPreview.length} plus récentes)` : ""}.`
            : undefined
        }
      />
    </main>
  );
}
