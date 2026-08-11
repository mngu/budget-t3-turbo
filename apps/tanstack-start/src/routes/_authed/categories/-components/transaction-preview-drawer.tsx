"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@budget/ui/dialog";

import { dateFr, euro } from "~/lib/format";

// Sous-ensemble minimal commun à TxnForAnalysis (échantillon LLM) et
// TransactionRow (données réelles de la table transactions) — le drawer ne
// lit que ces champs, pas besoin de caster l'un ou l'autre.
//
// Les trois derniers sont optionnels parce que l'échantillon d'analyse ne les
// porte pas : `TxnForAnalysis` est sérialisé tel quel dans `buildAnalysisPrompt`
// (`JSON.stringify(txns)`), y ajouter une date pour la seule vitrine changerait
// un prompt calibré. La colonne de date disparaît alors au lieu de laisser une
// cellule vide, qui se lirait comme une ligne cassée.
export interface PreviewableTransaction {
  id: number;
  description: string;
  counterparty: string | null;
  bankName: string;
  amount: string | number;
  direction: "debit" | "credit";
  bookingDate?: string;
  /** Chemin affiché « Parent › Enfant », ou la feuille seule. */
  categoryPath?: string | null;
  category?: string | null;
}

/** Teinte + icône de ce que le panneau montre, reprises de la ligne cliquée. */
export interface PreviewBadge {
  color: string;
  soft: string;
  icon: React.ReactNode;
}

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
            <DialogTitle className="min-w-0 truncate text-body font-semibold">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground mt-1.5 text-control text-pretty">
            {description ??
              `${transactions.length} transaction${transactions.length > 1 ? "s" : ""} de l'échantillon analysé.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {transactions.length === 0 ? (
            <p className="text-muted-foreground px-4 py-5 text-control">
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
                    <div className="num truncate text-control">
                      {txn.description}
                    </div>
                    <div className="text-subtle truncate text-meta">
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
                    className={`num text-right text-meta ${
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
