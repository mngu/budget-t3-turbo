"use client";

import type { TransactionRow } from "@budget/api";

import { Button, Modal, toast } from "@heroui/react";
import { EyeOffIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@budget/ui";
import { signedAmount } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";
import { useFormat } from "~/lib/use-format";
import { useRun } from "~/lib/use-run";

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
          "text-label hit-area flex flex-none items-center gap-0.5 rounded-full border px-1.5 py-px leading-3.5",
          // Keep the action visible on touch screens, where hover is unavailable.
          row.excluded
            ? "border-border bg-surface-secondary text-muted"
            : "border-border text-muted md:opacity-0 md:group-hover:opacity-100",
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
  const { signedEuro } = useFormat();
  const trpcClient = useTRPCClient();
  const run = useRun();
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    setPending(true);
    const ok = await run(
      () =>
        trpcClient.transactions.setExcluded.mutate({
          id: row.id,
          excluded: !row.excluded,
        }),
      "Échec de la mise à jour.",
    );
    setPending(false);
    if (ok === null) return;
    toast.success(
      row.excluded
        ? "La ligne compte de nouveau dans les analyses."
        : "La ligne est écartée des analyses.",
    );
    onOpenChange(false);
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {row.excluded
                ? "Réintégrer aux analyses"
                : "Exclure des analyses"}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted">
              <span className="num">
                {signedEuro.format(signedAmount(row))}
              </span>{" "}
              · {row.description}
            </p>
            <p className="text-muted mt-2">
              {row.excluded
                ? "Elle pèsera de nouveau dans les totaux, l'anneau, les moyennes et les budgets."
                : "Elle ne pèsera plus dans les totaux, l'anneau, les moyennes ni les budgets, et restera dans ce relevé — c'est le seul endroit d'où la reprendre."}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="tertiary">
              Fermer
            </Button>
            <Button isPending={pending} onPress={() => void toggle()}>
              {row.excluded ? "Réintégrer" : "Exclure"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
