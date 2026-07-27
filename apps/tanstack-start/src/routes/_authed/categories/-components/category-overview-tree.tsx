"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";

import type { CategoryOption, CategoryOverviewNode } from "@budget/api";
import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";
import { Input } from "@budget/ui/input";
import { toast } from "@budget/ui/toast";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

import type { PreviewableTransaction } from "./transaction-preview-drawer";
import { useTRPCClient } from "~/lib/trpc";
import { AddCategoryButton, CategoryRowShell } from "./category-row-shell";
import { TransactionPreviewDrawer } from "./transaction-preview-drawer";

interface CategoryOverviewTreeProps {
  tree: CategoryOverviewNode[];
}

export function CategoryOverviewTree({ tree }: CategoryOverviewTreeProps) {
  const trpcClient = useTRPCClient();
  const router = useRouter();
  const [preview, setPreview] = useState<{
    title: string;
    txns: PreviewableTransaction[];
    includesChildren: boolean;
  } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: number;
    name: string;
    transactionCount: number;
    childCount: number;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openPreview = async (
    categoryName: string,
    includesChildren: boolean,
  ) => {
    const result = await trpcClient.transactions.list.query({
      page: 1,
      sort: "date",
      order: "desc",
      category: categoryName,
    });
    setPreview({ title: categoryName, txns: result.rows, includesChildren });
  };

  const rename = async (id: number, name: string) => {
    try {
      await trpcClient.categories.rename.mutate({ id, name });
      await router.invalidate();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du renommage.");
      return false;
    }
  };

  const create = async (name: string, parentId: number | null) => {
    try {
      await trpcClient.categories.create.mutate({ name, parentId });
      await router.invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de la création.");
    }
  };

  const updateColor = async (id: number, color: string) => {
    try {
      await trpcClient.categories.updateColor.mutate({ id, color });
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec du changement de couleur.",
      );
    }
  };

  const confirmRemove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await trpcClient.categories.remove.mutate({ id: confirmDelete.id });
      toast.success(`"${confirmDelete.name}" supprimée.`);
      setConfirmDelete(null);
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la suppression.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const previewDescription = preview
    ? `${preview.txns.length} transaction${preview.txns.length > 1 ? "s" : ""} — aperçu de cette catégorie (25 plus récentes)${preview.includesChildren ? ", y compris les sous-catégories" : ""}.`
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      {tree.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Aucune catégorie pour le moment.
        </p>
      )}
      {tree.map((parent) => (
        <div key={parent.id} className="rounded-lg border p-3">
          <CategoryRow
            node={parent}
            onRename={(name) => rename(parent.id, name)}
            onColorChange={(color) => updateColor(parent.id, color)}
            onPreview={() =>
              openPreview(parent.name, parent.children.length > 0)
            }
            onDelete={() =>
              setConfirmDelete({
                id: parent.id,
                name: parent.name,
                transactionCount: parent.transactionCount,
                childCount: parent.children.length,
              })
            }
          />
          {parent.children.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 pl-5">
              {parent.children.map((child) => (
                <li key={child.id}>
                  <CategoryRow
                    node={child}
                    onRename={(name) => rename(child.id, name)}
                    onPreview={() => openPreview(child.name, false)}
                    onDelete={() =>
                      setConfirmDelete({
                        id: child.id,
                        name: child.name,
                        transactionCount: child.transactionCount,
                        childCount: 0,
                      })
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <AddCategoryButton
            label="Ajouter une sous-catégorie"
            onClick={() => create("Nouvelle sous-catégorie", parent.id)}
            variant="ghost"
            size="sm"
            className="mt-1 ml-5"
          />
        </div>
      ))}

      <AddCategoryButton
        label="Ajouter une catégorie"
        onClick={() => create("Nouvelle catégorie", null)}
        variant="outline"
        className="self-start"
      />

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer « {confirmDelete?.name} » ?</DialogTitle>
            <DialogDescription>
              Cette action est irréversible.
              {confirmDelete && confirmDelete.childCount > 0 && (
                <>
                  {" "}
                  {confirmDelete.childCount} sous-catégorie(s) seront aussi
                  supprimée(s).
                </>
              )}
              {confirmDelete && confirmDelete.transactionCount > 0 && (
                <>
                  {" "}
                  {confirmDelete.transactionCount} transaction(s)
                  {confirmDelete.childCount > 0
                    ? " (y compris dans les sous-catégories)"
                    : ""}{" "}
                  deviendront non-catégorisées.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemove}
              disabled={deleting}
            >
              Supprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionPreviewDrawer
        open={preview !== null}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        transactions={preview?.txns ?? []}
        description={previewDescription}
      />
    </div>
  );
}

// Ligne réutilisable pour un parent ou un enfant : nom éditable (commit au
// blur/Enter), compteur de transactions cliquable (aperçu), suppression.
function CategoryRow({
  node,
  onRename,
  onColorChange,
  onPreview,
  onDelete,
}: {
  node: CategoryOption & { transactionCount: number };
  onRename: (name: string) => Promise<boolean>;
  onColorChange?: (color: string) => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const [value, setValue] = useState(node.name);

  const commit = async () => {
    const trimmed = value.trim();
    if (trimmed === node.name || trimmed.length === 0) {
      setValue(node.name);
      return;
    }
    const ok = await onRename(trimmed);
    if (!ok) setValue(node.name);
  };

  return (
    <CategoryRowShell
      color={
        node.color ?? (onColorChange ? FALLBACK_CATEGORY_COLOR : undefined)
      }
      onColorChange={onColorChange}
      nameInput={
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          aria-label="Nom de la catégorie"
          className="focus-visible:border-input h-7 max-w-xs border-transparent bg-transparent font-medium shadow-none"
        />
      }
      trailing={
        <button
          type="button"
          className="text-muted-foreground shrink-0 text-xs hover:underline disabled:pointer-events-none disabled:opacity-50"
          disabled={node.transactionCount === 0}
          onClick={onPreview}
        >
          {node.transactionCount} txn{node.transactionCount > 1 ? "s" : ""}
        </button>
      }
      onDelete={onDelete}
      deleteLabel="Supprimer la catégorie"
    />
  );
}
