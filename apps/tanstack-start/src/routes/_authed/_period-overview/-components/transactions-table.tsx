"use client";

import type { TransactionRow } from "@budget/api";

import { Link } from "@tanstack/react-router";

import { cn } from "@budget/ui";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@budget/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@budget/ui/table";
import { dayMonthFr, signedAmount, titleCase } from "~/lib/format";
import { useFormat } from "~/lib/use-format";
import { useRevueSearch } from "~/lib/use-revue-search";

import { useSetCategory } from "../-lib/use-set-category";
import { CategorySelector } from "./category-selector/category-selector";
import { ExcludeBadge } from "./exclude-badge";

export function TransactionsTable({
  rows,
  page,
  pageCount,
  total,
}: {
  rows: TransactionRow[];
  page: number;
  pageCount: number;
  total: number;
}) {
  const { search } = useRevueSearch();

  // La maquette éteint la date des lignes qui répètent celle du dessus, pour
  // faire ressortir les ruptures de journée. Uniquement sous tri par date :
  // trié par montant, deux dates identiques qui se suivent ne veulent rien dire
  // et l'estompage mentirait sur la structure de la liste.
  const grouped = search.sort === "date";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Table
        containerClassName="min-h-0 flex-1 scrollbar-thin overflow-y-auto pr-2"
        // `border-separate` : en `collapse`, le trait sous l'en-tête appartient
        // à la table et reste en place quand les `th` collent en haut.
        className="table-fixed border-separate border-spacing-0"
      >
        <TableHeader className="label-caps sticky top-0 z-[2]">
          <TableRow className="hover:bg-transparent">
            <SortableHead
              label="Date"
              sortKey="date"
              className="w-14 md:w-18"
            />
            <Head>Libellé</Head>
            <Head className="hidden w-40 md:table-cell">Compte</Head>
            <Head className="hidden w-44 md:table-cell">Tiers</Head>
            <Head className="hidden w-60 md:table-cell">Catégorie</Head>
            <SortableHead
              label="Montant"
              sortKey="amount"
              className="w-28 text-right"
            />
          </TableRow>
        </TableHeader>

        <TableBody className="[&_td]:border-border [&_td]:border-b">
          {rows.map((row, index) => (
            <Row
              key={row.id}
              row={row}
              repeatsDate={
                grouped && rows[index - 1]?.bookingDate === row.bookingDate
              }
            />
          ))}
        </TableBody>
      </Table>

      {rows.length === 0 && (
        <p className="text-subtle text-control py-15 text-center">
          Aucune transaction ne correspond à ces filtres.
        </p>
      )}

      <Pagination className="text-subtle text-control items-center gap-3 p-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              render={
                <Link to="." search={(prev) => ({ ...prev, page: page - 1 })} />
              }
              aria-disabled={page <= 1}
              className="touch-target aria-disabled:pointer-events-none aria-disabled:opacity-40"
            />
          </PaginationItem>
        </PaginationContent>
        <span>
          Page {page} sur {pageCount} — {total} transactions
        </span>
        <PaginationContent>
          <PaginationItem>
            <PaginationNext
              render={
                <Link to="." search={(prev) => ({ ...prev, page: page + 1 })} />
              }
              aria-disabled={page >= pageCount}
              className="touch-target aria-disabled:pointer-events-none aria-disabled:opacity-40"
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

// Opaque et au-dessus des lignes : la liste défile dessous.
const HEAD = "border-border-strong bg-background h-8 border-b px-2 font-medium";

function Head(props: React.ComponentProps<"th">) {
  return <TableHead {...props} className={cn(HEAD, props.className)} />;
}

function Row({
  row,
  repeatsDate,
}: {
  row: TransactionRow;
  repeatsDate: boolean;
}) {
  const { signedEuro } = useFormat(2);
  const signed = signedAmount(row);
  const debtor = row.raw.debtor?.name ?? row.counterparty;

  return (
    <TableRow
      className={cn(
        // `group` : le bouton d'exclusion ne se montre qu'au survol tant que la
        // ligne compte (voir ExcludeBadge).
        "group h-11",
        // Une ligne écartée des totaux se lit encore, mais en retrait.
        row.excluded && "opacity-50",
      )}
    >
      <TableCell
        className={cn(
          "num text-meta",
          repeatsDate ? "text-subtle" : "text-muted-foreground",
        )}
      >
        {dayMonthFr.format(new Date(row.bookingDate))}
      </TableCell>

      <TableCell>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-body truncate">{row.description}</span>
          <ExcludeBadge row={row} />
        </span>
        {/* Sous `md` la colonne Catégorie n'a plus de place : le sélecteur
            passe sous le libellé. Deux instances, une par gabarit — un seul
            bouton tant que le menu est fermé, Base UI ne monte le contenu
            qu'à l'ouverture. */}
        <span className="mt-1 flex md:hidden">
          <CategoryCell row={row} />
        </span>
      </TableCell>

      <TableCell className="text-subtle text-control hidden truncate md:table-cell">
        {row.bankName}
      </TableCell>

      <TableCell className="text-subtle text-control hidden truncate md:table-cell">
        {debtor && titleCase(debtor)}
      </TableCell>

      <TableCell className="hidden md:table-cell">
        <CategoryCell row={row} />
      </TableCell>

      <TableCell
        className={cn("num text-body text-right", signed > 0 && "text-ok")}
      >
        {signedEuro.format(signed)}
      </TableCell>
    </TableRow>
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
function CategoryCell({ row }: { row: TransactionRow }) {
  const { setCategory } = useSetCategory();

  // `categoryPath` vaut « Parent › Enfant », ou le seul nom quand la
  // transaction est posée sur la parente.
  const path = row.categoryPath?.split(" › ") ?? [];
  const parentName = path[0] ?? null;
  const subName = path[1] ?? null;

  return (
    <span className="flex min-w-0 items-center gap-1">
      <CategorySelector
        value={{
          parent: {
            name: parentName,
            color: row.categoryColor,
            icon: row.categoryIcon,
            id: row.id,
          },
          ...(subName && { child: { id: row.categoryId, name: subName } }),
        }}
        onChange={(selected) =>
          setCategory(
            row.id,
            selected?.child?.id ?? selected?.parent.id ?? null,
          )
        }
      />
      {row.categorySource === "manual" && (
        <span
          className="bg-primary size-1 flex-none rounded-full"
          title="Catégorie corrigée à la main"
        />
      )}
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
    <Head className={className}>
      <button
        type="button"
        className="touch-target hover:underline"
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
    </Head>
  );
}
