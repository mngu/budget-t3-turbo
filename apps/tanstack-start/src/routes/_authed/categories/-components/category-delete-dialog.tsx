"use client";

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";

export interface DeleteTarget {
  id: number;
  name: string;
  /** Total cumulé — sous-catégories comprises pour une parente. */
  transactionCount: number;
  childCount: number;
  childNames: string[];
}

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
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="border-bad max-w-[470px] gap-0 overflow-hidden p-0">
        <DialogHeader className="bg-bad-soft border-bad flex-row items-center gap-2.5 border-b px-3.5 py-3">
          <TriangleAlertIcon className="text-bad size-4 flex-none" />
          <DialogTitle className="text-[13px] font-semibold">
            Supprimer « {target?.name} » ?
          </DialogTitle>
        </DialogHeader>

        <div className="px-3.5 py-3.5">
          <DialogDescription className="text-muted-foreground text-[12.5px]">
            Cette action est irréversible.
          </DialogDescription>
          {facts.length > 0 && (
            <div className="mt-3 flex flex-col gap-2">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-2.5"
                >
                  <span className="num text-bad text-right text-sm font-medium">
                    {fact.n}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {fact.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          {target && target.childNames.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-3">
              {target.childNames.map((name) => (
                <span
                  key={name}
                  className="text-muted-foreground bg-sunken rounded-md border px-1.5 py-px text-[11px]"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-sunken flex items-center gap-2.5 border-t px-3.5 py-3">
          <span className="text-subtle text-[11px]">
            Les transactions ne sont pas supprimées, elles redeviennent sans
            catégorie.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting && <Loader2Icon className="animate-spin" />}
            Supprimer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
