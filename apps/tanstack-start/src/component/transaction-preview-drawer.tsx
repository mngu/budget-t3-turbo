"use client";

import type { TxnForAnalysis } from "@budget/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

interface TransactionPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: TxnForAnalysis[];
}

export function TransactionPreviewDrawer({
  open,
  onOpenChange,
  title,
  transactions,
}: TransactionPreviewDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="drawer">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {transactions.length} transaction
            {transactions.length > 1 ? "s" : ""} de l'échantillon analysé.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune transaction.</p>
          ) : (
            transactions.map((txn) => (
              <div
                key={txn.id}
                className="flex items-center justify-between gap-2 border-b pb-2 text-sm last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{txn.description}</div>
                  <div className="text-muted-foreground truncate text-xs">
                    {txn.counterparty ?? txn.bankName}
                  </div>
                </div>
                <span
                  className={
                    txn.direction === "debit"
                      ? "shrink-0 text-red-600"
                      : "shrink-0 text-green-600"
                  }
                >
                  {euro.format(
                    (txn.direction === "debit" ? -1 : 1) * Number(txn.amount),
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
