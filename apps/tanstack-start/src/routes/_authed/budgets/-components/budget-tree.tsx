"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import type { CategoryBudgetRow, CategoryTreeNode } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@budget/ui/collapsible";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/ui/tooltip";

import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro0 } from "~/lib/format";
import { CategoryIcon } from "../../categories/-components/category-icon";

/**
 * La même liste que `/categories`, mais en lecture : ici on ne range pas les
 * catégories, on leur pose un montant. Rien n'y est éditable sauf les budgets —
 * renommer, recolorier, supprimer restent sur `/categories`, et c'est ce qui
 * garde ce composant petit là où `CategoryOverviewTree` porte tout le reste.
 */
export interface BudgetTreeProps {
  tree: CategoryTreeNode[];
  /** Montant, mode détaillé et moyenne de référence, par catégorie. */
  rows: Map<number, CategoryBudgetRow>;
  onSetAmount: (categoryId: number, amount: number | null) => void;
  onSetDetailed: (categoryId: number, detailed: boolean) => void;
  expandAllSignal: boolean | null;
}

/**
 * Une parente sans sous-catégorie porte toujours son budget elle-même, quel que
 * soit le drapeau enregistré — même règle que `budgetSlots` côté API, sans quoi
 * son budget disparaîtrait de l'écran mais pas des compteurs.
 */
function isDetailed(rows: BudgetTreeProps["rows"], parent: CategoryTreeNode) {
  return parent.children.length > 0 && (rows.get(parent.id)?.detailed ?? false);
}

