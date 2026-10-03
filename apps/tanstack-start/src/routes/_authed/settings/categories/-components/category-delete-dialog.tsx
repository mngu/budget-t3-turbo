"use client";

import type { DeleteTarget } from "../-lib/use-category-crud";

import { AlertDialog, Button, Chip, Spinner } from "@heroui/react";

import { DialogFacts } from "~/component/dialog-facts";

export function CategoryDeleteDialog({
  target,
  deleting,
  onOpenChange,
  onConfirm,
}: {
  target: DeleteTarget | null;
  deleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const facts = target
    ? [
        target.childCount > 0 && {
          n: target.childCount,
          label: "sous-catégorie(s) seront aussi supprimée(s)",
        },
        target.transactionCount > 0 && {
          n: target.transactionCount,
          label:
            target.childCount > 0
              ? "transaction(s), y compris dans les sous-catégories, deviendront sans catégorie"
              : "transaction(s) deviendront sans catégorie",
        },
      ].filter((f): f is { n: number; label: string } => f !== false)
    : [];

  return (
    <AlertDialog.Backdrop isOpen={target !== null} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>
              Supprimer « {target?.name} » ?
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-4">
            <p>
              Cette action est irréversible. Les transactions ne sont pas
              supprimées, elles redeviennent sans catégorie.
            </p>
            {facts.length > 0 && <DialogFacts facts={facts} />}
            {target && target.childNames.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {target.childNames.map((name) => (
                  <Chip key={name} size="sm">
                    {name}
                  </Chip>
                ))}
              </div>
            )}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Annuler
            </Button>
            <Button variant="danger" isPending={deleting} onPress={onConfirm}>
              {deleting && <Spinner color="current" size="sm" />}
              Supprimer
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
