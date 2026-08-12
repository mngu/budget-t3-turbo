"use client";

import { useState } from "react";

import type { TransactionRow } from "@budget/api";
import { cn } from "@budget/ui";

import type { ParentCategory } from "~/lib/category-lookup";
import { useParentCategories } from "~/lib/category-lookup";
import { dayMonthFr, signedEuro, titleCase } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { useSetCategory } from "~/lib/use-set-category";
import { CategoryIcon } from "../../categories/-components/category-icon";
import { CategoryPathPicker } from "./category-path-picker";
import { ExcludeBadge } from "./exclude-badge";
import { TransferBadge } from "./transfer-badge";

/**
 * Une seule définition de gabarit pour l'en-tête et les lignes : deux grilles
 * déclarées séparément finissent toujours par diverger d'un pixel.
 *
 * Une seule colonne s'écarte de la maquette : « Compte », 220 px au lieu de 168.
 * Elle dimensionne la sienne sur des noms de banque *tronqués* — son script
 * retire « (Commun) » et « (perso) » avant d'afficher. Ici ces suffixes sont ce
 * qui distingue les deux comptes Caisse d'Épargne : les retirer rendrait deux
 * lignes indiscernables. À 168 px, l'appariement le plus fréquent des données
 * réelles (« Revolut (Commun) · Camille Durand », 157 lignes) coupait en
 * plein milieu du nom — la colonne aurait remplacé deux colonnes lisibles par
 * une seule tronquée. Les 52 px viennent de « Libellé », seule colonne libre.
 */
const GRID =
  "grid grid-cols-[74px_minmax(120px,1fr)_220px_244px_118px] items-center gap-4.5 pr-2.5 pl-2";

export function TransactionsTable({
  rows,
  flagged,
  page,
  pageCount,
  total,
}: {
  rows: TransactionRow[];
  /** Ids remontés par la file de relecture — la ligne porte une pastille. */
  flagged: Set<number>;
  page: number;
  pageCount: number;
  total: number;
}) {
  const { search, setSearch } = useRevueSearch();
  const parents = useParentCategories();

  // La maquette éteint la date des lignes qui répètent celle du dessus, pour
  // faire ressortir les ruptures de journée. Uniquement sous tri par date :
  // trié par montant, deux dates identiques qui se suivent ne veulent rien dire
  // et l'estompage mentirait sur la structure de la liste.
  const grouped = search.sort === "date";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pr-2">
      <div
        className={cn(
          GRID,
          // Opaque et au-dessus des lignes : il reste collé en haut pendant que
          // la liste défile dessous.
          "label-caps border-border-strong bg-background sticky top-0 z-[2] h-8 border-b",
        )}
      >
        <SortableHead label="Date" sortKey="date" />
        <span>Libellé</span>
        <span>Compte</span>
        <span>Catégorie</span>
        <SortableHead label="Montant" sortKey="amount" className="text-right" />
      </div>

      {rows.map((row, index) => (
        <Row
          key={row.id}
          row={row}
          flagged={flagged.has(row.id)}
          parents={parents}
          repeatsDate={
            grouped && rows[index - 1]?.bookingDate === row.bookingDate
          }
        />
      ))}

      {rows.length === 0 && (
        <p className="text-subtle text-control py-15 text-center">
          Aucune transaction ne correspond à ces filtres.
        </p>
      )}

      <div className="text-subtle text-control flex items-center justify-center gap-3 p-4">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setSearch({ page: page - 1 })}
          className="border-border text-muted-foreground hover:bg-accent rounded-md border px-2.5 py-1 disabled:opacity-40"
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
          className="border-border-strong hover:bg-accent rounded-md border px-2.5 py-1 disabled:opacity-40"
        >
          Suivant ›
        </button>
      </div>
    </div>
  );
}

