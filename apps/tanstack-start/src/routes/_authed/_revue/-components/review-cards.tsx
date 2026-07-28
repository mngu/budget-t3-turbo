"use client";

import { useState } from "react";

import type { ReviewItem, ReviewReason } from "@budget/api";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";
import { cn } from "@budget/ui";

import { useCategoryColor } from "~/lib/category-color";
import { dayMonthFr, euro } from "~/lib/format";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryPathPicker } from "./category-path-picker";

// Ce que la base permet réellement de dire. La maquette affiche un score de
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
 * « Catégorisations douteuses » : les entrées de la file de relecture que la
 * ventilation ne traite pas — pas de catégorie du tout, ou sens contraire à
 * celui de leur catégorie. Le motif `non-ventile` est volontairement exclu par
 * l'appelant : il a déjà sa section, groupée par catégorie, au-dessus.
 */
export function ReviewCards({
  items,
  /**
   * Vrai quand la file de relecture a touché son plafond serveur. « Rien à
   * signaler » serait alors une affirmation que la donnée ne porte pas : ce
   * qui a été tronqué reste inconnu.
   */
  truncated,
}: {
  items: ReviewItem[];
  truncated: boolean;
}) {
  return (
    <>
      <div className="mt-8 mb-3.5 flex items-baseline gap-2.5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
          Catégorisations douteuses
        </h2>
        <span className="text-subtle text-[11.5px]">
          {items.length > 0
            ? `${items.length} transaction${items.length > 1 ? "s" : ""} mal ou pas classée${items.length > 1 ? "s" : ""}`
            : truncated
              ? "file pleine de non ventilé — ventile d'abord ci-dessus pour voir le reste"
              : "rien à signaler sur ce périmètre"}
        </span>
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5">
          {items.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const resolveColor = useCategoryColor();
  const signed = (item.direction === "debit" ? -1 : 1) * Number(item.amount);

  return (
    <div className="border-border bg-card rounded-xl border px-4 py-3.5">
      <div className="flex items-baseline gap-2">
        <span className="num truncate text-[12.5px] font-medium">
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

      <div className={cn("mt-2.5 text-[11px]", REASON_TONE[item.reason])}>
        {REASONS[item.reason]}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={pending}
          className="border-border-strong bg-background hover:border-primary hover:bg-accent-soft flex h-7.5 min-w-0 flex-1 items-center gap-2 rounded-lg border px-2.5 text-left text-[11.5px]"
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
          className="border-border-strong hover:bg-ok-soft hover:border-ok hover:text-ok h-7.5 rounded-lg border px-3 text-[11.5px] font-medium disabled:opacity-45"
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
