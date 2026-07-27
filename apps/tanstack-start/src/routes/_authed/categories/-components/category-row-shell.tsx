"use client";

import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";
import { CATEGORY_COLOR_PALETTE } from "@budget/validators";

import { useCategoryColor } from "~/component/category/lib/category-color";

// Coquille visuelle partagée par category-tree.tsx (brouillon de suggestions,
// rien n'est persisté avant "Appliquer") et category-overview-tree.tsx
// (catégories réelles, chaque action est une mutation immédiate) — seule la
// disposition (pastille + nom + slots optionnels + suppression) est
// mutualisée ; chaque appelant reste responsable de son propre modèle de
// données (état local vs mutations tRPC), volontairement pas fusionnés ici.
interface CategoryRowShellProps {
  // Absente pour une sous-catégorie du brouillon : elle n'affiche jamais de
  // pastille (héritage visuel du parent, voir transactionsRouter.byCategory).
  color?: string;
  // Fournir onColorChange rend la pastille cliquable (sélecteur de couleur
  // parmi CATEGORY_COLOR_PALETTE) au lieu d'un simple indicateur statique —
  // utilisé uniquement pour les catégories parentes de l'overview.
  onColorChange?: (hex: string) => void;
  // Ex. la Checkbox "activer" du brouillon — absente en mode overview.
  leading?: ReactNode;
  // L'Input du nom, possédé par l'appelant (onChange en brouillon,
  // commit-on-blur en overview — la coquille ne gère pas cette logique).
  nameInput: ReactNode;
  // Ex. le compteur "X txns" cliquable — absent pour une ligne parente du brouillon.
  trailing?: ReactNode;
  onDelete: () => void;
  deleteLabel: string;
  deleteSize?: "icon-sm" | "icon-xs";
}

export function CategoryRowShell({
  color,
  onColorChange,
  leading,
  nameInput,
  trailing,
  onDelete,
  deleteLabel,
  deleteSize = "icon-sm",
}: CategoryRowShellProps) {
  const resolve = useCategoryColor();
  return (
    <div className="flex items-center gap-2">
      {leading}
      <div className="flex flex-1 items-center gap-2">
        {color &&
          (onColorChange ? (
            <CategoryColorPicker color={color} onSelect={onColorChange} />
          ) : (
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: resolve(color) }}
            />
          ))}
        {nameInput}
      </div>
      {trailing}
      <Button
        variant="ghost"
        size={deleteSize}
        aria-label={deleteLabel}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </div>
  );
}

function CategoryColorPicker({
  color,
  onSelect,
}: {
  color: string;
  onSelect: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const resolve = useCategoryColor();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={(props) => (
          <button
            {...props}
            type="button"
            aria-label="Changer la couleur"
            className="ring-offset-background hover:ring-ring size-2.5 shrink-0 rounded-full ring-offset-2 hover:ring-2"
            style={{ backgroundColor: resolve(color) }}
          />
        )}
      />
      <PopoverContent className="w-auto p-2">
        {/* La pastille affiche le pas du mode courant, mais la sélection et la
            comparaison portent toujours sur la valeur light canonique. */}
        <div className="grid grid-cols-5 gap-1.5">
          {CATEGORY_COLOR_PALETTE.map((c) => (
            <button
              key={c.light}
              type="button"
              aria-label={c.name}
              onClick={() => {
                onSelect(c.light);
                setOpen(false);
              }}
              className={cn(
                "ring-offset-popover size-6 rounded-full",
                c.light === color && "ring-ring ring-2 ring-offset-2",
              )}
              style={{ backgroundColor: resolve(c.light) }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AddCategoryButton({
  label,
  onClick,
  variant,
  size,
  className,
}: {
  label: string;
  onClick: () => void;
} & Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
    >
      <PlusIcon />
      {label}
    </Button>
  );
}
