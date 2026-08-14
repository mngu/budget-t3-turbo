"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { EyeOffIcon } from "lucide-react";

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
 * Exclusion manuelle d'une transaction, posée dans le même emplacement que
 * `TransferBadge` et sur le même modèle : une marque à côté du libellé, qui
 * ouvre un dialogue expliquant ce que la ligne cesse de peser.
 *
 * Une différence : la marque doit exister **avant** l'exclusion, sinon rien ne
 * permettrait de la poser. Tant que la ligne compte, le bouton n'apparaît qu'au
 * survol de la ligne (`group-hover`, le `group` est sur la ligne elle-même) ;
 * une fois exclue, il reste visible — c'est ce qui explique un montant absent
 * des totaux.
 */
export function ExcludeBadge({ row }: { row: TransactionRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          row.excluded
            ? "Exclue des analyses — cette ligne ne compte dans aucun total"
            : "Exclure des analyses"
        }
        className={cn(
          "text-label flex flex-none items-center gap-0.5 rounded-full border px-1.5 py-px leading-3.5",
          row.excluded
            ? "border-border bg-surface-2 text-subtle"
            : "border-border text-subtle opacity-0 group-hover:opacity-100",
        )}
      >
        <EyeOffIcon className="size-2.5" />
        {row.excluded && "exclue"}
      </button>

      <ExcludeDialog row={row} open={open} onOpenChange={setOpen} />
    </>
  );
}

function ExcludeDialog({
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

  const toggle = async () => {
    setPending(true);
    try {
      await trpcClient.transactions.setExcluded.mutate({
        id: row.id,
        excluded: !row.excluded,
      });
      await router.invalidate();
      toast.success(
        row.excluded
          ? "La ligne compte de nouveau dans les analyses."
          : "La ligne est écartée des analyses.",
      );
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
        <DialogTitle className="label-caps border-border text-meta border-b p-3.5 pr-10 font-normal">
          {row.excluded ? "Réintégrer aux analyses" : "Exclure des analyses"}
        </DialogTitle>
        <div className="text-control p-3.5">
          <p className="text-muted-foreground">
            <span className="num">{signedEuro.format(signed)}</span> ·{" "}
            {row.description}
          </p>
          <p className="text-subtle text-control mt-2">
            {row.excluded
              ? "Elle pèsera de nouveau dans les totaux, l'anneau, les moyennes et les budgets."
              : "Elle ne pèsera plus dans les totaux, l'anneau, les moyennes ni les budgets, et restera dans ce relevé — c'est le seul endroit d'où la reprendre."}
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
            onClick={() => void toggle()}
          >
            {row.excluded ? "Réintégrer" : "Exclure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
