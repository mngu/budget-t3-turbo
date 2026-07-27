"use client";

import { useState } from "react";

import type { ReviewItem, ReviewReason } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";

import { useCategoryColor } from "~/lib/category-color";
import { dayMonthFr, euro } from "~/lib/format";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryPathPicker } from "./category-path-picker";

// Ce que la base permet réellement de dire. La maquette affichait un score de
// confiance par transaction ; il n'en existe aucun en base (`category_source`
// ne connaît que llm / auto / manual), et en inventer un ferait passer une
// heuristique pour une mesure. Chaque motif ci-dessous correspond à un fait
// vérifiable — voir `reviewQueue` dans @budget/api.
const REASONS: Record<ReviewReason, string> = {
  "sans-categorie":
    "Aucune catégorie : ni le court-circuit ni le LLM n'ont su la classer.",
  "non-ventile":
    "Rattachée à la catégorie parente, sans sous-catégorie précise.",
  "sens-inhabituel":
    "Sens contraire à celui de sa catégorie — l'un des deux est faux.",
};

const REASON_TONE: Record<ReviewReason, string> = {
  "sans-categorie": "text-warn",
  "non-ventile": "text-subtle",
  "sens-inhabituel": "text-bad",
};

/**
 * File de relecture : les transactions du périmètre affiché qui méritent un
 * coup d'œil, corrigeables sans quitter la revue.
 */
export function ReviewRail({ items }: { items: ReviewItem[] }) {
  return (
    <aside className="border-border bg-sunken flex min-h-0 flex-col border-l">
      <div className="border-border flex-none border-b px-4.5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-[-0.02em]">À revoir</h2>
          <span className="text-bad bg-bad-soft rounded-full px-2 py-px text-[11.5px] font-semibold">
            {items.length}
          </span>
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11.5px]">
          Transactions mal ou pas classées. Corrige ici, sans quitter l'écran.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3.5 pt-3 pb-5">
        {items.map((item) => (
          <ReviewCard key={item.id} item={item} />
        ))}
        {items.length === 0 && (
          <p className="text-subtle pt-2 text-center text-[11.5px]">
            Rien à revoir sur ce filtre.
          </p>
        )}
      </div>
    </aside>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const resolveColor = useCategoryColor();
  const signed = (item.direction === "debit" ? -1 : 1) * Number(item.amount);

  return (
    <div className="border-border bg-card rounded-[11px] border px-3 py-2.5">
      <div className="flex items-baseline gap-2">
        <span className="num truncate text-xs font-medium">
          {item.description}
        </span>
        <span
          className={cn(
            "num ml-auto flex-none text-[13px]",
            signed > 0 && "text-ok",
          )}
        >
          {euro.format(signed)}
        </span>
      </div>

      <div className="text-subtle mt-1 flex items-center gap-1.5 text-[11px]">
        <span>{dayMonthFr.format(new Date(item.bookingDate))}</span>
        <span>·</span>
        <span className="truncate">{item.bankName}</span>
      </div>

      <div className={cn("mt-2 text-[11px]", REASON_TONE[item.reason])}>
        {REASONS[item.reason]}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={pending}
          className="border-border-strong bg-background hover:border-primary hover:bg-accent-soft flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2 text-left text-[11.5px]"
        >
          <span
            className="size-2 flex-none rounded-[2px]"
            style={{
              background: resolveColor(
                item.categoryColor ?? FALLBACK_CATEGORY_COLOR,
              ),
            }}
          />
          <span className="min-w-0 truncate">
            {item.categoryPath ?? "Sans catégorie"}
          </span>
          <span className="text-subtle ml-auto text-[9px]">▾</span>
        </button>
        <button
          type="button"
          // Valider = réécrire la même catégorie en `manual`. Sans catégorie il
          // n'y a rien à confirmer : il faut d'abord en choisir une.
          disabled={pending || !item.category}
          title={
            item.category
              ? "Confirmer la catégorie proposée"
              : "Choisis d'abord une catégorie"
          }
          onClick={() =>
            item.category && void setCategory(item.id, item.category)
          }
          className="border-border-strong hover:bg-ok-soft hover:border-ok hover:text-ok h-7 rounded-lg border px-2.5 text-[11.5px] font-medium disabled:opacity-45"
        >
          Valider
        </button>
      </div>

      <CategoryPathPicker
        open={picking}
        onOpenChange={setPicking}
        subtitle={`${item.description}  ·  ${euro.format(signed)}`}
        current={item.category}
        onPick={(name) => void setCategory(item.id, name)}
      />
    </div>
  );
}
