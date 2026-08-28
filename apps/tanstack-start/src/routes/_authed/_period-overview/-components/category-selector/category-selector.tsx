import { TagIcon } from "lucide-react";
import { useState } from "react";

import {
  NewCategoryOverviewChild,
  NewCategoryOverviewElementType,
} from "@budget/api/schemas";
import { Button } from "@budget/ui/button";
import { CategoryIcon } from "~/component/category-icon";

import { CategoryPathPicker } from "./category-path-picker";

export type SelectedCategory = {
  parent: Pick<
    NewCategoryOverviewElementType,
    "id" | "name" | "color" | "icon"
  >;
  child?: Pick<NewCategoryOverviewChild, "name">;
};

type CategorySelectorProps = {
  /** Sélection courante, **détenue par l'appelant** : ici l'URL. Pas d'état
   *  local qui la double — il ne saurait rien du « ✕ » ni d'un retour arrière. */
  value?: SelectedCategory;
  onChange?: (selectedCategory?: SelectedCategory) => void;
};

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const label = !value
    ? "Choisir une catégorie"
    : `${value.child?.name ?? value.parent.name ?? "Sans catégorie"}`;

  const labelIcon = !value ? (
    <TagIcon className="size-3" />
  ) : (
    <CategoryIcon
      name={value.parent.icon}
      className="size-3"
      color={value.parent.color}
    />
  );

  return (
    <>
      <Button variant="secondary" onClick={() => setIsOpen(true)}>
        {labelIcon} {label}
        <span className="text-subtle text-label ml-auto flex-none">▾</span>
      </Button>
      <CategoryPathPicker
        open={isOpen}
        onOpenChange={setIsOpen}
        current={value}
        onPick={(category) => onChange?.(category)}
      />
    </>
  );
}
