import { Fragment } from "react";

import type { CategoryTreeNode } from "@budget/api";
import { SelectItem, SelectValue } from "@budget/ui/select";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

import { useCategoryColor } from "~/lib/category-color";

export function CategoryTreeSelectItems({
  categories,
}: {
  categories: CategoryTreeNode[];
}) {
  return categories.map((root) => (
    <Fragment key={root.id}>
      <SelectItem value={root.name}>
        <div className="flex items-center gap-2">
          <CategorySwatch color={root.color ?? FALLBACK_CATEGORY_COLOR} />
          {root.name}
        </div>
      </SelectItem>
      {root.children.map((child) => (
        <SelectItem key={child.id} value={child.name} className="pl-6">
          {child.name}
        </SelectItem>
      ))}
    </Fragment>
  ));
}

// Valeur sélectionnée du trigger : même pastille que dans la liste. Le Select
// ne connaît que le *nom* de la catégorie, d'où la table de correspondance.
export function CategorySelectValue({
  categories,
  placeholder,
}: {
  categories: CategoryTreeNode[];
  placeholder: string;
}) {
  const colors = colorByName(categories);
  return (
    <SelectValue className="items-center gap-2">
      {(value: string | null) => {
        if (value === null) return placeholder;
        // Un nom absent de l'arborescence garde son libellé, sans pastille :
        // ne jamais retomber sur le placeholder, ça masquerait une vraie valeur.
        const color = colors.get(value);
        return (
          <>
            {color !== undefined && <CategorySwatch color={color} />}
            {value}
          </>
        );
      }}
    </SelectValue>
  );
}

// Seules les catégories parentes portent une couleur en base (voir
// updateCategoryColor) : une sous-catégorie hérite visuellement de celle de son
// parent, exactement comme sa part dans le camembert (transactionsByCategory
// replie sur le parent).
function colorByName(categories: CategoryTreeNode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const root of categories) {
    const color = root.color ?? FALLBACK_CATEGORY_COLOR;
    map.set(root.name, color);
    for (const child of root.children) {
      map.set(child.name, child.color ?? color);
    }
  }
  return map;
}

function CategorySwatch({ color }: { color: string }) {
  const resolve = useCategoryColor();
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: resolve(color) }}
    />
  );
}
