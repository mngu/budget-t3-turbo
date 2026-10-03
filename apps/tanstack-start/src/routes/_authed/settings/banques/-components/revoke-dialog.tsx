"use client";

import type { ConnectionSummary } from "@budget/api";

import { AlertDialog, Button, Spinner } from "@heroui/react";

import { DialogFacts } from "~/component/dialog-facts";

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
          tone: "text-danger",
        },
        {
          n: 0,
          label: "transaction supprimée — l'historique importé reste en place",
          tone: "text-success",
        },
      ]
    : [];

  return (
    <AlertDialog.Backdrop
      isOpen={connection !== null}
      onOpenChange={onOpenChange}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>
              Révoquer « {connection?.aspspName} » ?
            </AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-4">
            <p>
              L&apos;autorisation est annulée immédiatement chez votre banque.
              La synchronisation s&apos;arrête ; il faudra repasser par une
              authentification forte pour la rétablir.
            </p>
            <DialogFacts facts={facts} />
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button slot="close" variant="tertiary">
              Annuler
            </Button>
            <Button variant="danger" isPending={revoking} onPress={onConfirm}>
              {revoking && <Spinner color="current" size="sm" />}
              Révoquer
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
