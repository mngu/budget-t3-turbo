"use client";

import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EllipsisIcon,
  ListIcon,
  PaletteIcon,
  PlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import type { CategoryOverviewNode } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import type { GhostBranch } from "../-lib/suggestions";
import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { CategoryIcon } from "./category-icon";

// Au-delà de ce nombre de parentes, la liste s'ouvre repliée : passé une
// dizaine de branches déployées, la page n'est plus lisible d'un coup d'œil.
// Une parente qui porte une proposition reste toujours dépliée — sinon la
// proposition serait posée dans la liste sans que rien ne la montre.
const COLLAPSE_THRESHOLD = 8;

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
      <div className="bg-card rounded-[14px] border px-5 py-11 text-center">
        <div className="text-[13px] font-medium">
          Aucune catégorie pour le moment
        </div>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-[420px] text-xs text-pretty">
          Créez une première catégorie à la main, ou laissez une analyse en
          proposer à partir de vos {uncategorizedCount} transactions sans
          catégorie.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={actions.onAddParent}
            className="border-border-strong hover:bg-accent h-[31px] rounded-[9px] border px-3 text-xs font-medium"
          >
            Créer une catégorie
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            className="bg-primary text-primary-foreground h-[31px] rounded-[9px] px-3.5 text-xs font-semibold"
          >
            Analyser mes transactions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-[14px] border">
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
        className="text-muted-foreground hover:bg-surface-2 hover:text-foreground flex w-full items-center gap-2.5 px-3 py-2.5 text-xs"
      >
        <span className="border-border-strong flex size-[30px] items-center justify-center rounded-[9px] border border-dashed">
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
  onToggle: () => void;
} & Omit<CategoryOverviewTreeActions, "onAddParent">) {
  const resolve = useCategoryColor();
  const [menuOpen, setMenuOpen] = useState(false);

  const color = parent.color ?? FALLBACK_CATEGORY_COLOR;
  const hasIdentity = parent.color !== null || parent.icon !== null;
  const collapsible = parent.children.length > 0 || ghosts.length > 0;

  const soft = softCategoryColor(resolve(color));

  const previewParent = () =>
    onPreview({
      name: parent.name,
      includesChildren: parent.children.length > 0,
      color: resolve(color),
      soft,
      icon: parent.icon,
    });

  return (
    <div className="border-b last:border-b-0">
      <div className="hover:bg-surface-2 grid min-h-[46px] grid-cols-[20px_30px_minmax(0,1fr)_auto_74px_26px] items-center gap-2 px-3">
        <button
          type="button"
          onClick={onToggle}
          disabled={forcedOpen}
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
        </button>

        <button
          type="button"
          onClick={() => onOpenIdentity(parent)}
          title="Couleur et icône"
          aria-label={`Couleur et icône de ${parent.name}`}
          className="relative flex size-[30px] items-center justify-center rounded-[9px] border"
          style={{
            background: softCategoryColor(resolve(color)),
            color: resolve(color),
            borderColor: parent.color ? "transparent" : "var(--border-strong)",
          }}
        >
          <CategoryIcon name={parent.icon} />
          <span
            className="border-card absolute -right-0.5 -bottom-0.5 size-[9px] rounded-full border-[1.5px]"
            style={{ background: resolve(color) }}
          />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <NameInput
            name={parent.name}
            onRename={(name) => onRename(parent.id, name)}
            className="max-w-[280px] text-[13px] font-medium"
          />
          {/* La modale d'identité promet noir sur blanc que « la ligne
              affichera "même teinte que…" » quand on choisit une teinte déjà
              prise : c'est ici que cette promesse se tient. Une collision est
              un état normal à 13 teintes pour un nombre illimité de parentes —
              signalée, jamais interdite. */}
          {twin && (
            <span className="text-warn bg-warn-soft flex items-center gap-1.5 rounded-md px-1.5 py-px text-[11px] whitespace-nowrap">
              <TriangleAlertIcon className="size-3 flex-none" />
              même teinte que {twin}
            </span>
          )}
          {!hasIdentity && (
            <span className="text-subtle border-border-strong rounded-md border border-dashed px-1.5 py-px text-[11px] whitespace-nowrap">
              sans couleur ni icône
            </span>
          )}
        </div>

        <div className="flex flex-nowrap items-center gap-1.5">
          {!expanded &&
            parent.children.slice(0, 6).map((child, i) => (
              <span
                key={child.id}
                title={`${child.name} · ${child.transactionCount}`}
                className="size-[7px] rounded-full"
                style={{
                  background: shadeCategoryColor(
                    resolve(color),
                    i,
                    Math.min(parent.children.length, 6),
                  ),
                }}
              />
            ))}
          <span className="text-subtle text-[11px] whitespace-nowrap">
            {parent.children.length > 0
              ? `${parent.children.length} sous-cat.`
              : "aucune sous-catégorie"}
          </span>
          {ghosts.length > 0 && (
            <span className="text-primary bg-accent-soft border-primary rounded-full border px-2 text-[11px] font-semibold whitespace-nowrap">
              {ghosts.length} proposée{ghosts.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <CountButton
          count={parent.directTransactionCount}
          onClick={previewParent}
          title="Voir les transactions directes"
        />

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger
            render={(props) => (
              <button
                {...props}
                type="button"
                aria-label={`Actions sur ${parent.name}`}
                className="text-subtle hover:bg-accent hover:text-foreground flex size-[26px] items-center justify-center rounded-[7px]"
              >
                <EllipsisIcon className="size-3.5" />
              </button>
            )}
          />
          <PopoverContent align="end" className="w-[236px] p-1">
            <MenuItem
              icon={PlusIcon}
              onClick={() => {
                setMenuOpen(false);
                onAddChild(parent.id);
              }}
            >
              Ajouter une sous-catégorie
            </MenuItem>
            <MenuItem
              icon={PaletteIcon}
              onClick={() => {
                setMenuOpen(false);
                onOpenIdentity(parent);
              }}
            >
              Couleur et icône
            </MenuItem>
            <MenuItem
              icon={ListIcon}
              onClick={() => {
                setMenuOpen(false);
                previewParent();
              }}
            >
              Voir les transactions
            </MenuItem>
            <div className="bg-border my-1 h-px" />
            <MenuItem
              icon={Trash2Icon}
              destructive
              onClick={() => {
                setMenuOpen(false);
                onDelete({
                  id: parent.id,
                  name: parent.name,
                  transactionCount: parent.transactionCount,
                  childCount: parent.children.length,
                  childNames: parent.children.map(
                    (c) => `${c.name} · ${c.transactionCount}`,
                  ),
                });
              }}
            >
              Supprimer la catégorie
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>

      {expanded && (
        <div className="pt-0.5 pb-2">
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
                className="hover:bg-surface-2 grid min-h-9 grid-cols-[61px_8px_minmax(0,1fr)_74px_26px] items-center gap-2 px-3"
              >
                <span />
                <span
                  className="size-[7px] rounded-full"
                  style={{ background: shade }}
                />
                <NameInput
                  name={child.name}
                  onRename={(name) => onRename(child.id, name)}
                  className="max-w-[260px] text-[12.5px]"
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
                  className="text-[11.5px]"
                />
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
                  className="text-subtle hover:bg-bad-soft hover:text-bad flex size-6 items-center justify-center rounded-[7px]"
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            );
          })}

          {parent.children.length === 0 && (
            <p className="text-subtle px-3 pt-1.5 pb-1 pl-[72px] text-[11.5px]">
              Aucune sous-catégorie — ses {parent.directTransactionCount}{" "}
              transactions sont portées directement par la catégorie.
            </p>
          )}

          <button
            type="button"
            onClick={() => onAddChild(parent.id)}
            className="border-border-strong text-muted-foreground hover:bg-accent hover:text-foreground mt-1 ml-[72px] flex items-center gap-2 rounded-lg border border-dashed px-2.5 py-1 text-[11.5px]"
          >
            <PlusIcon className="size-3" />
            Ajouter une sous-catégorie
          </button>
        </div>
      )}
    </div>
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
      <div className="bg-accent-soft grid min-h-[46px] grid-cols-[20px_30px_minmax(0,1fr)_auto] items-center gap-2 px-3 shadow-[inset_2px_0_0_var(--primary)]">
        <span />
        <span
          className="flex size-[30px] items-center justify-center rounded-[9px] border border-dashed"
          style={{ color, borderColor: color }}
        >
          <CategoryIcon name={null} />
        </span>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="text-[13px] font-medium">{proposed.name}</span>
          <span className="text-primary text-[10.5px] font-semibold tracking-[0.04em] uppercase">
            nouvelle catégorie
          </span>
        </div>
        <span className="text-subtle text-[11px] whitespace-nowrap">
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
    <div className="bg-accent-soft grid min-h-[38px] grid-cols-[61px_8px_minmax(0,1fr)_auto] items-center gap-2 px-3 shadow-[inset_2px_0_0_var(--primary)]">
      <span />
      <span
        className="size-[7px] rounded-full border-[1.5px] border-dashed"
        style={{ borderColor: color }}
      />
      <div className="flex min-w-0 flex-wrap items-baseline gap-2.5">
        <span className="text-[12.5px] font-medium">{ghost.name}</span>
        <span className="text-primary text-[10.5px] font-semibold tracking-[0.04em] uppercase">
          proposée
        </span>
        <button
          type="button"
          onClick={onPreview}
          className="text-muted-foreground hover:text-primary text-[11px]"
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
          className="text-primary text-[11.5px] font-semibold disabled:opacity-50"
        >
          {pending ? "Ajout…" : "Ajouter"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          aria-label={`Écarter ${ghost.name}`}
          title="Écarter"
          className="text-subtle hover:bg-bad-soft hover:text-bad flex size-6 items-center justify-center rounded-[7px] disabled:opacity-50"
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
        "focus:border-primary focus:bg-background hover:border-border w-full min-w-0 rounded-[7px] border border-transparent bg-transparent px-2 py-1 outline-none",
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
        "num hover:text-primary text-right text-xs disabled:pointer-events-none",
        count === 0 ? "text-subtle" : "text-muted-foreground",
        className,
      )}
    >
      {count} txns
    </button>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs",
        destructive ? "text-bad hover:bg-bad-soft" : "hover:bg-accent",
      )}
    >
      <Icon className="size-3.5 flex-none" />
      {children}
    </button>
  );
}
