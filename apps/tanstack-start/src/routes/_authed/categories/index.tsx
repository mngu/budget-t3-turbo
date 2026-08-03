import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  CircleCheckIcon,
  Loader2Icon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react";

import type { CategoryOverviewNode } from "@budget/api";
import { CATEGORY_COLOR_PALETTE } from "@budget/shared";
import { toast } from "@budget/ui/toast";

import type { DeleteTarget } from "./-components/category-delete-dialog";
import type { IdentityTarget } from "./-components/category-identity-dialog";
import type { PreviewRequest } from "./-components/category-overview-tree";
import type {
  PreviewableTransaction,
  PreviewBadge,
} from "./-components/transaction-preview-drawer";
import type { GhostBranch } from "./-lib/suggestions";
import { AppHeader } from "~/component/app-header";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useTRPCClient } from "~/lib/trpc";
import { CategoryDeleteDialog } from "./-components/category-delete-dialog";
import { CategoryIcon } from "./-components/category-icon";
import { CategoryIdentityDialog } from "./-components/category-identity-dialog";
import { CategoryOverviewTree } from "./-components/category-overview-tree";
import {
  SuggestionsReviewPanel,
  SuggestionsWaitPanel,
} from "./-components/suggestions-panel";
import { TransactionPreviewDrawer } from "./-components/transaction-preview-drawer";
import { deriveSuggestions, ghostTransactions } from "./-lib/suggestions";

export const Route = createFileRoute("/_authed/categories/")({
  loader: async ({ context }) => {
    const [status, overview] = await Promise.all([
      context.trpcClient.categories.suggestions.status.query(),
      context.trpcClient.categories.overview.query(),
    ]);
    return { status, overview };
  },
  component: CategoriesPage,
});

interface PreviewState {
  title: string;
  description: string;
  txns: PreviewableTransaction[];
  badge: PreviewBadge;
  footer: string;
}

const PREVIEW_FOOTER = "Aperçu limité aux 25 transactions les plus récentes.";

