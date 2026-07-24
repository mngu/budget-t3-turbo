import { useState } from "react";
import {
  createFileRoute,
  Link,
  stripSearchParams,
  useRouter,
} from "@tanstack/react-router";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { LandmarkIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type {
  CategoryBreakdownItem,
  CategoryTreeNode,
  TransactionRow,
} from "@budget/api";
import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@budget/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@budget/ui/table";
import { ThemeToggle } from "@budget/ui/theme";
import { toast } from "@budget/ui/toast";
import { PAGE_SIZE, transactionsSearchSchema } from "@budget/validators";

import { CategoryTreeSelectItems } from "~/component/category-tree-select-items";
import { toastSyncOutcome } from "~/lib/sync-toast";
import { useTRPCClient } from "~/lib/trpc";
import { CalendarFilter } from "./-components/calendar-filter";
import { TransactionsFilters } from "./-components/transactions-filters";

export const Route = createFileRoute("/_authed/")({
  validateSearch: transactionsSearchSchema,
  search: {
    middlewares: [
      // @ts-expect-error — @tanstack/react-router@1.135 typing (PickOptional) only accepts
      // truly-optional search keys here; sort/order/page are required-with-.catch() defaults.
      // Runtime behavior is unaffected (all three are still stripped when equal to defaults).
      // Revisit if the router is upgraded to align with the source app's 1.170.x.
      stripSearchParams({ page: 1, sort: "date", order: "desc" }),
    ],
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, context }) => {
    const [result, expensesByCategory, revenuesByCategory, banks, categories] =
      await Promise.all([
        context.trpcClient.transactions.list.query(deps),
        context.trpcClient.transactions.byCategory.query({
          ...deps,
          direction: "debit",
        }),
        context.trpcClient.transactions.byCategory.query({
          ...deps,
          direction: "credit",
        }),
        context.trpcClient.transactions.banks.query(),
        context.trpcClient.categories.tree.query(),
      ]);
    return {
      ...result,
      expensesByCategory,
      revenuesByCategory,
      banks,
      categories,
    };
  },
  errorComponent: ({ error }) => (
    <main className="p-8">
      <p>❌ Impossible de charger les transactions.</p>
      <p className="text-sm opacity-70">
        Vérifiez que PostgreSQL tourne (docker compose up -d) et que l'import a
        été fait (pnpm run import).
      </p>
      <pre className="mt-4 text-xs opacity-50">{error.message}</pre>
    </main>
  ),
  component: TransactionsPage,
});

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

const columnHelper = createColumnHelper<TransactionRow>();

function TransactionsPage() {
  const {
    rows,
    total,
    expensesByCategory,
    revenuesByCategory,
    banks,
    categories,
  } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalExpenses = expensesByCategory.reduce(
    (acc, val) => acc + val.total,
    0,
  );
  const totalRevenues = revenuesByCategory.reduce(
    (acc, val) => acc + val.total,
    0,
  );

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
        <CategoryCell
          id={info.row.original.id}
          category={info.getValue()}
          categories={categories}
        />
      ),
    }),
    columnHelper.accessor("amount", {
      id: "amount",
      header: "Montant",
      cell: (info) => {
        const { direction } = info.row.original;
        const signed =
          (direction === "debit" ? -1 : 1) * Number(info.getValue());
        return (
          <span
            className={
              direction === "debit" ? "text-red-600" : "text-green-600"
            }
          >
            {euro.format(signed)}
          </span>
        );
      },
    }),
  ];

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: total,
  });

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">💰 Transactions</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Catégories"
            render={<Link to="/categories" />}
          >
            <SparklesIcon />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Banques"
            render={<Link to="/banques" />}
          >
            <LandmarkIcon />
          </Button>
          <SyncButton />
          <ThemeToggle />
          <CalendarFilter />
        </div>
      </div>
      <TransactionsFilters banks={banks} categories={categories} />
      <div className="flex gap-4">
        <KpiCard title="Total dépenses" value={euro.format(totalExpenses)} />
        <KpiCard title="Total revenues" value={euro.format(totalRevenues)} />
      </div>
      <div className="flex gap-4">
        <PieChartCard
          title="Répartition des dépenses par catégorie"
          data={expensesByCategory}
        />
        <PieChartCard
          title="Répartition des revenues par catégorie"
          data={revenuesByCategory}
        />
      </div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="max-w-xs">
                  {h.column.id === "date" ? (
                    <SortableHead label="Date" sortKey="date" />
                  ) : h.column.id === "amount" ? (
                    <SortableHead label="Montant" sortKey="amount" />
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
      <div className="mt-4 flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          Page {search.page} / {pageCount} — {total} transactions
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={search.page <= 1}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
            }
          >
            ← Précédent
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={search.page >= pageCount}
            onClick={() =>
              navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
            }
          >
            Suivant →
          </Button>
        </div>
      </div>
    </main>
  );
}

function CategoryCell({
  id,
  category,
  categories,
}: {
  id: number;
  category: string | null;
  categories: CategoryTreeNode[];
}) {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [saving, setSaving] = useState(false);
  return (
    <Select
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
          // Le loader n'a pas été invalidé : le tableau garde l'ancienne valeur.
          console.error("Échec de la mise à jour de la catégorie", err);
        } finally {
          setSaving(false);
        }
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Catégorie" />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} align="start">
        <CategoryTreeSelectItems categories={categories} />
      </SelectContent>
    </Select>
  );
}

function SyncButton() {
  const router = useRouter();
  const trpcClient = useTRPCClient();
  const [syncing, setSyncing] = useState(false);

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Synchroniser"
      disabled={syncing}
      onClick={async () => {
        setSyncing(true);
        try {
          const outcome = await trpcClient.sync.run.mutate();
          await router.invalidate();
          toastSyncOutcome(outcome);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Échec de la synchronisation.",
          );
        } finally {
          setSyncing(false);
        }
      }}
    >
      <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
    </Button>
  );
}

function SortableHead({
  label,
  sortKey,
}: {
  label: string;
  sortKey: "date" | "amount";
}) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
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

function EmptyState({
  label = "Aucune donnée pour cette période.",
}: {
  label?: string;
}) {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
      {label}
    </div>
  );
}

interface PieChartCardProps {
  title: string;
  data: CategoryBreakdownItem[];
}

function PieChartCard({ title, data }: PieChartCardProps) {
  const coloredData = data.map((entry) => ({
    ...entry,
    fill: entry.color,
  }));

  const tooltipStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--popover-foreground)",
    fontSize: 12,
  };

  function euroTooltip(value: unknown) {
    return euro.format(Number(value));
  }

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={coloredData}
                dataKey="total"
                nameKey="category"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              />
              <Tooltip formatter={euroTooltip} contentStyle={tooltipStyle} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "pos" | "neg";
}) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-0">
        <CardTitle className="text-muted-foreground text-sm font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-bold",
            tone === "pos" && "text-green-600",
            tone === "neg" && "text-red-600",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