function Row({
  row,
  flagged,
  parents,
  repeatsDate,
}: {
  row: TransactionRow;
  flagged: boolean;
  parents: Map<string, ParentCategory>;
  repeatsDate: boolean;
}) {
  const signed = (row.direction === "debit" ? -1 : 1) * Number(row.amount);
  const debtor = row.raw.debtor?.name ?? row.counterparty;

  return (
    <div
      className={cn(
        GRID,
        // `group` : le bouton d'exclusion ne se montre qu'au survol tant que la
        // ligne compte (voir ExcludeBadge).
        "border-border hover:bg-accent group h-11 border-b",
        // Une ligne écartée des totaux se lit encore, mais en retrait.
        row.excluded && "opacity-50",
      )}
    >
      <span
        className={cn(
          "num text-meta",
          repeatsDate ? "text-subtle" : "text-muted-foreground",
        )}
      >
        {dayMonthFr.format(new Date(row.bookingDate))}
      </span>

      <span className="flex min-w-0 items-center gap-1.5">
        <span className="text-body truncate">{row.description}</span>
        <TransferBadge row={row} />
        <ExcludeBadge row={row} />
        {/* La maquette met ici une pastille de « catégorisation peu sûre »,
            calculée sur un score de confiance dont la base n'a aucun équivalent
            (voir CLAUDE.md). Même emplacement, mais adossé au seul fait
            vérifiable : la transaction est dans la file « À revoir ». */}
        {flagged && (
          <span
            className="bg-bad size-1.5 flex-none rounded-full"
            title="À revoir : sans catégorie, à classer, ou d'un sens inattendu pour sa catégorie"
          />
        )}
      </span>

      <span className="text-subtle text-control truncate">
        {row.bankName}
        {debtor && ` · ${titleCase(debtor)}`}
      </span>

      <CategoryCell row={row} parents={parents} />

      <span className={cn("num text-body text-right", signed > 0 && "text-ok")}>
        {signedEuro.format(signed)}
      </span>
    </div>
  );
}

/**
 * Cellule de catégorie : c'est le bouton « Reclasser » de la maquette, discret
 * jusqu'au survol.
 *
 * Le libellé affiché est la **sous-catégorie** seule, pas le chemin complet —
 * l'icône de la parente dit déjà la famille. Trois états, dans l'ordre où le
 * lecteur les rencontre :
 * — aucune catégorie du tout ;
 * — posée sur une parente qui a des sous-catégories : c'est « à classer », et le
 *   libellé nomme la parente pour dire dans laquelle ;
 * — posée sur une parente sans enfant : classée, rien à ajouter.
 */
function CategoryCell({
  row,
  parents,
}: {
  row: TransactionRow;
  parents: Map<string, ParentCategory>;
}) {
  const [picking, setPicking] = useState(false);
  const { setCategory, pending } = useSetCategory();

  // `categoryPath` vaut « Parent › Enfant », ou le seul nom quand la
  // transaction est posée sur la parente.
  const path = row.categoryPath?.split(" › ") ?? [];
  const parentName = path[0] ?? null;
  const subName = path[1] ?? null;
  const parent = parentName === null ? undefined : parents.get(parentName);
  const aClasser = subName === null && !!parent?.hasChildren;

  const label =
    parentName === null
      ? "Sans catégorie"
      : aClasser
        ? `À classer · ${parentName}`
        : (subName ?? parentName);

  return (
    <span className="flex min-w-0">
      <button
        type="button"
        disabled={pending}
        onClick={() => setPicking(true)}
        title="Reclasser"
        className="hover:border-border-strong hover:bg-card -ml-2 flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-transparent px-1.5 text-left"
      >
        <span className="flex flex-none" style={{ color: parent?.color }}>
          <CategoryIcon name={parent?.icon ?? null} className="size-4" />
        </span>
        <span
          className={cn(
            "text-control min-w-0 truncate",
            aClasser || parentName === null
              ? "text-subtle"
              : "text-muted-foreground",
          )}
        >
          {label}
        </span>
        {/* Corrigée à la main : `category_source = 'manual'` est la seule des
            trois valeurs qui dise quelque chose au lecteur — llm et auto sont
            le régime normal. */}
        {row.categorySource === "manual" && (
          <span
            className="bg-primary size-1 flex-none rounded-full"
            title="Catégorie corrigée à la main"
          />
        )}
        <span className="text-subtle text-label ml-auto flex-none">▾</span>
      </button>

      <CategoryPathPicker
        open={picking}
        onOpenChange={setPicking}
        subtitle={`${row.description}  ·  ${signedEuro.format((row.direction === "debit" ? -1 : 1) * Number(row.amount))}`}
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
