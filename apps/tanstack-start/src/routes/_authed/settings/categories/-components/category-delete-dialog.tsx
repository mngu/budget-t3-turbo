"use client";

import type { DeleteTarget } from "../-lib/use-category-crud";

import { TriangleAlertIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@budget/ui/alert-dialog";
import { Badge } from "@budget/ui/badge";
import { Spinner } from "@budget/ui/spinner";
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
  // Chiffres d'abord, phrase ensuite : ce qui décide, c'est le nombre de
  // transactions qui vont redevenir sans catégorie.
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
    <AlertDialog open={target !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlertIcon className="text-destructive size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>Supprimer « {target?.name} » ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Les transactions ne sont pas
            supprimées, elles redeviennent sans catégorie.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {facts.length > 0 && <DialogFacts facts={facts} />}

        {target && target.childNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {target.childNames.map((name) => (
              <Badge key={name} variant="outline">
                {name}
              </Badge>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting && <Spinner />}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
