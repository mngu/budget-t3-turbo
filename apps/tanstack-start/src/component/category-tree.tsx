"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Checkbox } from "@budget/ui/checkbox";
import { Input } from "@budget/ui/input";

export interface EditableChild {
  id: number;
  name: string;
  txnIds: number[];
  enabled: boolean;
}

export interface EditableParent {
  id: number;
  name: string;
  children: EditableChild[];
}

// Compteur simple (pas crypto.randomUUID) : les ids ne servent qu'en interne
// (clés React, identité des lignes en cours d'édition), pas besoin d'aléatoire.
let nextEditableId = 0;
export function newEditableId(): number {
  return nextEditableId++;
}

const PARENT_COLORS = [
  "#6366f1",
  "#16a34a",
  "#f59e0b",
  "#ec4899",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f97316",
];

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
      {parents.map((parent, parentIndex) => (
        <div key={parent.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    PARENT_COLORS[parentIndex % PARENT_COLORS.length],
                }}
              />
              <Input
                value={parent.name}
                onChange={(e) => renameParent(parent.id, e.target.value)}
                aria-label="Nom de la catégorie"
                className="focus-visible:border-input h-7 max-w-xs border-transparent bg-transparent font-medium shadow-none"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Supprimer la catégorie"
              onClick={() => removeParent(parent.id)}
            >
              <Trash2Icon />
            </Button>
          </div>

          <ul className="mt-2 flex flex-col gap-1 pl-5">
            {parent.children.map((child) => (
              <li key={child.id} className="flex items-center gap-2">
                <Checkbox
                  checked={child.enabled}
                  onCheckedChange={(checked) =>
                    toggleChild(parent.id, child.id, checked)
                  }
                  aria-label={`Activer ${child.name || "la sous-catégorie"}`}
                />
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
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Supprimer la sous-catégorie"
                  onClick={() => removeChild(parent.id, child.id)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            size="sm"
            className="mt-1 ml-5"
            onClick={() => addChild(parent.id)}
          >
            <PlusIcon />
            Ajouter une sous-catégorie
          </Button>
        </div>
      ))}

      <Button variant="outline" onClick={addParent} className="self-start">
        <PlusIcon />
        Ajouter une catégorie
      </Button>
    </div>
  );
}
