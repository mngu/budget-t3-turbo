import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import type { CategoryOverviewNode } from "@budget/api";
import { Button } from "@budget/ui/button";
import { toast } from "@budget/ui/toast";

import { Stat } from "~/component/stat";
import { euro0 } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";
import { AnalysisBanner } from "./-components/analysis-banner";
import { CategoryDeleteDialog } from "./-components/category-delete-dialog";
import { CategoryIdentityDialog } from "./-components/category-identity-dialog";
import { CategoryOverviewTree } from "./-components/category-overview-tree";
import {
  SuggestionsReviewPanel,
  SuggestionsWaitPanel,
} from "./-components/suggestions-panel";
import { TransactionPreviewDrawer } from "./-components/transaction-preview-drawer";
import { useCategoryCrud } from "./-lib/use-category-crud";
import { usePreview } from "./-lib/use-preview";
import { useRun } from "./-lib/use-run";
import { useSuggestions } from "./-lib/use-suggestions";

export const Route = createFileRoute("/_authed/settings/categories/")({
  loader: async ({ context }) => {
    const [{ tree, uncategorizedCount }, budgets] = await Promise.all([
      context.trpcClient.categories.overview.query(),
      context.trpcClient.categories.budgets.plan.query(),
    ]);
    const stats = computeStats(tree);
    return { tree, uncategorizedCount, stats, budgets };
  },
  staticData: { title: "Catégories", aside: CategoriesAside },
  component: CategoriesPage,
});

function CategoriesAside() {
  const { stats, budgets } = Route.useLoaderData();
  return (
    <div className="ml-auto flex items-stretch">
      <Stat value={stats.parentCount} label="Parentes" />
      <Stat value={stats.childCount} label="Sous-catégories" />
      <Stat value={euro0.format(budgets.total)} label="Budgété / mois" />
      {/* Un seul compteur de budgets : « N / M » porte aussi le nombre de
          postes sans budget. Pas d'ambre dessus — « tout est budgété » est un
          état que personne n'atteint (les catégories de revenus n'ont pas de
          budget), le signal serait allumé pour toujours. Le compteur des
          teintes a laissé la place : une collision est déjà annoncée en toutes
          lettres dans la rangée « Vos catégories ». */}
      <Stat
        value={`${budgets.budgeted} / ${budgets.slots}`}
        label="Postes budgétés"
      />
    </div>
  );
}

