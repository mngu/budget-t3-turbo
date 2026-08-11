"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowLeftRightIcon } from "lucide-react";

import type { TransactionRow } from "@budget/api";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@budget/ui/dialog";
import { toast } from "@budget/ui/toast";

import { signedEuro } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";

/**
 * Marque d'un virement entre deux comptes suivis, posée à côté du libellé comme
 * la pastille « à revoir ».
 *
 * Deux états, et la nuance est tout l'intérêt du badge : la paire n'est
 * neutralisée dans les totaux que si ses **deux** jambes sont dans les comptes
 * affichés. Jumelle hors sélection, la ligne compte bel et bien comme une
 * entrée ou une sortie du périmètre regardé — le badge le dit alors autrement,
 * plutôt que de laisser croire à une ligne écartée.
 */
export function TransferBadge({ row }: { row: TransactionRow }) {
  const [open, setOpen] = useState(false);
  if (row.transferTwinBank === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          row.transferInScope
            ? `Virement interne vers ${row.transferTwinBank} — écarté des totaux`
            : `Virement vers ${row.transferTwinBank}, hors des comptes affichés — compté dans les totaux`
        }
        className={cn(
          "flex flex-none items-center gap-0.5 rounded-full border px-1.5 py-px text-label leading-3.5",
          row.transferInScope
            ? "border-border bg-surface-2 text-subtle"
            : "border-border text-muted-foreground",
        )}
      >
        <ArrowLeftRightIcon className="size-2.5" />
        {row.transferInScope ? "interne" : row.transferTwinBank}
      </button>

      <UnlinkDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}

function UnlinkDialog({
  row,
  open,
  onOpenChange,
}: {
  row: TransactionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [pending, setPending] = useState(false);

  const unlink = async () => {
    setPending(true);
    try {
      await trpcClient.transactions.unlinkTransfer.mutate({ id: row.id });
      await router.invalidate();
      toast.success("Les deux lignes comptent de nouveau dans les totaux.");
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Échec de la mise à jour.",
      );
    } finally {
      setPending(false);
    }
  };

  const signed = (row.direction === "debit" ? -1 : 1) * Number(row.amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        padded={false}
        className="w-95 max-w-[calc(100vw-2rem)] rounded-lg"
      >
        <DialogTitle className="label-caps border-border border-b p-3.5 pr-10 text-meta font-normal">
          Virement entre comptes
        </DialogTitle>
        <div className="p-3.5 text-control">
          <p className="text-muted-foreground">
            <span className="num">{signedEuro.format(signed)}</span> ·{" "}
            {row.bankName} ⇄ {row.transferTwinBank}
          </p>
          <p className="text-subtle mt-2 text-control">
            {row.transferInScope
              ? "Les deux lignes se compensent : elles sont écartées des totaux, de l'anneau et de la file « À revoir », mais restent dans ce relevé."
              : "L'autre jambe est hors des comptes affichés : cette ligne compte donc normalement dans les totaux du périmètre."}
          </p>
          <p className="text-subtle mt-2 text-control">
            Si ce n'en est pas un, la détection ne le proposera plus — la
            correction est définitive de son point de vue.
          </p>
        </div>
        <DialogFooter className="justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => void unlink()}
          >
            Ce n&apos;est pas un virement interne
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
