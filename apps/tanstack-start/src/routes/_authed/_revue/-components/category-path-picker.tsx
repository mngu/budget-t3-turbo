"use client";

import { useMemo, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { CategoryTreeNode } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";
import { Dialog, DialogContent, DialogTitle } from "@budget/ui/dialog";
import { Input } from "@budget/ui/input";

import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useTRPC } from "~/lib/trpc";
import { CategoryIcon } from "../../categories/-components/category-icon";

export interface CategoryPath {
  /** Catégorie parente. */
  parent: string;
  /** Sous-catégorie, ou le libellé de repli quand la cible est le parent. */
  sub: string;
  /** Nom réellement écrit en base — c'est lui que la mutation attend. */
  name: string;
  color: string;
  /** Icône de la parente : elle porte l'identité de la famille entière. */
  parentIcon: string | null;
  /** Teinte pleine de la parente, pour son icône (la ligne, elle, se nuance). */
  parentColor: string;
}

// Rattacher une transaction à la catégorie parente, c'est précisément ce que la
// revue appelle « à classer » : le choix reste offert (toutes les catégories
// n'ont pas de sous-catégories) mais il est nommé pour ce qu'il est.
const PARENT_SUB_LABEL = "Sans sous-catégorie";

export function useCategoryPaths(): CategoryPath[] {
  const trpc = useTRPC();
  const { data: tree } = useSuspenseQuery(trpc.categories.tree.queryOptions());
  const resolveColor = useCategoryColor();

  return useMemo(() => flattenTree(tree, resolveColor), [tree, resolveColor]);
}

function flattenTree(
  tree: CategoryTreeNode[],
  resolveColor: (hex: string) => string,
): CategoryPath[] {
  return tree.flatMap((parent) => {
    const base = resolveColor(parent.color ?? FALLBACK_CATEGORY_COLOR);
    const count = parent.children.length;
    return [
      {
        parent: parent.name,
        sub: PARENT_SUB_LABEL,
        name: parent.name,
        color: base,
        parentIcon: parent.icon,
        parentColor: base,
      },
      ...parent.children.map((child, i) => ({
        parent: parent.name,
        sub: child.name,
        name: child.name,
        color: shadeCategoryColor(base, i, count),
        parentIcon: parent.icon,
        parentColor: base,
      })),
    ];
  });
}

/**
 * Reclassement d'une transaction : la liste complète « Parent › Sous-catégorie »
 * filtrable au clavier, plutôt qu'un Select à deux niveaux.
 *
 * L'arborescence dépasse la cinquantaine d'entrées sur ce compte : dérouler
 * puis chercher à l'œil dans un Select y est plus lent que taper trois lettres.
 */
export function CategoryPathPicker({
  open,
  onOpenChange,
  title = "Reclasser",
  subtitle,
  current,
  onPick,
  filterOn,
  onFilter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  /** Nom de la catégorie actuellement portée par la transaction. */
  current?: string | null;
  onPick: (name: string) => void;
  /**
   * Parente de la transaction, pour le raccourci « Filtrer sur … » du pied de
   * modale. Absent = pas de pied : le raccourci pose un filtre de catégorie sur
   * la liste courante, ce qui n'a de sens que là où la liste *est* la sélection
   * (`/transactions`). Sur `/classer` ou le zoom d'une catégorie, il
   * restreindrait un écran qui porte déjà son propre périmètre.
   */
  filterOn?: string | null;
  onFilter?: (category: string) => void;
}) {
  const paths = useCategoryPaths();
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? paths.filter((p) =>
        `${p.parent} › ${p.sub}`.toLowerCase().includes(needle),
      )
    : paths;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="top-[92px] flex max-h-[530px] w-[480px] max-w-[calc(100vw-2rem)] translate-y-0 flex-col gap-0 overflow-hidden rounded-[14px] p-0"
        // La liste est le contenu : elle scrolle, l'en-tête et le pied restent.
        variant="modal"
      >
        <div className="border-border flex-none border-b p-3.5 pr-10">
          <DialogTitle className="label-caps text-[11px] font-normal">
            {title}
          </DialogTitle>
          {subtitle && (
            <div className="num mt-1 truncate text-[12.5px]">{subtitle}</div>
          )}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filtrer parmi ${paths.length} catégories…`}
            className="bg-background mt-2 h-[30px] rounded-lg text-[12.5px]"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {shown.map((path) => {
            const active = path.name === current;
            return (
              <button
                key={`${path.parent}/${path.name}`}
                type="button"
                onClick={() => {
                  onPick(path.name);
                  setQuery("");
                  onOpenChange(false);
                }}
                className={cn(
                  "hover:bg-accent grid w-full grid-cols-[14px_148px_minmax(0,1fr)_18px] items-center gap-2.5 rounded-lg px-2 py-1 text-left",
                  active && "bg-accent-soft",
                )}
              >
                <span
                  className="size-2.5 rounded-[2px]"
                  style={{ background: path.color }}
                />
                <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-[11.5px]">
                  <span
                    className="flex flex-none"
                    style={{ color: path.parentColor }}
                  >
                    <CategoryIcon
                      name={path.parentIcon}
                      className="size-[13px]"
                    />
                  </span>
                  <span className="truncate">{path.parent}</span>
                </span>
                <span
                  className={`truncate text-[12.5px] ${active ? "font-semibold" : ""}`}
                >
                  {path.sub}
                </span>
                <span className="text-primary text-[11px]">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
          {shown.length === 0 && (
            <p className="text-subtle p-4 text-center text-[11.5px]">
              Aucune catégorie ne correspond.
            </p>
          )}
        </div>

        <div className="border-border text-subtle flex flex-none items-center gap-3 border-t px-3.5 py-2 text-[11px]">
          {filterOn && onFilter && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground text-[11.5px]"
              onClick={() => {
                onFilter(filterOn);
                setQuery("");
                onOpenChange(false);
              }}
            >
              Filtrer sur {filterOn}
            </button>
          )}
          <button
            type="button"
            className="text-primary ml-auto text-[11.5px]"
            onClick={() => onOpenChange(false)}
          >
            Fermer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
