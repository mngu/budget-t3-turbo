"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ListIcon,
  ListTreeIcon,
  PaletteIcon,
  PlusIcon,
  TagsIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import type { CategoryBudgetRow, CategoryOverviewNode } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@budget/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@budget/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@budget/ui/empty";

import type { GhostBranch } from "../-lib/suggestions";
import type { PreviewRequest } from "../-lib/use-preview";
import { CategoryIcon } from "~/component/category-icon";
import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro0 } from "~/lib/format";

// Au-delà de ce nombre de parentes, la liste s'ouvre repliée : passé une
// dizaine de branches déployées, la page n'est plus lisible d'un coup d'œil.
// Une parente qui porte une proposition reste toujours dépliée — sinon la
// proposition serait posée dans la liste sans que rien ne la montre.
const COLLAPSE_THRESHOLD = 8;

export interface CategoryOverviewTreeActions {
  onRename: (id: number, name: string) => Promise<boolean>;
  onOpenIdentity: (node: CategoryOverviewNode) => void;
  onPreview: (preview: PreviewRequest) => void;
  onDelete: (node: {
    id: number;
    name: string;
    transactionCount: number;
    childCount: number;
    childNames: string[];
  }) => void;
  onAddChild: (parentId: number) => void;
  onAddParent: () => void;
  onAcceptGhost: (ghost: GhostBranch) => void;
  onDismissGhost: (ghost: GhostBranch) => void;
  onPreviewGhost: (ghost: GhostBranch) => void;
}

interface CategoryOverviewTreeProps extends CategoryOverviewTreeActions {
  tree: CategoryOverviewNode[];
  /** Propositions rattachées à une parente existante, indexées par son id. */
  ghostsByParentId: Map<number, GhostBranch[]>;
  /** Propositions dont la parente elle-même n'existe pas encore. */
  proposedParents: { name: string; color: string; branches: GhostBranch[] }[];
  uncategorizedCount: number;
  /** Nom des parentes portant chaque teinte — sert le « même teinte que… ». */
  ownersByColor: Map<string, string[]>;
  /** En cours d'acceptation — clés de GhostBranch. */
  pendingGhosts: ReadonlySet<string>;
  /** Montant posé et moyenne de référence, par catégorie. */
  budgetRows: Map<number, CategoryBudgetRow>;
  onSetAmount: (categoryId: number, amount: number | null) => void;
  onSetDetailed: (categoryId: number, detailed: boolean) => void;
  expandAllSignal: boolean | null;
  onAnalyze: () => void;
}

