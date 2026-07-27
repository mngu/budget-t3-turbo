"use client";

import { cn } from "@budget/ui";
import { Checkbox } from "@budget/ui/checkbox";
import { Input } from "@budget/ui/input";
import { FALLBACK_CATEGORY_COLOR } from "@budget/validators";

import { AddCategoryButton, CategoryRowShell } from "./category-row-shell";

export interface EditableChild {
  id: number;
  name: string;
  txnIds: number[];
  enabled: boolean;
}

export interface EditableParent {
  id: number;
  name: string;
  // Couleur proposée par le LLM (voir suggest-categories-core.ts), toujours
  // un membre de CATEGORY_COLOR_HEXES pour une suggestion générée — lecture
  // seule ici, pas de sélecteur pour la changer dans cette itération.
  // FALLBACK_CATEGORY_COLOR pour une catégorie ajoutée manuellement.
  color: string;
  children: EditableChild[];
}

// Compteur simple (pas crypto.randomUUID) : les ids ne servent qu'en interne
// (clés React, identité des lignes en cours d'édition), pas besoin d'aléatoire.
let nextEditableId = 0;
export function newEditableId(): number {
  return nextEditableId++;
}

interface CategoryTreeProps {
  parents: EditableParent[];
  onChange: (parents: EditableParent[]) => void;
  onPreview: (title: string, txnIds: number[]) => void;
}

export function CategoryTree({
  parents,
  onChange,
  onPreview,
}: CategoryTreeProps) {
  const renameParent = (id: number, name: string) =>
    onChange(parents.map((p) => (p.id === id ? { ...p, name } : p)));

  const removeParent = (id: number) =>
    onChange(parents.filter((p) => p.id !== id));

  const addChild = (parentId: number) =>
    onChange(
      parents.map((p) =>
        p.id === parentId
          ? {
              ...p,
              children: [
                ...p.children,
                { id: newEditableId(), name: "", txnIds: [], enabled: true },
              ],
            }
          : p,
      ),
    );

  const renameChild = (parentId: number, childId: number, name: string) =>
    onChange(
      parents.map((p) =>
        p.id === parentId
          ? {
              ...p,
              children: p.children.map((c) =>
                c.id === childId ? { ...c, name } : c,
              ),
            }
          : p,
      ),
    );

  const toggleChild = (parentId: number, childId: number, enabled: boolean) =>
    onChange(
      parents.map((p) =>
        p.id === parentId
          ? {
              ...p,
              children: p.children.map((c) =>
                c.id === childId ? { ...c, enabled } : c,
              ),
            }
          : p,
      ),
    );

  const removeChild = (parentId: number, childId: number) =>
    onChange(
      parents.map((p) =>
        p.id === parentId
          ? { ...p, children: p.children.filter((c) => c.id !== childId) }
          : p,
      ),
    );

  const addParent = () =>
    onChange([
      ...parents,
      {
        id: newEditableId(),
        name: "Nouvelle catégorie",
        color: FALLBACK_CATEGORY_COLOR,
        children: [
          { id: newEditableId(), name: "", txnIds: [], enabled: true },
        ],
      },
    ]);

  return (
    <div className="flex flex-col gap-3">
      {parents.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Aucune catégorie proposée — ajoutez-en une manuellement ci-dessous.
        </p>
      )}
      {parents.map((parent) => (
        <div key={parent.id} className="rounded-lg border p-3">
          <CategoryRowShell
            color={parent.color}
            nameInput={
              <Input
                value={parent.name}
                onChange={(e) => renameParent(parent.id, e.target.value)}
                aria-label="Nom de la catégorie"
                className="focus-visible:border-input h-7 max-w-xs border-transparent bg-transparent font-medium shadow-none"
              />
            }
            onDelete={() => removeParent(parent.id)}
            deleteLabel="Supprimer la catégorie"
          />

          <ul className="mt-2 flex flex-col gap-1 pl-5">
            {parent.children.map((child) => (
              <li key={child.id}>
                <CategoryRowShell
                  leading={
                    <Checkbox
                      checked={child.enabled}
                      onCheckedChange={(checked) =>
                        toggleChild(parent.id, child.id, checked)
                      }
                      aria-label={`Activer ${child.name || "la sous-catégorie"}`}
                    />
                  }
                  nameInput={
                    <Input
                      value={child.name}
                      onChange={(e) =>
                        renameChild(parent.id, child.id, e.target.value)
                      }
                      placeholder="Nom de la sous-catégorie"
                      aria-label="Nom de la sous-catégorie"
                      className={cn(
                        "focus-visible:border-input h-7 max-w-xs border-transparent bg-transparent shadow-none",
                        !child.enabled && "text-muted-foreground line-through",
                      )}
                    />
                  }
                  trailing={
                    <button
                      type="button"
                      className="text-muted-foreground shrink-0 text-xs hover:underline disabled:pointer-events-none disabled:opacity-50"
                      disabled={child.txnIds.length === 0}
                      onClick={() =>
                        onPreview(child.name || "Sous-catégorie", child.txnIds)
                      }
                    >
                      {child.txnIds.length} txns
                    </button>
                  }
                  onDelete={() => removeChild(parent.id, child.id)}
                  deleteLabel="Supprimer la sous-catégorie"
                  deleteSize="icon-xs"
                />
              </li>
            ))}
          </ul>

          <AddCategoryButton
            label="Ajouter une sous-catégorie"
            onClick={() => addChild(parent.id)}
            variant="ghost"
            size="sm"
            className="mt-1 ml-5"
          />
        </div>
      ))}

      <AddCategoryButton
        label="Ajouter une catégorie"
        onClick={addParent}
        variant="outline"
        className="self-start"
      />
    </div>
  );
}
