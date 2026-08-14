"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";

import type { PreviewableTransaction, PreviewBadge } from "../-lib/use-preview";
import { dateFr, euro } from "~/lib/format";

interface TransactionPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: PreviewableTransaction[];
  description?: string;
  badge?: PreviewBadge;
  footer?: string;
}

export function TransactionPreviewDrawer({
  open,
  onOpenChange,
  title,
  transactions,
  description,
  badge,
  footer,
}: TransactionPreviewDrawerProps) {
  const withDate = transactions.some((txn) => txn.bookingDate !== undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="drawer"
        padded={false}
        className="w-115 max-w-[92vw]"
      >
        <DialogHeader className="flex-none border-b px-4 py-3.5">
          <div className="flex items-center gap-2.5 pr-8">
            {badge && (
              <span
                className="flex size-7 flex-none items-center justify-center rounded-lg"
                style={{ background: badge.soft, color: badge.color }}
              >
                {badge.icon}
              </span>
            )}
            <DialogTitle className="text-body min-w-0 truncate font-semibold">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-control mt-1.5 text-pretty">
            {description ??
              `${transactions.length} transaction${transactions.length > 1 ? "s" : ""} de l'échantillon analysé.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-control px-4 py-5">
              Aucune transaction.
            </p>
          ) : (
            transactions.map((txn) => {
              const category = txn.categoryPath ?? txn.category ?? null;
              return (
                <div
                  key={txn.id}
                  className={`hover:bg-surface-2 grid items-center gap-2.5 border-b px-4 py-2.5 last:border-b-0 ${
                    withDate
                      ? "grid-cols-[78px_minmax(0,1fr)_88px]"
                      : "grid-cols-[minmax(0,1fr)_88px]"
                  }`}
                >
                  {withDate && (
                    <span className="text-subtle text-control whitespace-nowrap">
                      {txn.bookingDate
                        ? dateFr.format(new Date(txn.bookingDate))
                        : ""}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="num text-control truncate">
                      {txn.description}
                    </div>
                    <div className="text-subtle text-meta truncate">
                      {txn.bankName}
                      {" · "}
                      {category ?? "Sans catégorie"}
                    </div>
                  </div>
                  {/* Le montant reste signé : la maquette ne montre que des
                      débits et préfixe un « − » d'office, ce qui rendrait un
                      crédit indiscernable d'une dépense. C'est la catégorie
                      absente, et elle seule, qui passe la ligne en warn. */}
                  <span
                    className={`num text-meta text-right ${
                      category === null ? "text-warn" : ""
                    }`}
                  >
                    {euro.format(
                      (txn.direction === "debit" ? -1 : 1) * Number(txn.amount),
                    )}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