export function CategoryOverviewTree({
  tree,
  ghostsByParentId,
  proposedParents,
  uncategorizedCount,
  ownersByColor,
  pendingGhosts,
  budgetRows,
  onSetAmount,
  onSetDetailed,
  expandAllSignal,
  onAnalyze,
  ...actions
}: CategoryOverviewTreeProps) {
  // Les plis ouverts/fermés un par un, et le signal global qui les a précédés.
  // Les deux vivent dans le même état parce qu'un « Tout replier / déplier »
  // doit **effacer** les choix individuels : sans ça, une ligne déjà repliée à
  // la main resterait sourde au bouton global, qui donnerait l'impression de
  // ne marcher qu'à moitié.
  const [folds, setFolds] = useState<{
    overrides: Record<number, boolean>;
    signal: boolean | null;
  }>({ overrides: {}, signal: expandAllSignal });
  if (folds.signal !== expandAllSignal) {
    setFolds({ overrides: {}, signal: expandAllSignal });
  }

  const bigTree = tree.length > COLLAPSE_THRESHOLD;

  if (tree.length === 0 && proposedParents.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TagsIcon />
          </EmptyMedia>
          <EmptyTitle>Aucune catégorie pour le moment</EmptyTitle>
          <EmptyDescription>
            Créez une première catégorie à la main, ou laissez une analyse en
            proposer à partir de vos {uncategorizedCount} transactions sans
            catégorie.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={actions.onAddParent}>
            Créer une catégorie
          </Button>
          <Button size="sm" onClick={onAnalyze}>
            Analyser mes transactions
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      {tree.map((parent) => {
        const ghosts = ghostsByParentId.get(parent.id) ?? [];
        // L'ordre compte : une proposition force l'ouverture, sinon on suit le
        // choix explicite de l'utilisateur, sinon le repli par défaut.
        const expanded =
          ghosts.length > 0
            ? true
            : (folds.overrides[parent.id] ??
              expandAllSignal ??
              !(bigTree && parent.children.length > 0));

        return (
          <ParentRow
            key={parent.id}
            parent={parent}
            ghosts={ghosts}
            twin={
              parent.color
                ? (ownersByColor.get(parent.color) ?? []).find(
                    (name) => name !== parent.name,
                  )
                : undefined
            }
            expanded={expanded}
            forcedOpen={ghosts.length > 0}
            pendingGhosts={pendingGhosts}
            budgetRows={budgetRows}
            onSetAmount={onSetAmount}
            onSetDetailed={onSetDetailed}
            onToggle={() =>
              setFolds((f) => ({
                ...f,
                overrides: { ...f.overrides, [parent.id]: !expanded },
              }))
            }
            {...actions}
          />
        );
      })}

      {proposedParents.map((proposed) => (
        <ProposedParentRow
          key={proposed.name}
          proposed={proposed}
          pendingGhosts={pendingGhosts}
          {...actions}
        />
      ))}

      <button
        type="button"
        onClick={actions.onAddParent}
        className="text-muted-foreground hover:bg-surface-2 hover:text-foreground text-control flex w-full items-center gap-2.5 px-3 py-2.5"
      >
        <span className="border-border-strong flex size-8 items-center justify-center rounded-md border border-dashed">
          <PlusIcon className="size-3.5" />
        </span>
        Ajouter une catégorie parente
      </button>
    </div>
  );
}

