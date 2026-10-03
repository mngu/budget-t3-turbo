"use client";

import type { PreviewBadge } from "../-lib/use-preview";
import type { TransactionRow } from "@budget/api";

import { Drawer } from "@heroui/react";

import { cn } from "@budget/ui";
import { dateFr, signedAmount } from "~/lib/format";
import { useFormat } from "~/lib/use-format";

import { PREVIEW_LIMIT } from "../-lib/use-preview";

interface TransactionPreviewDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  transactions: TransactionRow[];
  description?: string;
  badge?: PreviewBadge;
}

export function TransactionPreviewDrawer({
  open,
  onOpenChange,
  title,
  transactions,
  description,
  badge,
}: TransactionPreviewDrawerProps) {
  const { signedEuro } = useFormat();
  return (
    <Drawer.Backdrop isOpen={open} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <div className="flex items-center gap-2.5">
              {badge && (
                <span
                  className="flex size-7 flex-none items-center justify-center rounded-lg"
                  style={{ background: badge.soft, color: badge.color }}
                >
                  {badge.icon}
                </span>
              )}
              <Drawer.Heading>{title}</Drawer.Heading>
            </div>
            {description && <p className="text-muted">{description}</p>}
          </Drawer.Header>

          <Drawer.Body>
            {transactions.length === 0 ? (
              <p className="text-muted">Aucune transaction.</p>
            ) : (
              transactions.map((txn) => {
                const category = txn.categoryPath ?? txn.category ?? null;
                return (
                  <div
                    key={txn.id}
                    className="grid grid-cols-[78px_minmax(0,1fr)_88px] items-center gap-2.5 border-b py-2.5 last:border-b-0"
                  >
                    <span className="text-muted text-control whitespace-nowrap">
                      {dateFr.format(new Date(txn.bookingDate))}
                    </span>
                    <div className="min-w-0">
                      <div className="num text-control truncate">
                        {txn.description}
                      </div>
                      <div className="text-muted text-meta truncate">
                        {txn.bankName}
                        {" · "}
                        {category ?? "Sans catégorie"}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "num text-meta text-right",
                        category === null && "text-warning",
                      )}
                    >
                      {signedEuro.format(signedAmount(txn))}
                    </span>
                  </div>
                );
              })
            )}
          </Drawer.Body>

          <Drawer.Footer className="text-muted">
            Aperçu limité aux {PREVIEW_LIMIT} transactions les plus récentes.
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