function CategoriesPage() {
  const { status, overview } = Route.useLoaderData();
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const resolveColor = useCategoryColor();

  const [generating, setGenerating] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [panelClosed, setPanelClosed] = useState(false);
  // Le rejet d'une proposition n'a rien à écrire en base : l'état du run vit en
  // mémoire côté serveur et disparaît au prochain « Lancer l'analyse ».
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [identityTarget, setIdentityTarget] = useState<IdentityTarget | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [expandAll, setExpandAll] = useState<boolean | null>(null);

  const { tree, uncategorizedCount } = overview;
  const stats = computeStats(tree);
  const suggestions = deriveSuggestions(
    status.suggestions ?? [],
    tree,
    dismissed,
  );
  const showReviewPanel =
    !generating && status.exists && !panelClosed && suggestions.branchCount > 0;

  // ── Mutations ────────────────────────────────────────────────────────────

  const run = async <T,>(
    action: () => Promise<T>,
    fallbackMessage: string,
  ): Promise<T | null> => {
    try {
      const result = await action();
      await router.invalidate();
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallbackMessage);
      return null;
    }
  };

  const generate = async () => {
    setGenerating(true);
    setPanelClosed(false);
    setDismissed(new Set());
    await run(
      () => trpcClient.categories.suggestions.generate.mutate(),
      "Échec de l'analyse.",
    );
    setGenerating(false);
  };

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

  const openPreview = async ({
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

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-dvh flex-col overflow-hidden text-[13px] leading-[1.45]">
      <AppHeader page="categories" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto max-w-[1010px] px-6 pt-5 pb-12">
          <div className="flex min-h-9.5 flex-wrap items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              Catégories
            </h1>
            <div className="ml-auto flex items-stretch">
              <Stat value={stats.parentCount} label="Parentes" />
              <Stat value={stats.childCount} label="Sous-catégories" />
              <Stat
                value={`${stats.colorsUsed} / ${CATEGORY_COLOR_PALETTE.length}`}
                label="Teintes prises"
                warn={stats.collisions > 0}
              />
            </div>
          </div>
          <p className="text-muted-foreground mt-2 max-w-160 text-[12.5px] text-pretty">
            Les catégories qui rangent toutes vos transactions. La couleur et
            l'icône d'une catégorie principale l'identifient partout ailleurs —
            elles se choisissent ici, et nulle part ailleurs.
          </p>

          {!generating &&
            !showReviewPanel &&
            (uncategorizedCount > 0 ? (
              <section className="border-primary bg-accent-soft mt-5 flex flex-wrap items-center gap-4 rounded-xl border p-4">
                <span className="bg-card border-primary text-primary flex size-[34px] flex-none items-center justify-center rounded-[10px] border">
                  <SparklesIcon className="size-4" />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold tracking-[-0.015em]">
                    Catégories manquantes
                  </h2>
                  <p className="text-muted-foreground mt-1 text-xs text-pretty">
                    <span className="text-foreground font-medium">
                      {uncategorizedCount} transaction
                      {uncategorizedCount > 1 ? "s" : ""}
                    </span>{" "}
                    qu'aucune de vos catégories ne décrit. Une analyse d'environ
                    une minute propose ce qui manque, et n'écrit rien tant que
                    vous n'avez pas répondu.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <SecondaryButton
                    onClick={() =>
                      openUncategorizedPreview(
                        trpcClient,
                        uncategorizedCount,
                        setPreview,
                      )
                    }
                  >
                    Voir les {uncategorizedCount}
                  </SecondaryButton>
                  {/* Absent de la maquette, qui ne connaît que l'analyse :
                      classer avec les catégories existantes reste l'étape la
                      moins chère, et c'est elle qui dit si l'arbre suffit. */}
                  <SecondaryButton onClick={categorize} disabled={categorizing}>
                    {categorizing && (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    )}
                    Catégoriser
                  </SecondaryButton>
                  <button
                    type="button"
                    onClick={generate}
                    className="bg-primary text-primary-foreground h-[34px] rounded-[9px] px-4 text-[12.5px] font-semibold whitespace-nowrap"
                  >
                    Lancer l'analyse
                  </button>
                </div>
              </section>
            ) : (
              <section className="bg-card mt-5 flex flex-wrap items-center gap-3.5 rounded-xl border px-4 py-3.5">
                <CircleCheckIcon className="text-ok size-4 flex-none" />
                <div className="min-w-[260px] flex-1">
                  <h2 className="text-[12.5px] font-medium">
                    Toutes vos transactions sont catégorisées
                  </h2>
                  <p className="text-subtle mt-0.5 text-[11.5px]">
                    Une analyse peut quand même proposer des branches plus fines
                    que celles que vous avez.
                  </p>
                </div>
                <SecondaryButton onClick={generate}>
                  Chercher des catégories
                </SecondaryButton>
              </section>
            ))}

          {generating && (
            <SuggestionsWaitPanel onClose={() => setPanelClosed(true)} />
          )}

          {showReviewPanel && status.generatedAt && (
            <SuggestionsReviewPanel
              generatedAt={status.generatedAt}
              newTransactionsCount={status.newTransactionsCount}
              branchCount={suggestions.branchCount}
              touchedExistingParents={suggestions.touchedExistingParents}
              newParentCount={suggestions.proposedParents.length}
              onClose={() => setPanelClosed(true)}
              onRegenerate={generate}
            />
          )}

          <div className="mt-7 mb-3 flex flex-wrap items-center gap-2.5">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
              Vos catégories
            </h2>
            <span className="text-subtle text-[11.5px]">
              {/* Les décomptes vivent dans le bloc de compteurs en haut de
                  page : ne reste ici que ce que ceux-ci ne disent pas. */}
              {tree.length === 0
                ? "aucune catégorie pour le moment"
                : "le compteur d'une parente ne compte que ses transactions directes"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {stats.collisions > 0 && (
                <span className="text-warn text-[11.5px]">
                  {stats.collisions} collision
                  {stats.collisions > 1 ? "s" : ""} de teinte
                  {stats.withoutColor > 0 &&
                    ` · ${stats.withoutColor} sans couleur`}{" "}
                  — l'icône fait la différence
                </span>
              )}
              {tree.length > 0 && (
                <SecondaryButton
                  onClick={() =>
                    setExpandAll((v) => (v === true ? false : true))
                  }
                  className="h-auto py-1"
                >
                  Tout replier / déplier
                </SecondaryButton>
              )}
            </div>
          </div>

          <CategoryOverviewTree
            tree={tree}
            ghostsByParentId={suggestions.ghostsByParentId}
            proposedParents={suggestions.proposedParents}
            uncategorizedCount={uncategorizedCount}
            ownersByColor={stats.ownersByColor}
            pendingGhosts={pending}
            expandAllSignal={expandAll}
            onAnalyze={generate}
            onRename={async (id, name) =>
              (await run(
                () => trpcClient.categories.rename.mutate({ id, name }),
                "Échec du renommage.",
              )) !== null
            }
            onOpenIdentity={setIdentityTarget}
            onPreview={openPreview}
            onDelete={setDeleteTarget}
            onAddChild={(parentId) =>
              void run(
                () =>
                  trpcClient.categories.create.mutate({
                    name: "Nouvelle sous-catégorie",
                    parentId,
                  }),
                "Échec de la création.",
              )
            }
            onAddParent={() =>
              void run(
                () =>
                  trpcClient.categories.create.mutate({
                    name: "Nouvelle catégorie",
                    parentId: null,
                  }),
                "Échec de la création.",
              )
            }
            onAcceptGhost={acceptGhost}
            onDismissGhost={(ghost) =>
              setDismissed((s) => new Set(s).add(ghost.key))
            }
            onPreviewGhost={(ghost) =>
              setPreview({
                title: `${ghost.parent} › ${ghost.name}`,
                description: `${ghost.txnIds.length} transaction(s) sans catégorie qui se ressemblent — aperçu.`,
                txns: ghostTransactions(ghost, status.sample ?? []),
                // Une branche proposée n'a pas encore d'icône : la pastille
                // creuse dans la teinte de sa parente est exactement l'état
                // « aucune icône choisie ».
                badge: categoryBadge(
                  resolveColor(ghost.parentColor),
                  softCategoryColor(resolveColor(ghost.parentColor)),
                  null,
                ),
                footer: "Proposition : elles seraient rangées ici.",
              })
            }
          />

          <p className="text-subtle mt-3.5 max-w-[820px] text-[11.5px] text-pretty">
            La couleur sert là où il n'y a pas de place — segments de barre,
            points, tuiles compactes. L'icône sert partout où il y a au moins 20
            px : listes, sélecteurs, en-têtes de catégorie. Les sous-catégories
            n'ont ni l'une ni l'autre en propre : elles se lisent comme une
            famille de la teinte du parent.
          </p>
        </main>
      </div>

      <CategoryIdentityDialog
        target={identityTarget}
        onOpenChange={(open) => !open && setIdentityTarget(null)}
        ownersByColor={stats.ownersByColor}
        usageByIcon={stats.usageByIcon}
        onColorChange={(color) => {
          if (!identityTarget) return;
          setIdentityTarget({ ...identityTarget, color });
          void run(
            () =>
              trpcClient.categories.updateColor.mutate({
                id: identityTarget.id,
                color,
              }),
            "Échec du changement de couleur.",
          );
        }}
        onIconChange={(icon) => {
          if (!identityTarget) return;
          setIdentityTarget({ ...identityTarget, icon });
          void run(
            () =>
              trpcClient.categories.updateIcon.mutate({
                id: identityTarget.id,
                icon,
              }),
            "Échec du changement d'icône.",
          );
        }}
      />

      <CategoryDeleteDialog
        target={deleteTarget}
        deleting={deleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          const done = await run(
            () => trpcClient.categories.remove.mutate({ id: deleteTarget.id }),
            "Échec de la suppression.",
          );
          if (done !== null) {
            toast.success(`« ${deleteTarget.name} » supprimée.`);
            setDeleteTarget(null);
          }
          setDeleting(false);
        }}
      />

      <TransactionPreviewDrawer
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        description={preview?.description}
        transactions={preview?.txns ?? []}
        badge={preview?.badge}
        footer={preview?.footer}
      />
    </div>
  );
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

async function openUncategorizedPreview(
  trpcClient: ReturnType<typeof useTRPCClient>,
  total: number,
  setPreview: (state: PreviewState) => void,
) {
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

// Filets verticaux entre les trois compteurs, comme la maquette : c'est ce qui
// les tient ensemble comme un bloc sans les faire passer pour trois boutons.
function Stat({
  value,
  label,
  warn,
}: {
  value: number | string;
  label: string;
  warn?: boolean;
}) {
  return (
    <div className="border-border border-l px-3 text-right first:border-l-0 first:pl-0 last:pr-0">
      <div
        className={`num text-[15px] font-medium tracking-[-0.01em] ${warn ? "text-warn" : ""}`}
      >
        {value}
      </div>
      <div className="label-caps mt-0.5">{label}</div>
    </div>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`border-border-strong bg-card text-muted-foreground hover:text-foreground hover:border-primary flex h-[34px] items-center gap-1.5 rounded-[9px] border px-3 text-xs whitespace-nowrap disabled:opacity-60 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
