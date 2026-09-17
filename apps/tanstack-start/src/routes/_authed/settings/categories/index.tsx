import type { ManagedCategory } from "@budget/api/schemas";

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";

import { isManagedCategory, NO_CATEGORY_NAME } from "@budget/api/schemas";
import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";
import { Stat } from "~/component/stat";
import { sumBy } from "~/lib/sum";
import { useTRPCClient } from "~/lib/trpc";
import { useFormat } from "~/lib/use-format";

import { CategoryOverview } from "./-components/category-overview";
import { TransactionPreviewDrawer } from "./-components/transaction-preview-drawer";
import { usePreview } from "./-lib/use-preview";

export const Route = createFileRoute("/_authed/settings/categories/")({
  // Sans dates : les compteurs décrivent tout l'espace, pas un mois.
  loader: async ({ context }) => {
    const all = await context.trpcClient.categories.overview.query();
    // Le poste des transactions sans catégorie appartient à la revue, pas aux
    // réglages : cet écran ne montre que ce qui se gère. Son compteur, lui,
    // dit ce qu'il reste à catégoriser.
    const overview = all.filter(isManagedCategory);
    const uncategorizedCount =
      all.find((c) => c.name === NO_CATEGORY_NAME)?.transactionCount ?? 0;
    const stats = computeStats(overview);
    return { overview, stats, uncategorizedCount };
  },
  staticData: { title: "Catégories", aside: CategoriesAside },
  component: CategoriesPage,
});

function CategoriesAside() {
  const { euro } = useFormat();
  const { overview } = Route.useLoaderData();
  const childCount = sumBy(overview, (cat) => cat.children?.length ?? 0);
  const totalBudget = sumBy(
    overview,
    (cat) =>
      (cat.budgetAmount ?? 0) +
      sumBy(cat.children ?? [], (child) => child.budgetAmount ?? 0),
  );
  return (
    <div className="ml-auto flex items-stretch">
      <Stat value={overview.length} label="Parentes" />
      <Stat value={childCount} label="Sous-catégories" />
      <Stat value={euro.format(totalBudget)} label="Budgété / mois" />
    </div>
  );
}

function CategoriesPage() {
  const { overview, stats, uncategorizedCount } = Route.useLoaderData();

  return (
    <>
      {uncategorizedCount > 0 && (
        <UncategorizedBanner count={uncategorizedCount} />
      )}
      <CategoryOverview categoryOverview={overview} stats={stats} />
    </>
  );
}

function UncategorizedBanner({ count }: { count: number }) {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const preview = usePreview();

  const categorize = async () => {
    setRunning(true);
    try {
      const { categorized, remaining } =
        await trpcClient.categories.categorize.mutate();
      if (remaining === 0) toast.success("Tout est catégorisé.");
      else if (categorized === 0)
        toast.warning(
          `Aucune catégorie existante ne convient aux ${remaining} restante(s).`,
        );
      else
        toast.success(
          `${categorized} catégorisée(s), ${remaining} restante(s).`,
        );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la catégorisation.",
      );
    } finally {
      // Même en échec : la similarité a déjà écrit ce qu'elle a trouvé.
      await router.invalidate();
      setRunning(false);
    }
  };

  return (
    <div className="border-border-strong bg-surface-2 mb-5 flex flex-wrap items-center gap-4 rounded-lg border px-5 py-4">
      <span className="bg-card border-border-strong text-primary flex size-8 flex-none items-center justify-center rounded-md border">
        <SparklesIcon className="size-4" />
      </span>
      <div className="min-w-70 flex-1">
        <div className="text-body font-semibold tracking-[-0.015em]">
          <span className="num">{count.toLocaleString("fr-FR")}</span>{" "}
          transaction{count > 1 ? "s" : ""} sans catégorie
        </div>
        <div className="text-muted-foreground text-control mt-1 max-w-165 text-pretty">
          Les lignes que rien ne décrit restent sans catégorie : créez la
          catégorie manquante, puis relancez.
        </div>
      </div>
      <div className="flex flex-none gap-2">
        <Button
          variant="outline"
          onClick={() => preview.openUncategorized(count)}
        >
          Voir
        </Button>
        <Button disabled={running} onClick={categorize}>
          {running ? "Catégorisation…" : "Catégoriser"}
        </Button>
      </div>
      <TransactionPreviewDrawer
        open={preview.preview !== null}
        onOpenChange={(open) => !open && preview.close()}
        title={preview.preview?.title ?? ""}
        description={preview.preview?.description}
        transactions={preview.preview?.txns ?? []}
        badge={preview.preview?.badge}
      />
    </div>
  );
}

// Compteurs de l'en-tête et données dérivées du choix de teinte. « Teintes
// prises » compte les teintes *distinctes* : à 13 teintes pour un nombre
// illimité de parentes, la collision est un état normal — signalée, jamais
// interdite (voir CategoryIdentityDialog).
export function computeStats(tree: ManagedCategory[]) {
  const ownersByColor = new Map<string, string[]>();
  const usageByIcon = new Map<string, number>();

  for (const parent of tree) {
    if (parent.color) {
      ownersByColor.set(parent.color, [
        ...(ownersByColor.get(parent.color) ?? []),
        parent.name,
      ]);
    }
    if (parent.icon) {
      usageByIcon.set(parent.icon, (usageByIcon.get(parent.icon) ?? 0) + 1);
    }
  }

  return {
    ownersByColor,
    usageByIcon,
  };
}
