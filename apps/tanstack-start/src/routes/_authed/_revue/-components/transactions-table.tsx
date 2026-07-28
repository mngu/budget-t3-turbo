"use client";

import { useState } from "react";

import type { TransactionRow } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";

import { useCategoryColor } from "~/lib/category-color";
import { dayMonthFr, euro } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryPathPicker } from "./category-path-picker";

// Une seule définition de gabarit pour l'en-tête et les lignes : deux grilles
// déclarées séparément finissent toujours par diverger d'un pixel.
//
// Gouttière et marges reprises de la maquette au facteur ~0,77 appliqué partout
// dans le portage (24 px → 18, 40 px → 32) ; les tailles de texte et de
// contrôles, elles, sont au ratio 1:1 comme sur les autres écrans.
const GRID =
  "grid grid-cols-[74px_minmax(120px,1.4fr)_minmax(88px,1fr)_minmax(80px,1fr)_minmax(140px,1.4fr)_96px] items-center gap-4.5 px-8";

export function TransactionsTable({
  rows,
  flagged,
  page,
  pageCount,
  total,
}: {
  rows: TransactionRow[];
  /** Ids remontés par la file de relecture — la ligne est teintée. */
  flagged: Set<number>;
  page: number;
  pageCount: number;
  total: number;
}) {
  const { setSearch } = useRevueSearch();

  return (
    <>
      <div
        className={cn(
          GRID,
          "label-caps bg-sunken border-border-strong h-[29px] flex-none border-b",
        )}
      >
        <SortableHead label="Date" sortKey="date" />
        <span>Libellé</span>
        <span>Banque</span>
        <span>Nom</span>
        <span>Catégorie</span>
        <SortableHead label="Montant" sortKey="amount" className="text-right" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.map((row) => (
          <Row key={row.id} row={row} flagged={flagged.has(row.id)} />
        ))}

        {rows.length === 0 && (
          <p className="text-muted-foreground py-10 text-center text-[11.5px]">
            Aucune transaction ne correspond aux filtres.
          </p>
        )}

        <div className="text-subtle flex items-center justify-center gap-3 p-4 text-[11.5px]">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setSearch({ page: page - 1 })}
            className="border-border text-muted-foreground hover:bg-accent rounded-[7px] border px-2.5 py-[3px] disabled:opacity-40"
          >
            ‹ Précédent
          </button>
          <span>
            Page {page} sur {pageCount} — {total} transactions
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setSearch({ page: page + 1 })}
            className="border-border-strong hover:bg-accent rounded-[7px] border px-2.5 py-[3px] disabled:opacity-40"
          >
            Suivant ›
          </button>
        </div>
      </div>
    </>
  );
}

function Row({ row, flagged }: { row: TransactionRow; flagged: boolean }) {
  const signed = (row.direction === "debit" ? -1 : 1) * Number(row.amount);
  const debtor = row.raw.debtor?.name;

  return (
    <div
      className={cn(
        GRID,
        "border-border hover:bg-accent h-9 border-b",
        flagged && "bg-bad-soft",
      )}
    >
      <span className="text-muted-foreground num text-[11.5px]">
        {dayMonthFr.format(new Date(row.bookingDate))}
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="num truncate text-[12.5px]">{row.description}</span>
        {flagged && (
          <span
            className="bg-bad size-1.5 flex-none rounded-full"
            title="À revoir — voir l'onglet du même nom"
          />
        )}
      </span>
      <span className="text-muted-foreground truncate text-[12px]">
        {row.bankName}
      </span>
      <span className="text-subtle truncate text-[12px]">
        {debtor ?? row.counterparty ?? "—"}
      </span>
      <CategoryCell row={row} />
      <span
        className={cn("num text-right text-[12.5px]", signed > 0 && "text-ok")}
      >
        {euro.format(signed)}
      </span>
    </div>
  );
}

function CategoryCell({ row }: { row: TransactionRow }) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const resolveColor = useCategoryColor();

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span
        className="size-2 flex-none rounded-[2px]"
        style={{
          background: resolveColor(
            row.categoryColor ?? FALLBACK_CATEGORY_COLOR,
          ),
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => setPicking(true)}
        className="hover:border-primary hover:bg-background h-7 min-w-0 flex-1 truncate rounded-[7px] border border-transparent px-1 text-left text-[11.5px]"
      >
        {row.categoryPath ?? "Sans catégorie"}
      </button>
      <CategoryPathPicker
        open={picking}
        onOpenChange={setPicking}
        subtitle={`${row.description}  ·  ${euro.format((row.direction === "debit" ? -1 : 1) * Number(row.amount))}`}
        current={row.category}
        onPick={(name) => void setCategory(row.id, name)}
      />
    </span>
  );
}

// Le tri vit dans les search params (le serveur pagine) : l'en-tête ne fait que
// les réécrire, il n'y a pas d'état de tri côté client.
function SortableHead({
  label,
  sortKey,
  className,
}: {
  label: string;
  sortKey: "date" | "amount";
  className?: string;
}) {
  const { search, setSearch } = useRevueSearch();
  const active = search.sort === sortKey;
  return (
    <button
      type="button"
      className={cn("text-left hover:underline", className)}
      onClick={() =>
        setSearch({
          sort: sortKey,
          order: active && search.order === "desc" ? "asc" : "desc",
        })
      }
    >
      {label}
      {active ? (search.order === "desc" ? " ↓" : " ↑") : ""}
    </button>
  );
}
