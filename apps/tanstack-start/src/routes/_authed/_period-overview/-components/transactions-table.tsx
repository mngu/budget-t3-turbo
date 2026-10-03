"use client";

import type { TransactionRow } from "@budget/api";

import { Pagination, Table } from "@heroui/react";

import { cn } from "@budget/ui";
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
  const { search, setSearch } = useRevueSearch();
  const { signedEuro } = useFormat(2);

  return (
    <Table className="min-h-0 flex-1">
      <Table.ScrollContainer className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
        <Table.Content
          aria-label="Transactions"
          className="table-fixed"
          sortDescriptor={{
            column: search.sort ?? "date",
            direction: search.order === "asc" ? "ascending" : "descending",
          }}
          onSortChange={({ column, direction }) =>
            setSearch({
              sort: column === "amount" ? "amount" : "date",
              order: direction === "ascending" ? "asc" : "desc",
            })
          }
        >
          <Table.Header className="sticky top-0 z-[2]">
            <Table.Column id="date" allowsSorting className="w-22 md:w-24">
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                  Date
                </Table.SortableColumnHeader>
              )}
            </Table.Column>
            <Table.Column id="description" isRowHeader>
              Libellé
            </Table.Column>
            <Table.Column id="bank" className="hidden w-36 md:table-cell">
              Compte
            </Table.Column>
            <Table.Column id="debtor" className="hidden w-32 md:table-cell">
              Tiers
            </Table.Column>
            <Table.Column id="category" className="hidden w-48 md:table-cell">
              Catégorie
            </Table.Column>
            <Table.Column
              id="amount"
              allowsSorting
              className="w-28 text-right md:w-32"
            >
              {({ sortDirection }) => (
                <Table.SortableColumnHeader sortDirection={sortDirection}>
                  Montant
                </Table.SortableColumnHeader>
              )}
            </Table.Column>
          </Table.Header>

          <Table.Body
            renderEmptyState={() => (
              <p className="text-muted py-15 text-center">
                Aucune transaction ne correspond à ces filtres.
              </p>
            )}
          >
            {rows.map((row) => {
              const signed = signedAmount(row);
              const debtor = row.raw.debtor?.name ?? row.counterparty;
              return (
                <Table.Row
                  key={row.id}
                  id={row.id}
                  className={cn(row.excluded && "opacity-50")}
                >
                  <Table.Cell className="num text-muted whitespace-nowrap">
                    {dayMonthFr.format(new Date(row.bookingDate))}
                  </Table.Cell>
                  <Table.Cell>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{row.description}</span>
                      <ExcludeBadge row={row} />
                    </span>
                    <span className="mt-1 flex md:hidden">
                      <CategoryCell row={row} />
                    </span>
                  </Table.Cell>
                  <Table.Cell className="text-muted hidden truncate md:table-cell">
                    {row.bankName}
                  </Table.Cell>
                  <Table.Cell className="text-muted hidden truncate md:table-cell">
                    {debtor && titleCase(debtor)}
                  </Table.Cell>
                  <Table.Cell className="hidden md:table-cell">
                    <CategoryCell row={row} />
                  </Table.Cell>
                  <Table.Cell
                    className={cn(
                      "num text-right",
                      signed > 0 && "text-success",
                    )}
                  >
                    {signedEuro.format(signed)}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>

      <Table.Footer>
        <Pagination>
          <Pagination.Summary>
            Page {page} sur {pageCount} — {total} transactions
          </Pagination.Summary>
          <Pagination.Content>
            <Pagination.Item>
              <Pagination.Previous
                isDisabled={page <= 1}
                onPress={() => setSearch({ page: page - 1 })}
              >
                <Pagination.PreviousIcon />
                <span>Précédent</span>
              </Pagination.Previous>
            </Pagination.Item>
            <Pagination.Item>
              <Pagination.Next
                isDisabled={page >= pageCount}
                onPress={() => setSearch({ page: page + 1 })}
              >
                <span>Suivant</span>
                <Pagination.NextIcon />
              </Pagination.Next>
            </Pagination.Item>
          </Pagination.Content>
        </Pagination>
      </Table.Footer>
    </Table>
  );
}

function CategoryCell({ row }: { row: TransactionRow }) {
  const { setCategory } = useSetCategory();

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
          className="bg-accent size-1 flex-none rounded-full"
          title="Catégorie corrigée à la main"
        />
      )}
    </span>
  );
}
