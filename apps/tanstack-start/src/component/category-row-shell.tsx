"use client";

import type { ComponentProps, ReactNode } from "react";
import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@budget/ui/button";

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
  leading,
  nameInput,
  trailing,
  onDelete,
  deleteLabel,
  deleteSize = "icon-sm",
}: CategoryRowShellProps) {
  return (
    <div className="flex items-center gap-2">
      {leading}
      <div className="flex flex-1 items-center gap-2">
        {color && (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
        )}
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
