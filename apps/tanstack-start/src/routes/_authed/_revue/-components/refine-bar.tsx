"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { TransactionsSearch } from "@budget/shared";
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

// Filtres de *contenu* : ceux que les barres ci-dessous posent et retirent. La
// banque n'en fait pas partie — elle se règle depuis l'en-tête, où son état est
// visible depuis n'importe quel écran.
const CONTEXT_FILTERS = {
  direction: undefined,
  category: undefined,
  aClasser: undefined,
} satisfies Partial<TransactionsSearch>;

/**
 * Pastille de filtre : même gabarit pour catégorie, « à classer » et comptes.
 * La variante `warn` sert au seul filtre « à classer », qui reprend partout
 * dans la revue la couleur d'alerte plutôt que l'accent.
 */
export function Chip({
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
          : "border-border bg-card text-muted-foreground hover:border-primary",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Filtres qu'un écran peut neutraliser lui-même. Le zoom d'une catégorie force
 * la sienne : y rappeler `category` annoncerait une restriction qui n'agit pas.
 */
type FilterKey = "category" | "direction" | "aClasser" | "q";

/**
 * Intitulés des filtres de contenu en cours, pour les rappeler ou les compter.
 * La banque n'y figure pas : la pastille de l'en-tête dit déjà « 3/4 comptes »
 * depuis les quatre écrans, la répéter ici ferait trois entrées pour un filtre.
 */
export function describeFilters(
  search: TransactionsSearch,
  exclude: FilterKey[] = [],
): string[] {
  const keep = (key: FilterKey) => !exclude.includes(key);
  return [
    keep("category") && search.category,
    keep("direction") &&
      search.direction &&
      (search.direction === "debit" ? "débits" : "crédits"),
    keep("aClasser") && search.aClasser && "à classer",
    keep("q") && search.q && `« ${search.q} »`,
  ].filter((label): label is string => typeof label === "string");
}

/**
 * Barre « Affiner … » propre à un écran. Chaque écran n'expose que les filtres
 * qui ont un sens pour lui : l'écran « À revoir » ne parle que de sorties à
 * classer, son sélecteur de sens n'aurait rien à commander.
 */
export function RefineBar({
  label,
  sens,
  aClasser,
  right,
  className,
}: {
  label: string;
  /** Sélecteur Tous / Débit / Crédit. */
  sens?: boolean;
  /** Pastille « à classer seulement ». */
  aClasser?: boolean;
  /** Contenu aligné à droite (compteur de périmètre). */
  right?: React.ReactNode;
  className?: string;
}) {
  const { search, setSearch } = useRevueSearch();
  const [catOpen, setCatOpen] = useState(false);
  const resolveColor = useCategoryColor();
  const trpc = useTRPC();

  // Uniquement pour colorer la pastille d'une catégorie sélectionnée : sans le
  // garde, chaque changement de filtre relancerait un agrégat complet dont
  // aucun loader ne préchauffe la clé (ils passent tous un `direction`).
  const { data: categories } = useQuery({
    ...trpc.transactions.byCategory.queryOptions(wholePeriod(search)),
    enabled: !!search.category,
  });
  const activeCategory = categories?.find(
    (c) => c.category === search.category,
  );

  const dirty = !!(search.direction ?? search.category ?? search.aClasser);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2.5", className)}
    >
      <span className="label-caps mr-0.5">{label}</span>

      {sens && (
        <div className="bg-secondary border-border flex gap-0.5 rounded-[7px] border p-0.5">
          {SENSES.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSearch({ direction: item.value })}
              className={cn(
                "rounded-[5px] px-2.5 py-0.5 text-[11.5px]",
                search.direction === item.value
                  ? "bg-card text-foreground font-semibold"
                  : "text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      <Chip active={!!search.category} onClick={() => setCatOpen(true)}>
        {activeCategory && (
          <span
            className="size-2 rounded-[2px]"
            style={{ background: resolveColor(activeCategory.color) }}
          />
        )}
        {search.category ?? "Toutes"}
        <span className="text-subtle text-[9px]">▾</span>
      </Chip>

      {aClasser && (
        <Chip
          tone="warn"
          active={search.aClasser}
          onClick={() =>
            setSearch({ aClasser: search.aClasser ? undefined : true })
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
          À classer seulement
        </Chip>
      )}

      {dirty && (
        <button
          type="button"
          className={cn("text-primary text-[11.5px]", !right && "ml-auto")}
          onClick={() => setSearch(CONTEXT_FILTERS)}
        >
          Retirer ces filtres
        </button>
      )}

      {right && (
        <span className="text-subtle ml-auto text-[11.5px] whitespace-nowrap">
          {right}
        </span>
      )}

      <CategoryFilterDialog open={catOpen} onOpenChange={setCatOpen} />
    </div>
  );
}

/**
 * Rappel des filtres en cours sur les écrans qui n'ont pas de barre pour les
 * régler (revue, zoom catégorie). Ils sont conservés d'un onglet à l'autre :
 * sans ce rappel, une sélection posée sur la table resterait active ici sans
 * rien qui le dise ni aucun moyen de la retirer.
 */
export function ActiveFilters({
  className,
  exclude,
}: {
  className?: string;
  exclude?: FilterKey[];
}) {
  const { search, setSearch } = useRevueSearch();
  const filters = describeFilters(search, exclude);
  if (filters.length === 0) return null;

  return (
    <div
      className={cn(
        "text-subtle flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px]",
        className,
      )}
    >
      <span className="label-caps">Filtres en cours</span>
      <span>{filters.join(" · ")}</span>
      <button
        type="button"
        className="text-primary"
        onClick={() =>
          setSearch({ ...CONTEXT_FILTERS, q: undefined, bank: undefined })
        }
      >
        Tout retirer
      </button>
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