function ParentRow({
  parent,
  ghosts,
  twin,
  expanded,
  forcedOpen,
  pendingGhosts,
  budgetRows,
  onSetAmount,
  onSetDetailed,
  onToggle,
  onRename,
  onOpenIdentity,
  onPreview,
  onDelete,
  onAddChild,
  onAcceptGhost,
  onDismissGhost,
  onPreviewGhost,
}: {
  parent: CategoryOverviewNode;
  ghosts: GhostBranch[];
  /** Autre parente portant la même teinte, s'il y en a une. */
  twin: string | undefined;
  expanded: boolean;
  forcedOpen: boolean;
  pendingGhosts: ReadonlySet<string>;
  budgetRows: Map<number, CategoryBudgetRow>;
  onSetAmount: (categoryId: number, amount: number | null) => void;
  onSetDetailed: (categoryId: number, detailed: boolean) => void;
  onToggle: () => void;
} & Omit<CategoryOverviewTreeActions, "onAddParent">) {
  const resolve = useCategoryColor();
  const color = parent.color ?? FALLBACK_CATEGORY_COLOR;
  const hasIdentity = parent.color !== null || parent.icon !== null;
  const collapsible = parent.children.length > 0 || ghosts.length > 0;
  // Une parente sans sous-catégorie porte toujours son budget elle-même, quel
  // que soit le drapeau en base — même règle que `budgetSlots` côté API, sans
  // quoi son budget disparaîtrait de l'écran mais pas des compteurs.
  const detailed =
    parent.children.length > 0 &&
    (budgetRows.get(parent.id)?.detailed ?? false);

  const soft = softCategoryColor(resolve(color));

  const previewParent = () =>
    onPreview({
      name: parent.name,
      includesChildren: parent.children.length > 0,
      color: resolve(color),
      soft,
      icon: parent.icon,
    });

  // Pli contrôlé : l'état vit dans `CategoryOverviewTree`, qui l'arbitre entre
  // le choix explicite, le signal « tout replier » et l'ouverture *forcée*
  // d'une parente qui porte une proposition. `Collapsible` apporte le contrat
  // (`aria-expanded`, `aria-controls`), pas l'état.
  return (
    <Collapsible
      open={expanded}
      onOpenChange={onToggle}
      render={<div className="border-b last:border-b-0" />}
    >
      <div className="hover:bg-surface-2 grid min-h-11 grid-cols-[20px_32px_minmax(0,1fr)_auto_76px_224px_28px] items-center gap-2 px-3">
        <CollapsibleTrigger
          disabled={forcedOpen || !collapsible}
          aria-label={expanded ? "Replier" : "Déplier"}
          className={cn(
            "text-subtle hover:bg-accent hover:text-foreground flex size-5 items-center justify-center rounded-md",
            !collapsible && "invisible",
            forcedOpen && "pointer-events-none",
          )}
        >
          {expanded ? (
            <ChevronDownIcon className="size-2.5" />
          ) : (
            <ChevronRightIcon className="size-2.5" />
          )}
        </CollapsibleTrigger>

        <button
          type="button"
          onClick={() => onOpenIdentity(parent)}
          title="Couleur et icône"
          aria-label={`Couleur et icône de ${parent.name}`}
          className="relative flex size-8 items-center justify-center rounded-md border"
          style={{
            background: softCategoryColor(resolve(color)),
            borderColor: parent.color ? "transparent" : "var(--border-strong)",
          }}
        >
          <CategoryIcon name={parent.icon} color={resolve(color)} />
          <span
            className="border-card absolute -right-0.5 -bottom-0.5 size-2 rounded-full border-[1.5px]"
            style={{ background: resolve(color) }}
          />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <NameInput
            name={parent.name}
            onRename={(name) => onRename(parent.id, name)}
            className="text-body max-w-70 font-medium"
          />
          {/* La modale d'identité promet noir sur blanc que « la ligne
              affichera "même teinte que…" » quand on choisit une teinte déjà
              prise : c'est ici que cette promesse se tient. Une collision est
              un état normal à 13 teintes pour un nombre illimité de parentes —
              signalée, jamais interdite. */}
          {twin && (
            <span className="text-warn bg-warn-soft text-meta flex items-center gap-1.5 rounded-md px-1.5 py-px whitespace-nowrap">
              <TriangleAlertIcon className="size-3 flex-none" />
              même teinte que {twin}
            </span>
          )}
          {!hasIdentity && (
            <span className="text-subtle border-border-strong text-meta rounded-md border border-dashed px-1.5 py-px whitespace-nowrap">
              sans couleur ni icône
            </span>
          )}
        </div>

        {/* Le décompte de sous-catégories et ses pastilles de teinte ont laissé
            la place à la colonne des budgets : ce qu'ils disaient se lit en
            dépliant, une proposition non. */}
        <div className="flex flex-nowrap items-center gap-1.5">
          {ghosts.length > 0 && (
            <span className="text-primary bg-accent-soft border-primary text-meta rounded-full border px-2 font-semibold whitespace-nowrap">
              {ghosts.length} proposée{ghosts.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <CountButton
          count={parent.directTransactionCount}
          onClick={previewParent}
          title="Voir les transactions directes"
        />

        <div className="flex items-center justify-end gap-2">
          {detailed ? (
            <DetailedSum parent={parent} rows={budgetRows} />
          ) : (
            <BudgetAmount
              row={budgetRows.get(parent.id)}
              onSet={(amount) => onSetAmount(parent.id, amount)}
            />
          )}
        </div>

        {/* Une entrée referme le menu d'elle-même : plus de `setMenuOpen(false)`
            en tête de chaque action. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions sur ${parent.name}`}
              />
            }
          >
            <EllipsisIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAddChild(parent.id)}>
              <PlusIcon />
              Ajouter une sous-catégorie
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOpenIdentity(parent)}>
              <PaletteIcon />
              Couleur et icône
            </DropdownMenuItem>
            <DropdownMenuItem onClick={previewParent}>
              <ListIcon />
              Voir les transactions
            </DropdownMenuItem>
            {/* Passer en détaillé **efface** le montant global de la parente :
                elle n'a alors plus de montant à elle, son budget est la somme
                de ses sous-catégories (CHECK en base). Sans confirmation —
                c'est un nombre à retaper, la moyenne le repropose. */}
            {parent.children.length > 0 && (
              <DropdownMenuItem
                onClick={() => onSetDetailed(parent.id, !detailed)}
              >
                <ListTreeIcon />
                {detailed
                  ? "Budget global pour la catégorie"
                  : "Détailler le budget par sous-catégorie"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                onDelete({
                  id: parent.id,
                  name: parent.name,
                  transactionCount: parent.transactionCount,
                  childCount: parent.children.length,
                  childNames: parent.children.map(
                    (c) => `${c.name} · ${c.transactionCount}`,
                  ),
                })
              }
            >
              <Trash2Icon />
              Supprimer la catégorie
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CollapsibleContent className="pt-0.5 pb-2">
        {ghosts.map((ghost) => (
          <GhostRow
            key={ghost.key}
            ghost={ghost}
            color={resolve(color)}
            pending={pendingGhosts.has(ghost.key)}
            onAccept={() => onAcceptGhost(ghost)}
            onDismiss={() => onDismissGhost(ghost)}
            onPreview={() => onPreviewGhost(ghost)}
          />
        ))}

        {parent.children.map((child, i) => {
          const shade = shadeCategoryColor(
            resolve(color),
            i,
            parent.children.length,
          );
          return (
            <div
              key={child.id}
              className="hover:bg-surface-2 grid min-h-11 grid-cols-[61px_8px_minmax(0,1fr)_76px_224px_28px] items-center gap-2 px-3"
            >
              <span />
              <span
                className="size-2 rounded-full"
                style={{ background: shade }}
              />
              <NameInput
                name={child.name}
                onRename={(name) => onRename(child.id, name)}
                className="text-control max-w-65"
              />
              <CountButton
                count={child.transactionCount}
                onClick={() =>
                  onPreview({
                    name: child.name,
                    includesChildren: false,
                    // Palier de la teinte du parent, et son icône : une
                    // sous-catégorie n'a ni l'une ni l'autre en propre. Le
                    // fond reste l'aplat de la parente (voir
                    // PreviewRequest.soft).
                    color: shade,
                    soft,
                    icon: parent.icon,
                  })
                }
                className="text-control"
              />
              <div className="flex items-center justify-end gap-2">
                {detailed ? (
                  <BudgetAmount
                    row={budgetRows.get(child.id)}
                    onSet={(amount) => onSetAmount(child.id, amount)}
                  />
                ) : (
                  // Parente en budget global : la sous-catégorie n'a rien à
                  // saisir, mais sa moyenne dit d'où vient la somme.
                  <span className="num text-subtle text-meta whitespace-nowrap">
                    {budgetRows.get(child.id)?.average
                      ? `moy. ${euro0.format(budgetRows.get(child.id)?.average ?? 0)}`
                      : "—"}
                  </span>
                )}
              </div>
              <button
                type="button"
                aria-label={`Supprimer ${child.name}`}
                title="Supprimer"
                onClick={() =>
                  onDelete({
                    id: child.id,
                    name: child.name,
                    transactionCount: child.transactionCount,
                    childCount: 0,
                    childNames: [],
                  })
                }
                className="text-subtle hover:bg-bad-soft hover:text-bad flex size-6 items-center justify-center rounded-md"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          );
        })}

        {parent.children.length === 0 && (
          <p className="text-subtle text-control px-3 pt-1.5 pb-1 pl-18">
            Aucune sous-catégorie — ses {parent.directTransactionCount}{" "}
            transactions sont portées directement par la catégorie.
          </p>
        )}

        <button
          type="button"
          onClick={() => onAddChild(parent.id)}
          className="border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground text-control mt-1 ml-18 flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1"
        >
          <PlusIcon className="size-3" />
          Ajouter une sous-catégorie
        </button>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * Une parente entièrement proposée : elle n'existe pas encore en base, donc
 * aucune de ses lignes n'est éditable et elle n'a ni compteur ni menu. Accepter
 * une de ses branches la crée au passage (voir acceptSuggestion côté API).
 *
 * La maquette ne montrait ce cas nulle part — ses propositions se nichent
 * toujours sous une parente existante. Les faire disparaître de l'écran aurait
 * silencieusement perdu une partie de l'analyse.
 */
function ProposedParentRow({
  proposed,
  pendingGhosts,
  onAcceptGhost,
  onDismissGhost,
  onPreviewGhost,
}: {
  proposed: { name: string; color: string; branches: GhostBranch[] };
  pendingGhosts: ReadonlySet<string>;
} & Pick<
  CategoryOverviewTreeActions,
  "onAcceptGhost" | "onDismissGhost" | "onPreviewGhost"
>) {
  const resolve = useCategoryColor();
  const color = resolve(proposed.color);

  return (
    <div className="border-b last:border-b-0">
      <div className="bg-accent-soft grid min-h-11 grid-cols-[20px_32px_minmax(0,1fr)_auto] items-center gap-2 px-3 shadow-[inset_2px_0_0_var(--primary)]">
        <span />
        <span
          className="flex size-8 items-center justify-center rounded-md border border-dashed"
          style={{ borderColor: color }}
        >
          <CategoryIcon name={null} color={color} />
        </span>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-body font-medium">{proposed.name}</span>
          <span className="label-caps text-primary font-semibold">
            nouvelle catégorie
          </span>
        </div>
        <span className="text-subtle text-meta whitespace-nowrap">
          {proposed.branches.length} sous-catégorie
          {proposed.branches.length > 1 ? "s" : ""} proposée
          {proposed.branches.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="pt-0.5 pb-2">
        {proposed.branches.map((ghost) => (
          <GhostRow
            key={ghost.key}
            ghost={ghost}
            color={color}
            pending={pendingGhosts.has(ghost.key)}
            onAccept={() => onAcceptGhost(ghost)}
            onDismiss={() => onDismissGhost(ghost)}
            onPreview={() => onPreviewGhost(ghost)}
          />
        ))}
      </div>
    </div>
  );
}

function GhostRow({
  ghost,
  color,
  pending,
  onAccept,
  onDismiss,
  onPreview,
}: {
  ghost: GhostBranch;
  color: string;
  pending: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onPreview: () => void;
}) {
  return (
    <div className="bg-accent-soft grid min-h-9 grid-cols-[60px_8px_minmax(0,1fr)_auto] items-center gap-2 px-3 shadow-[inset_2px_0_0_var(--primary)]">
      <span />
      <span
        className="size-2 rounded-full border-[1.5px] border-dashed"
        style={{ borderColor: color }}
      />
      <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
        <span className="text-control font-medium">{ghost.name}</span>
        <span className="label-caps text-primary font-semibold">proposée</span>
        <button
          type="button"
          onClick={onPreview}
          className="text-muted-foreground hover:text-primary text-meta"
        >
          {ghost.txnIds.length} transaction
          {ghost.txnIds.length > 1 ? "s" : ""}
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onAccept}
          disabled={pending}
          className="text-primary text-control font-semibold disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          aria-label={`Écarter ${ghost.name}`}
          title="Écarter"
          className="text-subtle hover:bg-bad-soft hover:text-bad flex size-6 items-center justify-center rounded-md disabled:opacity-50"
        >
          <XIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}

// Renommage : commit au blur ou à Entrée, retour à la valeur d'origine si le
// serveur refuse (nom déjà pris).
function NameInput({
  name,
  onRename,
  className,
}: {
  name: string;
  onRename: (name: string) => Promise<boolean>;
  className?: string;
}) {
  const [value, setValue] = useState(name);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === name || trimmed.length === 0) {
      setValue(name);
      return;
    }
    if (!(await onRename(trimmed))) setValue(name);
  };

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(name);
          e.currentTarget.blur();
        }
      }}
      aria-label={`Renommer ${name}`}
      className={cn(
        "focus:border-primary focus:bg-background hover:border-border w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 py-1 outline-none",
        className,
      )}
    />
  );
}

function CountButton({
  count,
  onClick,
  title,
  className,
}: {
  count: number;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={count === 0}
      className={cn(
        "num hover:text-primary text-control text-right disabled:pointer-events-none",
        count === 0 ? "text-subtle" : "text-muted-foreground",
        className,
      )}
    >
      {count} txns
    </button>
  );
}

/**
 * Une parente détaillée n'a pas de montant à elle : elle affiche la somme de
 * ses sous-catégories — la seule valeur qui existe, rien n'est stocké sur elle
 * — et ce qui reste à y saisir.
 */
function DetailedSum({
  parent,
  rows,
}: {
  parent: CategoryOverviewNode;
  rows: Map<number, CategoryBudgetRow>;
}) {
  const amounts = parent.children.map((c) => rows.get(c.id)?.amount ?? null);
  const missing = amounts.filter((a) => a === null).length;

  return (
    <div className="flex flex-col items-end">
      <span
        className={cn(
          "num text-meta font-medium",
          missing > 0 && "text-muted-foreground",
        )}
      >
        {euro0.format(amounts.reduce((sum: number, a) => sum + (a ?? 0), 0))}
        /mois
      </span>
      <span className="text-subtle text-label whitespace-nowrap">
        {missing > 0
          ? `${missing} sous-cat. à remplir`
          : `somme de ${parent.children.length} sous-cat.`}
      </span>
    </div>
  );
}

/**
 * Le montant d'un poste : le champ de saisie, précédé du raccourci de
 * pré-remplissage tant que rien n'est posé. Le raccourci ne s'affiche que si la
 * moyenne est une proposition défendable — une catégorie vue moins de 4 mois
 * sur 6 arrive `irregular` et n'en reçoit pas (voir budgetProposal côté API).
 */
function BudgetAmount({
  row,
  onSet,
}: {
  row: CategoryBudgetRow | undefined;
  onSet: (amount: number | null) => void;
}) {
  const proposal =
    row?.amount === null && !row.irregular && row.average > 0
      ? row.average
      : null;

  return (
    <>
      {proposal !== null && (
        <button
          type="button"
          onClick={() => onSet(proposal)}
          title={`Pré-remplir le budget avec ${euro0.format(proposal)} · moyenne 6 mois`}
          className="num text-subtle hover:text-primary text-meta whitespace-nowrap"
        >
          Moyenne {euro0.format(proposal)} →
        </button>
      )}
      <AmountInput value={row?.amount ?? null} onCommit={onSet} />
    </>
  );
}

// Saisie en euros entiers, commit au blur ou à Entrée. La valeur du serveur est
// resynchronisée à la volée : le raccourci « Moyenne … » et le « Tout vider »
// écrivent dans le même champ.
function AmountInput({
  value,
  onCommit,
}: {
  value: number | null;
  onCommit: (amount: number | null) => void;
}) {
  const [state, setState] = useState({ text: value?.toString() ?? "", value });
  if (state.value !== value) setState({ text: value?.toString() ?? "", value });

  const commit = () => {
    const digits = state.text.replace(/\D/g, "").slice(0, 5);
    const next = digits === "" ? null : Number(digits);
    if (next !== value) onCommit(next);
    setState({ text: digits, value });
  };

  return (
    <span className="relative inline-flex items-center">
      <input
        value={state.text}
        inputMode="numeric"
        placeholder="—"
        aria-label="Budget mensuel"
        onChange={(e) =>
          setState((s) => ({
            ...s,
            text: e.target.value.replace(/\D/g, "").slice(0, 5),
          }))
        }
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setState({ text: value?.toString() ?? "", value });
            e.currentTarget.blur();
          }
        }}
        className="num border-border-strong bg-background focus:border-primary text-meta h-7 w-24 rounded-lg border px-2 pr-5 text-right font-medium outline-none"
      />
      <span className="text-subtle text-meta pointer-events-none absolute right-2">
        €
      </span>
    </span>
  );
}
