"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@budget/ui";
import { Dialog, DialogContent, DialogTitle } from "@budget/ui/dialog";

import { useCategoryColor } from "~/lib/category-color";
import { euro } from "~/lib/format";
import { wholePeriod } from "~/lib/transactions-search";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";

const SENSES = [
  { value: undefined, label: "Tous" },
  { value: "debit" as const, label: "Débit" },
  { value: "credit" as const, label: "Crédit" },
];

// Pastille de filtre : même gabarit pour banque, catégorie et « non ventilé ».
// La variante `warn` sert au seul filtre « non ventilé », qui reprend partout
// dans la revue la couleur d'alerte plutôt que l'accent.
function Chip({
  active,
  tone = "accent",
  className,
  ...props
}: React.ComponentProps<"button"> & {
  active?: boolean;
  tone?: "accent" | "warn";
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px]",
        active
          ? tone === "warn"
            ? "border-warn bg-warn-soft text-warn font-semibold"
            : "border-primary bg-accent-soft text-primary font-semibold"
          : "border-border bg-card text-muted-foreground hover:border-border-strong",
        className,
      )}
      {...props}
    />
  );
}

export function FilterBar() {
  const trpc = useTRPC();
  const { search, setSearch } = useRevueSearch();
  const [catOpen, setCatOpen] = useState(false);

  // Sans suspense : la barre est dans le layout, au-dessus des loaders de route,
  // et ne doit pas retarder l'affichage de l'écran. Les compteurs apparaissent
  // quand ils arrivent.
  const { data: banks } = useQuery(
    trpc.transactions.bankCounts.queryOptions(search),
  );

  const activeFilters = [
    search.category,
    search.direction && (search.direction === "debit" ? "débits" : "crédits"),
    search.bank,
    search.nvOnly && "non ventilé",
    search.q && `« ${search.q} »`,
  ].filter(Boolean);

  // `bankCounts` neutralise déjà le filtre banque : la somme est donc bien le
  // nombre de transactions retenues par tous les *autres* filtres.
  const retained = banks
    ? search.bank
      ? (banks.find((b) => b.bank === search.bank)?.count ?? 0)
      : banks.reduce((sum, b) => sum + b.count, 0)
    : null;

  return (
    <div className="bg-sunken border-border flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2.5 border-b px-5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="label-caps mr-0.5">Banque</span>
        {banks?.map((bank) => (
          <Chip
            key={bank.bank}
            active={search.bank === bank.bank}
            onClick={() =>
              setSearch({
                bank: search.bank === bank.bank ? undefined : bank.bank,
              })
            }
          >
            <span
              className={cn(
                "size-[7px] rounded-full",
                search.bank === bank.bank ? "bg-primary" : "bg-border-strong",
              )}
            />
            {bank.bank}
            <span className="text-subtle num">{bank.count}</span>
          </Chip>
        ))}
      </div>

      <span className="bg-border h-[18px] w-px" />

      <div className="flex items-center gap-1.5">
        <span className="label-caps">Sens</span>
        <div className="bg-secondary border-border flex gap-0.5 rounded-[7px] border p-0.5">
          {SENSES.map((sens) => {
            const active = search.direction === sens.value;
            return (
              <button
                key={sens.label}
                type="button"
                onClick={() => setSearch({ direction: sens.value })}
                className={cn(
                  "rounded-[5px] px-2.5 py-0.5 text-[11.5px]",
                  active
                    ? "bg-card text-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {sens.label}
              </button>
            );
          })}
        </div>
      </div>

      <span className="bg-border h-[18px] w-px" />

      <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-1.5">
        <span className="label-caps">Catégorie</span>
        <Chip active={!!search.category} onClick={() => setCatOpen(true)}>
          {search.category ?? "Toutes"}
          <span className="text-subtle text-[9px]">▾</span>
        </Chip>
        <Chip
          tone="warn"
          active={search.nvOnly}
          onClick={() =>
            setSearch({ nvOnly: search.nvOnly ? undefined : true })
          }
          title="Transactions rattachées à une catégorie parente qui a des sous-catégories"
        >
          <span
            className="h-[7px] w-3.5 rounded-[2px]"
            style={{
              background:
                "repeating-linear-gradient(115deg,currentColor 0 3px,transparent 3px 7px)",
            }}
          />
          Non ventilé seulement
        </Chip>
        {activeFilters.length > 0 && (
          <button
            type="button"
            className="text-primary text-[11.5px]"
            onClick={() =>
              setSearch({
                q: undefined,
                bank: undefined,
                direction: undefined,
                category: undefined,
                nvOnly: undefined,
              })
            }
          >
            Réinitialiser
          </button>
        )}
        {retained !== null && (
          <span className="text-subtle ml-auto text-[11.5px] whitespace-nowrap">
            {retained} transactions retenues
          </span>
        )}
      </div>

      <CategoryFilterDialog open={catOpen} onOpenChange={setCatOpen} />
    </div>
  );
}

// Liste des catégories parentes avec leur poids sur la période — le même
// classement que « Où est parti l'argent », pour filtrer depuis n'importe quel
// écran sans revenir à la revue.
function CategoryFilterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const { data } = useQuery({
    ...trpc.transactions.byCategory.queryOptions(wholePeriod(search)),
    enabled: open,
  });

  const pick = (category: string | undefined) => {
    setSearch({ category });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[92px] flex max-h-[480px] w-[340px] max-w-[calc(100vw-2rem)] translate-y-0 flex-col gap-0 overflow-hidden rounded-[14px] p-0">
        <DialogTitle className="label-caps border-border flex-none border-b p-3.5 pr-10 text-[11px] font-normal">
          Filtrer par catégorie
        </DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => pick(undefined)}
            className="hover:bg-accent text-muted-foreground w-full rounded-lg px-2.5 py-1 text-left text-[12.5px]"
          >
            Toutes les catégories
          </button>
          {data?.map((item) => (
            <button
              key={item.category || "sans-categorie"}
              type="button"
              onClick={() => pick(item.category || undefined)}
              className={cn(
                "hover:bg-accent grid w-full grid-cols-[14px_minmax(0,1fr)_78px] items-center gap-2.5 rounded-lg px-2.5 py-1 text-left",
                search.category === item.category && "bg-accent-soft",
              )}
            >
              <span
                className="size-2.5 rounded-[2px]"
                style={{ background: resolveColor(item.color) }}
              />
              <span
                className={cn(
                  "truncate text-[12.5px]",
                  search.category === item.category && "font-semibold",
                )}
              >
                {item.category || "Sans catégorie"}
              </span>
              <span className="num text-subtle text-right text-[11px]">
                {euro.format(item.total)}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
