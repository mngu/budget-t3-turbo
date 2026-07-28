"use client";

import { useState } from "react";

import type { TransactionRow } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";

import { useCategoryColor } from "~/lib/category-color";
import { dayMonthFr, euro } from "~/lib/format";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryPathPicker } from "./category-path-picker";

/**
 * Liste des transactions d'une catégorie, dans le zoom : plus aérée que la
 * table complète et sans pagination — on veut voir la catégorie entière d'un
 * seul défilement.
 */
export function CategoryTransactions({
  rows,
  shown,
  total,
  flagged,
}: {
  rows: TransactionRow[];
  shown: number;
  total: number;
  /** Ids présents dans la file de relecture — marqués « douteux ». */
  flagged: Set<number>;
}) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-[10px] border">
      {rows.map((row) => (
        <Row key={row.id} row={row} flagged={flagged.has(row.id)} />
      ))}
      {rows.length === 0 && (
        <p className="text-muted-foreground py-8 text-center text-[11.5px]">
          Aucune transaction sur cette période.
        </p>
      )}
      <div className="text-subtle flex items-center justify-between px-3.5 py-2.5 text-[11.5px]">
        <span>
          {shown === total
            ? `${total} transactions`
            : `${shown} transactions affichées sur ${total}`}
        </span>
      </div>
    </div>
  );
}

function Row({ row, flagged }: { row: TransactionRow; flagged: boolean }) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const resolveColor = useCategoryColor();
  const signed = (row.direction === "debit" ? -1 : 1) * Number(row.amount);

  return (
    <div className="border-border hover:bg-secondary grid h-[38px] grid-cols-[78px_minmax(120px,1.3fr)_minmax(90px,1fr)_minmax(150px,1.5fr)_100px] items-center gap-2.5 border-b px-3.5">
      <div className="text-muted-foreground num text-[11.5px]">
        {dayMonthFr.format(new Date(row.bookingDate))}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="num min-w-0 truncate text-xs">{row.description}</span>
        {/* Sans pourcentage : la maquette affiche un score de confiance, la
            base n'en a aucun (voir `review-cards.tsx`). Le pastillage se
            contente de dire que la ligne est dans la file « À revoir ». */}
        {flagged && (
          <span className="text-bad bg-bad-soft flex-none rounded-[4px] px-1.5 py-px text-[10.5px]">
            douteux
          </span>
        )}
      </div>
      <div className="text-muted-foreground truncate text-[11.5px]">
        {row.bankName}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => setPicking(true)}
        className="border-border bg-background hover:border-primary hover:bg-accent-soft flex h-6.5 w-full items-center gap-2 rounded-[7px] border px-2 text-left text-[11.5px]"
      >
        <span
          className="size-2 flex-none rounded-[2px]"
          style={{
            background: resolveColor(
              row.categoryColor ?? FALLBACK_CATEGORY_COLOR,
            ),
          }}
        />
        <span className="min-w-0 truncate">
          {row.categoryPath ?? "Sans catégorie"}
        </span>
        <span className="text-subtle ml-auto text-[9px]">▾</span>
      </button>
      <div
        className={cn("num text-right text-[12.5px]", signed > 0 && "text-ok")}
      >
        {euro.format(signed)}
      </div>

      <CategoryPathPicker
        open={picking}
        onOpenChange={setPicking}
        subtitle={`${row.description}  ·  ${euro.format(signed)}`}
        current={row.category}
        onPick={(name) => void setCategory(row.id, name)}
      />
    </div>
  );
}
