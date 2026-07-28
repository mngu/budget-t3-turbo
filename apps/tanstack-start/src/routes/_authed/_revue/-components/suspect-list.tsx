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
  "a-classer": "Rattachée à la catégorie parente, sans sous-catégorie précise.",
  "sens-inhabituel":
    "Sens contraire à celui de sa catégorie — l'un des deux est faux.",
};

/**
 * « Classements douteux » : les entrées de la file de relecture que la
 * liste « à classer » ne traite pas — pas de catégorie du tout, ou sens contraire
 * à celui de leur catégorie. Le motif `a-classer` est volontairement exclu par
 * l'appelant : il a déjà sa section, groupée par catégorie, au-dessus.
 */
export function SuspectList({
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
  if (items.length === 0)
    return (
      <p className="text-subtle pt-3.5 text-[11.5px]">
        {truncated
          ? "File pleine de transactions à classer — classe-les d'abord ci-dessus pour voir le reste."
          : "Aucun classement douteux sur ce périmètre."}
      </p>
    );

  return (
    <div className="border-border bg-card mt-3.5 overflow-hidden rounded-xl border">
      <div className="border-border flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b px-3.5 py-2.5">
        <span className="border-bad bg-bad-soft size-2.5 rounded-[3px] border" />
        <span className="text-[12.5px] font-semibold">Classements douteux</span>
        <span className="text-subtle text-[11.5px]">
          {items.length} transaction{items.length > 1 ? "s" : ""}
        </span>
      </div>
      {items.map((item) => (
        <SuspectRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function SuspectRow({ item }: { item: ReviewItem }) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();
  const resolveColor = useCategoryColor();
  const signed = (item.direction === "debit" ? -1 : 1) * Number(item.amount);

  return (
    <div className="border-border hover:bg-secondary grid grid-cols-[70px_minmax(0,1fr)_96px] items-center gap-x-3.5 gap-y-1.5 border-b px-3.5 py-2.5">
      <span className="text-muted-foreground num text-[11.5px]">
        {dayMonthFr.format(new Date(item.bookingDate))}
      </span>
      <span className="num truncate text-[12.5px]">{item.description}</span>
      <span
        className={cn("num text-right text-[12.5px]", signed > 0 && "text-ok")}
      >
        {euro.format(signed)}
      </span>

      <span className="col-start-2 -col-end-1 flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground min-w-[160px] flex-1 text-[11px]">
          {REASONS[item.reason]}
        </span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={pending}
          className="border-border-strong bg-background hover:border-primary hover:bg-accent-soft flex h-6.5 max-w-[230px] min-w-0 items-center gap-2 rounded-full border px-2.5 text-[11px]"
        >
          <span
            className="size-[7px] flex-none rounded-[2px]"
            style={{
              background: resolveColor(
                item.categoryColor ?? FALLBACK_CATEGORY_COLOR,
              ),
            }}
          />
          <span className="min-w-0 truncate">
            {item.categoryPath ?? "Sans catégorie"}
          </span>
          <span className="text-subtle text-[9px]">▾</span>
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
          className="border-border-strong hover:bg-ok-soft hover:border-ok hover:text-ok h-6.5 rounded-full border px-3 text-[11px] font-medium disabled:opacity-45"
        >
          Valider
        </button>
      </span>

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