function CategoriesPage() {
  const { tree, uncategorizedCount, stats, budgets } = Route.useLoaderData();
  const trpcClient = useTRPCClient();
  const run = useRun();

  // Gestion courante (créer, renommer, supprimer, identité) — sans LLM.
  const crud = useCategoryCrud();
  // Analyse des catégories manquantes — le run vit dans le navigateur.
  const analysis = useSuggestions(tree);
  const preview = usePreview();

  const [expandAll, setExpandAll] = useState<boolean | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  // Catégorisation LLM avec l'arbre **existant** : voisine de l'analyse par le
  // bouton qui la porte, mais rien à voir par ce qu'elle fait — elle n'invente
  // aucune catégorie. Un booléen et quinze lignes, elle n'a pas de hook.
  const categorize = async () => {
    setCategorizing(true);
    const result = await run(
      () => trpcClient.categories.categorize.mutate(),
      "Échec de la catégorisation.",
    );
    if (result) {
      toast.success(
        result.remaining > 0
          ? `${result.categorized} transaction(s) catégorisée(s), ${result.remaining} restante(s) — aucune de vos catégories ne les décrit.`
          : `${result.categorized} transaction(s) catégorisée(s) — tout est catégorisé.`,
      );
    }
    setCategorizing(false);
  };

  return (
    <>
      <p className="text-muted-foreground text-control mt-2 max-w-160 text-pretty">
        Les catégories qui rangent toutes vos transactions, et le budget mensuel
        de chacune. La couleur et l'icône d'une catégorie principale
        l'identifient partout ailleurs — elles se choisissent ici, et nulle part
        ailleurs.
      </p>

      {analysis.panel === null && (
        <AnalysisBanner
          uncategorizedCount={uncategorizedCount}
          categorizing={categorizing}
          onCategorize={categorize}
          onAnalyze={analysis.generate}
          onPreviewUncategorized={() =>
            void preview.openUncategorized(uncategorizedCount)
          }
        />
      )}

      {analysis.panel?.kind === "wait" && (
        <SuggestionsWaitPanel onClose={analysis.closePanel} />
      )}

      {analysis.panel?.kind === "review" && (
        <SuggestionsReviewPanel
          generatedAt={analysis.panel.generatedAt}
          branchCount={analysis.panel.branchCount}
          touchedExistingParents={analysis.panel.touchedExistingParents}
          newParentCount={analysis.panel.newParentCount}
          onClose={analysis.closePanel}
        />
      )}

      <div className="mt-7 mb-3 flex flex-wrap items-center gap-2.5">
        <h2 className="text-heading">Vos catégories</h2>
        <span className="text-subtle text-control">
          {/* Les décomptes vivent dans le bloc de compteurs en haut de
              page : ne reste ici que ce que ceux-ci ne disent pas. */}
          {tree.length === 0
            ? "aucune catégorie pour le moment"
            : "le compteur d'une parente ne compte que ses transactions directes"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {stats.collisions > 0 && (
            <span className="text-warn text-control">
              {stats.collisions} collision
              {stats.collisions > 1 ? "s" : ""} de teinte
              {stats.withoutColor > 0 &&
                ` · ${stats.withoutColor} sans couleur`}{" "}
              — l'icône fait la différence
            </span>
          )}
          {tree.length > 0 && (
            <Button
              variant="outline"
              size="xs"
              onClick={() => setExpandAll((v) => v !== true)}
            >
              Tout replier / déplier
            </Button>
          )}
          {budgets.budgeted > 0 && (
            <Button
              variant="outline"
              size="xs"
              onClick={() =>
                void run(
                  () => trpcClient.categories.budgets.clear.mutate(),
                  "Échec de la remise à zéro.",
                )
              }
            >
              Tout vider les budgets
            </Button>
          )}
        </div>
      </div>

      <CategoryOverviewTree
        tree={tree}
        ghostsByParentId={analysis.suggestions.ghostsByParentId}
        proposedParents={analysis.suggestions.proposedParents}
        uncategorizedCount={uncategorizedCount}
        ownersByColor={stats.ownersByColor}
        pendingGhosts={analysis.pending}
        budgetRows={new Map(budgets.rows.map((r) => [r.categoryId, r]))}
        onSetAmount={(categoryId, amount) =>
          void run(
            () =>
              trpcClient.categories.budgets.set.mutate({ categoryId, amount }),
            "Échec de l'enregistrement du budget.",
          )
        }
        onSetDetailed={(categoryId, detailed) =>
          void run(
            () =>
              trpcClient.categories.budgets.setDetailed.mutate({
                categoryId,
                detailed,
              }),
            "Échec du changement de régime de budget.",
          )
        }
        expandAllSignal={expandAll}
        onAnalyze={analysis.generate}
        onRename={crud.onRename}
        onOpenIdentity={crud.onOpenIdentity}
        onDelete={crud.onDelete}
        onAddChild={crud.onAddChild}
        onAddParent={crud.onAddParent}
        onPreview={(request) => void preview.openCategory(request)}
        onAcceptGhost={analysis.acceptGhost}
        onDismissGhost={analysis.dismissGhost}
        onPreviewGhost={(ghost) => preview.openGhost(ghost, analysis.sample)}
      />

      <p className="text-subtle text-control mt-3.5 max-w-205 text-pretty">
        La couleur sert là où il n'y a pas de place — segments de barre, points,
        tuiles compactes. L'icône sert partout où il y a au moins 20 px :
        listes, sélecteurs, en-têtes de catégorie. Les sous-catégories n'ont ni
        l'une ni l'autre en propre : elles se lisent comme une famille de la
        teinte du parent. Un budget se pose sur une catégorie, parente ou
        sous-catégorie, et n'est pas reporté au mois suivant : la moyenne
        proposée porte sur les 6 derniers mois complets, dépenses seules, et une
        catégorie vue moins de 4 mois sur 6 n'en reçoit pas.
      </p>

      <CategoryIdentityDialog
        target={crud.identityTarget}
        onOpenChange={(open) => !open && crud.closeIdentity()}
        ownersByColor={stats.ownersByColor}
        usageByIcon={stats.usageByIcon}
        onColorChange={crud.changeColor}
        onIconChange={crud.changeIcon}
      />

      <CategoryDeleteDialog
        target={crud.deleteTarget}
        deleting={crud.deleting}
        onOpenChange={(open) => !open && crud.closeDelete()}
        onConfirm={() => void crud.confirmDelete()}
      />

      <TransactionPreviewDrawer
        open={preview.preview !== null}
        onOpenChange={(open) => !open && preview.close()}
        title={preview.preview?.title ?? ""}
        description={preview.preview?.description}
        transactions={preview.preview?.txns ?? []}
        badge={preview.preview?.badge}
        footer={preview.preview?.footer}
      />
    </>
  );
}

// Compteurs de l'en-tête et données dérivées du choix de teinte. « Teintes
// prises » compte les teintes *distinctes* : à 13 teintes pour un nombre
// illimité de parentes, la collision est un état normal — signalée, jamais
// interdite (voir CategoryIdentityDialog).
function computeStats(tree: CategoryOverviewNode[]) {
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
    parentCount: tree.length,
    childCount: tree.reduce((n, p) => n + p.children.length, 0),
    colorsUsed: ownersByColor.size,
    collisions: [...ownersByColor.values()].filter((o) => o.length > 1).length,
    withoutColor: tree.filter((p) => !p.color).length,
    ownersByColor,
    usageByIcon,
  };
}
