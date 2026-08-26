"use client";

import type { ConnectionSummary } from "@budget/api";

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
import { Spinner } from "@budget/ui/spinner";

/**
 * Confirmation de révocation — un `AlertDialog` et non un `Dialog` : le geste
 * est irréversible côté banque, le composant pose le rôle `alertdialog`, retient
 * le focus sur l'annulation et ignore le clic à côté.
 *
 * Chiffres d'abord, phrase ensuite : ce qui décide, c'est le nombre de comptes
 * qui cessent d'être synchronisés — et le fait que rien n'est supprimé.
 */
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
    <AlertDialog open={connection !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlertIcon className="text-destructive size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle>
            Révoquer « {connection?.aspspName} » ?
          </AlertDialogTitle>
          <AlertDialogDescription>
            L&apos;autorisation est annulée immédiatement chez votre banque. La
            synchronisation s&apos;arrête ; il faudra repasser par une
            authentification forte pour la rétablir.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="grid grid-cols-[56px_minmax(0,1fr)] items-baseline gap-2.5"
            >
              <span
                className={`num text-body text-right font-medium ${fact.tone}`}
              >
                {fact.n}
              </span>
              <span className="text-muted-foreground text-control">
                {fact.label}
              </span>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoking}
            onClick={onConfirm}
          >
            {revoking && <Spinner />}
            Révoquer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
