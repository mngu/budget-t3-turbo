"use client";

import { Loader2Icon, TriangleAlertIcon } from "lucide-react";

import type { ConnectionSummary } from "@budget/api";
import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";

export function RevokeDialog({
  connection,
  revoking,
  onOpenChange,
  onConfirm,
}: {
  connection: ConnectionSummary | null;
  revoking: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  // Chiffres d'abord, phrase ensuite : ce qui décide, c'est le nombre de comptes
  // qui cessent d'être synchronisés — et le fait que rien n'est supprimé.
  const facts = connection
    ? [
        {
          n: connection.accounts.filter((a) => a.enabled).length,
          label: "compte(s) cesseront d'être synchronisés",
          tone: "text-bad",
        },
        {
          n: 0,
          label: "transaction supprimée — l'historique importé reste en place",
          tone: "text-ok",
        },
      ]
    : [];

  return (
    <Dialog open={connection !== null} onOpenChange={onOpenChange}>
      <DialogContent className="border-bad max-w-[470px] gap-0 overflow-hidden p-0">
        <DialogHeader className="bg-bad-soft border-bad flex-row items-center gap-2.5 border-b px-3.5 py-3">
          <TriangleAlertIcon className="text-bad size-4 flex-none" />
          <DialogTitle className="text-[13px] font-semibold">
            Révoquer « {connection?.aspspName} » ?
          </DialogTitle>
        </DialogHeader>

        <div className="px-3.5 py-3.5">
          <DialogDescription className="text-muted-foreground text-[12.5px] text-pretty">
            L'autorisation est annulée immédiatement chez votre banque. La
            synchronisation s'arrête ; il faudra repasser par une
            authentification forte pour la rétablir.
          </DialogDescription>
          <div className="mt-3 flex flex-col gap-2">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-2.5"
              >
                <span
                  className={`num text-right text-sm font-medium ${fact.tone}`}
                >
                  {fact.n}
                </span>
                <span className="text-muted-foreground text-xs">
                  {fact.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-sunken flex items-center gap-2.5 border-t px-3.5 py-3">
          <span className="text-subtle text-[11px]">
            Les transactions déjà importées sont conservées.
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
            disabled={revoking}
            onClick={onConfirm}
          >
            {revoking && <Loader2Icon className="animate-spin" />}
            Révoquer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
