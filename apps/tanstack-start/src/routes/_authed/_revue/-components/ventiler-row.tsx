"use client";

import { useState } from "react";

import type { TransactionRow } from "@budget/api";

import type { CategoryPath } from "./category-path-picker";
import { dayMonthFr, euro } from "~/lib/format";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryPathPicker } from "./category-path-picker";

// Pastilles proposées d'emblée. Au-delà la ligne déborde, et « autre… » ouvre
// de toute façon l'arborescence complète.
const MAX_SUGGESTIONS = 5;

/**
 * Une transaction non ventilée : les sous-catégories de sa catégorie parente
 * sont offertes en un clic. C'est tout l'intérêt de l'écran — le chemin normal
 * (ouvrir un sélecteur, chercher, valider) coûte trop cher répété cent fois.
 */
export function VentilerRow({
  row,
  suggestions,
}: {
  row: TransactionRow;
  suggestions: CategoryPath[];
}) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const signed = (row.direction === "debit" ? -1 : 1) * Number(row.amount);

  return (
    <div className="border-border hover:bg-secondary grid grid-cols-[70px_minmax(110px,220px)_92px_minmax(140px,1fr)] items-center gap-3 border-b px-3.5 py-2.5">
      <span className="text-muted-foreground num text-[11.5px]">
        {dayMonthFr.format(new Date(row.bookingDate))}
      </span>
      <span className="num truncate text-xs">{row.description}</span>
      <span className="num text-right text-[12.5px]">
        {euro.format(signed)}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        {suggestions.slice(0, MAX_SUGGESTIONS).map((sub) => (
          <button
            key={sub.name}
            type="button"
            disabled={pending}
            onClick={() => void setCategory(row.id, sub.name)}
            className="border-border bg-background hover:border-primary hover:bg-accent-soft inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] disabled:opacity-50"
          >
            <span
              className="size-[7px] rounded-[2px]"
              style={{ background: sub.color }}
            />
            {sub.sub}
          </button>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => setPicking(true)}
          className="text-primary px-1 py-0.5 text-[11px]"
        >
          autre…
        </button>
      </span>

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
