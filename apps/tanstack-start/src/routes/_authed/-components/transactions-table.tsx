import { useState } from "react";
import { getRouteApi, useRouter } from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type { TransactionRow } from "@budget/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@budget/ui/table";
import { toast } from "@budget/ui/toast";

import { CategoryTreeSelect } from "~/component/category/category-tree-select/category-tree-select";
import { dateFr, euro } from "~/lib/format";
import { useTRPCClient } from "~/lib/trpc";

const routeApi = getRouteApi("/_authed/");
const columnHelper = createColumnHelper<TransactionRow>();

// Colonnes dont l'en-tête est cliquable : le tri vit dans les search params,
// pas dans l'état de TanStack Table (d'où manualPagination + rowCount).
const SORTABLE = { date: "Date", amount: "Montant" } as const;

// Object.hasOwn et non `id in SORTABLE` : `in` remonte la chaîne de
// prototypes, un jour une colonne nommée "constructor" passerait pour triable.
const isSortable = (id: string): id is keyof typeof SORTABLE =>
  Object.hasOwn(SORTABLE, id);

const columns = [
  columnHelper.accessor("bookingDate", {
    id: "date",
    header: "Date",
    cell: (info) => dateFr.format(new Date(info.getValue())),
  }),
  columnHelper.accessor("description", {
    header: "Libellé",
    cell: (info) => (
      <div>
        <div className="font-medium">{info.getValue()}</div>
        {info.row.original.counterparty && (
          <div className="text-muted-foreground text-xs">
            {info.row.original.counterparty}
          </div>
        )}
      </div>
    ),
  }),
  columnHelper.accessor("bankName", { header: "Banque" }),
  columnHelper.accessor("raw", {
    header: "Nom",
    cell: ({ getValue }) => {
      const value = getValue();
      // Ternaire truthy comme la source : un nom vide ("") s'affiche aussi "-".
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      return value.debtor?.name ? value.debtor.name : "-";
    },
  }),
  columnHelper.accessor("category", {
    header: "Catégorie",
    cell: (info) => (
      <CategoryCell id={info.row.original.id} category={info.getValue()} />
    ),
  }),
  columnHelper.accessor("amount", {
    id: "amount",
    header: "Montant",
    cell: (info) => {
      const { direction } = info.row.original;
      const signed = (direction === "debit" ? -1 : 1) * Number(info.getValue());
      return (
        <span
          className={direction === "debit" ? "text-red-600" : "text-green-600"}
        >
          {euro.format(signed)}
        </span>
      );
    },
  }),
];

export function TransactionsTable({
  rows,
  total,
}: {
  rows: TransactionRow[];
  total: number;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id} className="max-w-xs">
                {isSortable(h.column.id) ? (
                  <SortableHead
                    label={SORTABLE[h.column.id]}
                    sortKey={h.column.id}
                  />
                ) : (
                  flexRender(h.column.columnDef.header, h.getContext())
                )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="text-muted-foreground py-8 text-center"
            >
              Aucune transaction ne correspond aux filtres.
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="max-w-xs truncate">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function SortableHead({
  label,
  sortKey,
}: {
  label: string;
  sortKey: "date" | "amount";
}) {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const active = search.sort === sortKey;
  const arrow = !active ? "" : search.order === "desc" ? " ↓" : " ↑";
  return (
    <button
      className="font-medium hover:underline"
      onClick={() =>
        navigate({
          search: (prev) => ({
            ...prev,
            sort: sortKey,
            order: active && prev.order === "desc" ? "asc" : "desc",
            page: 1,
          }),
        })
      }
    >
      {label}
      {arrow}
    </button>
  );
}

function CategoryCell({
  id,
  category,
}: {
  id: number;
  category: string | null;
}) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [saving, setSaving] = useState(false);
  return (
    <CategoryTreeSelect
      className="w-48"
      value={category ?? ""}
      disabled={saving}
      onValueChange={async (value) => {
        if (!value) return;
        setSaving(true);
        try {
          await trpcClient.transactions.updateCategory.mutate({
            id,
            category: value,
          });
          await router.invalidate();
        } catch (err) {
          // Le loader n'a pas été invalidé : le Select retombe sur l'ancienne
          // valeur. Sans ce toast l'échec est invisible et l'utilisateur croit
          // avoir enregistré.
          toast.error(
            err instanceof Error
              ? err.message
              : "Échec de la mise à jour de la catégorie.",
          );
        } finally {
          setSaving(false);
        }
      }}
    />
  );
}