export function BudgetTree({
  tree,
  rows,
  onSetAmount,
  onSetDetailed,
  expandAllSignal,
}: BudgetTreeProps) {
  // Même idiome que `CategoryOverviewTree` : « Tout replier / déplier » doit
  // *effacer* les plis posés un par un, sinon une ligne repliée à la main
  // resterait sourde au bouton global.
  const [folds, setFolds] = useState<{
    overrides: Record<number, boolean>;
    signal: boolean | null;
  }>({ overrides: {}, signal: expandAllSignal });
  if (folds.signal !== expandAllSignal) {
    setFolds({ overrides: {}, signal: expandAllSignal });
  }

  if (tree.length === 0) {
    return (
      <div className="bg-card rounded-lg border px-5 py-11 text-center">
        <div className="text-body font-medium">
          Aucune catégorie pour le moment
        </div>
        <p className="text-muted-foreground mx-auto mt-1.5 max-w-105 text-control text-pretty">
          Un budget se pose sur une catégorie : créez-en d'abord depuis l'écran
          Catégories.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      {tree.map((parent) => {
        const detailed = isDetailed(rows, parent);
        // Par défaut, seule une parente détaillée s'ouvre : elle seule a
        // quelque chose à saisir en dessous.
        const expanded =
          folds.overrides[parent.id] ?? expandAllSignal ?? detailed;

        return (
          <ParentRow
            key={parent.id}
            parent={parent}
            rows={rows}
            detailed={detailed}
            expanded={expanded}
            onToggle={() =>
              setFolds((f) => ({
                ...f,
                overrides: { ...f.overrides, [parent.id]: !expanded },
              }))
            }
            onSetAmount={onSetAmount}
            onSetDetailed={onSetDetailed}
          />
        );
      })}
    </div>
  );
}

function ParentRow({
  parent,
  rows,
  detailed,
  expanded,
  onToggle,
  onSetAmount,
  onSetDetailed,
}: {
  parent: CategoryTreeNode;
  rows: BudgetTreeProps["rows"];
  detailed: boolean;
  expanded: boolean;
  onToggle: () => void;
} & Pick<BudgetTreeProps, "onSetAmount" | "onSetDetailed">) {
  const resolve = useCategoryColor();
  const color = resolve(parent.color ?? FALLBACK_CATEGORY_COLOR);
  const childAmounts = parent.children.map(
    (child) => rows.get(child.id)?.amount ?? null,
  );
  const missing = childAmounts.filter((a) => a === null).length;

  // Le pli est contrôlé : l'état vit dans `BudgetTree` (`folds.overrides` +
  // le signal « tout replier »). `Collapsible` n'apporte donc pas l'état mais
  // le contrat — `aria-expanded` et `aria-controls` sur le déclencheur, que le
  // chevron portait au mieux par un `aria-label`.
  return (
    <Collapsible
      open={expanded}
      onOpenChange={onToggle}
      render={<div className="border-b last:border-b-0" />}
    >
      <div className="hover:bg-surface-2 grid min-h-11 grid-cols-[20px_30px_minmax(150px,1fr)_auto_224px_148px] items-center gap-2 px-3">
        <CollapsibleTrigger
          disabled={parent.children.length === 0}
          aria-label={expanded ? "Replier" : "Déplier"}
          className={cn(
            "text-subtle hover:bg-accent hover:text-foreground flex size-5 items-center justify-center rounded-md",
            parent.children.length === 0 && "invisible",
          )}
        >
          {expanded ? (
            <ChevronDownIcon className="size-2.5" />
          ) : (
            <ChevronRightIcon className="size-2.5" />
          )}
        </CollapsibleTrigger>

        <span
          className="flex size-8 items-center justify-center rounded-md border border-transparent"
          style={{ background: softCategoryColor(color), color }}
        >
          <CategoryIcon name={parent.icon} />
        </span>

        <span className="truncate text-body font-medium">{parent.name}</span>

        <span className="text-subtle text-meta whitespace-nowrap">
          {parent.children.length === 0 && "aucune sous-catégorie"}
        </span>

        <div className="flex items-center justify-end gap-2">
          {detailed ? (
            // Une parente détaillée n'a pas de montant à elle : elle affiche la
            // somme de ses sous-catégories, et ce qui reste à y saisir.
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "num text-meta font-medium",
                  missing > 0 && "text-muted-foreground",
                )}
              >
                {euro0.format(
                  childAmounts.reduce((sum: number, a) => sum + (a ?? 0), 0),
                )}{" "}
                /mois
              </span>
              <span className="text-subtle text-label whitespace-nowrap">
                {missing > 0
                  ? `${missing} sous-cat. à remplir`
                  : `somme de ${parent.children.length} sous-cat.`}
              </span>
            </div>
          ) : (
            <BudgetAmount
              row={rows.get(parent.id)}
              onSet={(amount) => onSetAmount(parent.id, amount)}
            />
          )}
        </div>

        {parent.children.length > 0 && (
          // `onValueChange` ne peut pas rendre un tableau vide ici : décocher
          // l'option active la re-sélectionne, une parente est toujours dans
          // l'un des deux régimes.
          <ToggleGroup
            size="sm"
            aria-label="Régime de budget"
            className="justify-self-end"
            value={[detailed ? "detailed" : "global"]}
            onValueChange={([value]) =>
              value && onSetDetailed(parent.id, value === "detailed")
            }
          >
            {/* Ces deux libellés ne se suffisent pas : c'est l'infobulle qui
                dit ce que « détailler » change. Un `title` natif la ferait
                attendre une seconde, sans style et jamais au toucher. */}
            <Tooltip>
              <TooltipTrigger render={<ToggleGroupItem value="global" />}>
                Global
              </TooltipTrigger>
              <TooltipContent>
                Un seul budget pour toute la catégorie
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<ToggleGroupItem value="detailed" />}>
                Détaillé
              </TooltipTrigger>
              <TooltipContent>
                Un budget par sous-catégorie — la catégorie affiche leur somme
              </TooltipContent>
            </Tooltip>
          </ToggleGroup>
        )}
      </div>

      <CollapsibleContent className="pt-0.5 pb-2">
        {parent.children.map((child, i) => {
          const row = rows.get(child.id);
          return (
            <div
              key={child.id}
              className="hover:bg-surface-2 grid min-h-11 grid-cols-[61px_8px_minmax(0,1fr)_224px_148px] items-center gap-2 px-3"
            >
              <span />
              <span
                className="size-2 rounded-full"
                style={{
                  background: shadeCategoryColor(
                    color,
                    i,
                    parent.children.length,
                  ),
                }}
              />
              <span className="truncate px-2 text-control">{child.name}</span>
              <div className="flex items-center justify-end gap-2">
                {detailed ? (
                  <BudgetAmount
                    row={row}
                    onSet={(amount) => onSetAmount(child.id, amount)}
                  />
                ) : (
                  // Parente en budget global : la sous-catégorie n'a rien à
                  // saisir, mais sa moyenne dit d'où vient la somme.
                  <span className="num text-subtle text-meta whitespace-nowrap">
                    {row && row.average > 0
                      ? `moy. ${euro0.format(row.average)}`
                      : "—"}
                  </span>
                )}
              </div>
              <span />
            </div>
          );
        })}

        {parent.children.length === 0 && (
          <p className="text-muted-foreground px-3 pt-1.5 pb-1 pl-18 text-control">
            Aucune sous-catégorie : le budget se pose directement sur la
            catégorie.
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
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
        className="num border-border-strong bg-background focus:border-primary h-7 w-24 rounded-lg border px-2 pr-5 text-right text-meta font-medium outline-none"
      />
      <span className="text-subtle pointer-events-none absolute right-2 text-meta">
        €
      </span>
    </span>
  );
}
