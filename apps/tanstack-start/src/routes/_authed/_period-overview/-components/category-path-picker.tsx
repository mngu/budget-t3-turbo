"use client";

import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import type { CategoryTreeNode } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@budget/ui/command";

import { CategoryIcon } from "~/component/category-icon";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useTRPC } from "~/lib/trpc";

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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
  /** Nom de la catégorie actuellement portée par la transaction. */
  current?: string | null;
  onPick: (name: string) => void;
}) {
  const paths = useCategoryPaths();

  // Les chemins arrivent à plat mais viennent déjà groupés par parente
  // (`flattenTree` émet la parente puis ses enfants) : il suffit de recoller les
  // suites, sans trier ni indexer.
  const groups = paths.reduce<
    { parent: CategoryPath; items: CategoryPath[] }[]
  >((acc, path) => {
    const last = acc.at(-1);
    if (last && last.parent.parent === path.parent) last.items.push(path);
    else acc.push({ parent: path, items: [path] });
    return acc;
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={subtitle ?? "Choisissez la catégorie à appliquer."}
      showCloseButton
      className="w-120"
    >
      {subtitle && (
        <div className="border-border num text-meta truncate border-b px-3 py-2">
          {subtitle}
        </div>
      )}

      {/* Le champ, le filtrage flou et l'état vide viennent avec `Command` :
          l'état `query` et le `.filter()` maison ont disparu avec eux. */}
      <CommandInput placeholder={`Filtrer parmi ${paths.length} catégories…`} />
      <CommandList>
        <CommandEmpty>Aucune catégorie ne correspond.</CommandEmpty>

        {groups.map(({ parent, items }) => (
          <CommandGroup
            key={parent.parent}
            heading={
              <span className="flex items-center gap-1.5">
                <span style={{ color: parent.parentColor }}>
                  <CategoryIcon name={parent.parentIcon} className="size-3" />
                </span>
                {parent.parent}
              </span>
            }
          >
            {items.map((path) => (
              <CommandItem
                key={path.name}
                // Le chemin entier est la valeur cherchée : taper le nom d'une
                // parente remonte donc toutes ses sous-catégories.
                value={`${path.parent} › ${path.sub}`}
                // La coche de `CommandItem` marque la catégorie actuelle. Un
                // fond aurait été ambigu : `data-selected` est déjà le surlignage
                // du clavier.
                data-checked={path.name === current}
                onSelect={() => {
                  onPick(path.name);
                  onOpenChange(false);
                }}
              >
                <span
                  className="size-2.5 flex-none rounded-xs"
                  style={{ background: path.color }}
                />
                {path.sub}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
