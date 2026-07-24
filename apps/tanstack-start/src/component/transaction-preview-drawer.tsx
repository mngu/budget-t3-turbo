"use client";

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

// Sous-ensemble minimal commun à TxnForAnalysis (échantillon LLM) et
// TransactionRow (données réelles de la table transactions) — le drawer ne
// lit que ces champs, pas besoin de caster l'un ou l'autre.
export interface PreviewableTransaction {
  id: number;
  description: string;
  counterparty: string | null;
  bankName: string;
  amount: string | number;
  direction: "debit" | "credit";
}

interface TransactionPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: PreviewableTransaction[];
  description?: string;
}

export function TransactionPreviewDrawer({
  open,
  onOpenChange,
  title,
  transactions,
  description,
}: TransactionPreviewDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="drawer">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              `${transactions.length} transaction${transactions.length > 1 ? "s" : ""} de l'échantillon analysé.`}
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
