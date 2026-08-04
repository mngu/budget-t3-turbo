"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRightIcon, SearchIcon, TagIcon } from "lucide-react";

import type { TransactionsSearch } from "@budget/shared";
import { cn } from "@budget/ui";
import { Dialog, DialogContent, DialogTitle } from "@budget/ui/dialog";

import { SearchInput } from "~/component/search-input";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useParentCategories } from "~/lib/category-lookup";
import { euro } from "~/lib/format";
import { wholePeriod } from "~/lib/transactions-search";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryIcon } from "../../categories/-components/category-icon";

// Au pluriel, comme les deux totaux qui les surplombent sur `/transactions` :
// le bouton nomme un ensemble de lignes, pas le sens d'une transaction.
const SENSES = [
  { value: undefined, label: "Tous" },
  { value: "debit" as const, label: "Débits" },
  { value: "credit" as const, label: "Crédits" },
];

// Les trois états des virements entre comptes suivis. « Seulement » est le
// complément exact de « Masquer » côté serveur : il montre précisément ce que
// les totaux ont écarté, ce qui en fait l'écran d'audit de la détection.
const INTERNES = [
  {
    value: "toutes" as const,
    label: "Afficher",
    title: "Le relevé complet, virements internes compris",
  },
  {
    value: "masquer" as const,
    label: "Masquer",
    title:
      "Retirer les virements dont les deux jambes sont dans les comptes affichés",
  },
  {
    value: "seulement" as const,
    label: "Seulement",
    title: "N'afficher que ce que les totaux ont écarté",
  },
];

// Filtres de *contenu* : ceux que les barres ci-dessous posent et retirent. La
// banque n'en fait pas partie — elle se règle depuis l'en-tête, où son état est
// visible depuis n'importe quel écran.
const CONTEXT_FILTERS = {
  direction: undefined,
  category: undefined,
  aClasser: undefined,
  // Valeur par défaut et non `undefined` : `internes` n'est pas optionnel, le
  // relevé montre tout tant qu'on ne lui demande rien.
  internes: "toutes",
} satisfies Partial<TransactionsSearch>;

/**
 * `category` porte une sentinelle : `"none"` ne désigne pas une catégorie
 * nommée « none » mais l'absence de catégorie (`transactionsFilterQuery` la
 * traduit en `category_id is null`). Sans cette traduction à l'affichage, la
 * barre de filtres et le rappel des filtres en cours annonçaient « none ».
 */
export function categoryFilterLabel(category: string) {
  return category === "none" ? "Sans catégorie" : category;
}

// Séparateur vertical entre groupes de contrôles de la barre (maquette : 1×20).
function Divider() {
  return <span className="bg-border h-5 w-px flex-none" />;
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
  internes,
  searchField,
  right,
  className,
}: {
  /** Intitulé en capitales. Absent sur `/transactions`, dont la maquette pose
   *  une barre encadrée qui se passe de titre. */
  label?: string;
  /** Sélecteur Tous / Débit / Crédit. */
  sens?: boolean;
  /** Pastille « à classer seulement ». */
  aClasser?: boolean;
  /**
   * Sélecteur des virements entre comptes suivis. Réservé à `/transactions` :
   * c'est le seul écran où ces lignes sont visibles — partout ailleurs elles
   * sont écartées d'office, et un sélecteur n'y commanderait rien.
   */
  internes?: boolean;
  /**
   * Champ de recherche `q`. Il vivait dans l'en-tête tant que celui-ci portait
   * les filtres des quatre écrans ; le nouvel en-tête n'en a plus, et
   * `Transactions.dc.html` le pose dans cette barre — c'est un outil de table,
   * pas de périmètre. Seule `/transactions` l'affiche : ailleurs, `q` reste
   * visible et retirable via `<ActiveFilters>`.
   */
  searchField?: boolean;
  /** Contenu aligné à droite (compteur de périmètre). */
  right?: React.ReactNode;
  className?: string;
}) {
  const { search, setSearch } = useRevueSearch();
  const [catOpen, setCatOpen] = useState(false);
  // Identité de la catégorie filtrée (icône + teinte). Lue dans l'arborescence
  // et non dans `transactions.byCategory` : celui-ci n'a pas les icônes, et
  // aucun loader ne préchauffe sa clé sans `direction` — la pastille déclenchait
  // un agrégat complet à chaque changement de filtre.
  const parents = useParentCategories();
  const activeParent = search.category
    ? parents.get(search.category)
    : undefined;

  const dirty =
    !!(search.direction ?? search.category ?? search.aClasser) ||
    search.internes !== "toutes";

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2.5", className)}
    >
      {label && <span className="label-caps mr-0.5">{label}</span>}

      {sens && (
        <>
          {/* Trois boutons autonomes, pas des pastilles dans une coque : seul
              l'actif prend un bord et le fond de carte. */}
          <div className="flex flex-none items-center gap-0.5">
            {SENSES.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setSearch({ direction: item.value })}
                className={cn(
                  "flex h-[26px] items-center rounded-[7px] border px-2.5 text-xs",
                  search.direction === item.value
                    ? "border-border bg-card text-foreground font-semibold"
                    : "text-muted-foreground border-transparent",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Divider />
        </>
      )}

      <button
        type="button"
        onClick={() => setCatOpen(true)}
        className={cn(
          "flex h-[26px] max-w-[250px] flex-none items-center gap-1.5 rounded-[7px] border px-2.5 text-xs",
          search.category
            ? "border-border-strong bg-card font-semibold"
            : "text-muted-foreground hover:bg-card border-transparent",
        )}
      >
        <span
          className="flex flex-none"
          style={{
            color: activeParent?.color ?? "var(--subtle)",
          }}
        >
          {search.category ? (
            <CategoryIcon
              name={activeParent?.icon ?? null}
              className="size-[13px]"
            />
          ) : (
            <TagIcon className="size-[13px]" />
          )}
        </span>
        <span className="min-w-0 truncate">
          {search.category
            ? categoryFilterLabel(search.category)
            : "Toutes catégories"}
        </span>
        <span className="text-subtle flex-none text-[9px]">▾</span>
      </button>

      {search.category && (
        <button
          type="button"
          title="Retirer le filtre de catégorie"
          aria-label="Retirer le filtre de catégorie"
          onClick={() => setSearch({ category: undefined })}
          className="text-subtle hover:bg-accent hover:text-foreground flex size-[22px] flex-none items-center justify-center rounded-md text-[11px]"
        >
          ✕
        </button>
      )}

      {aClasser && (
        <>
          <Divider />
          {/* La maquette teinte ce bouton en rouge ; il reste `warn` ici, comme
              partout dans la revue où les hachures signalent « à classer » (voir
              CLAUDE.md). Seule la géométrie suit la maquette : h26, rayon 7. */}
          <button
            type="button"
            onClick={() =>
              setSearch({ aClasser: search.aClasser ? undefined : true })
            }
            title="Transactions rattachées à une catégorie parente qui a des sous-catégories"
            className={cn(
              "flex h-[26px] flex-none items-center gap-1.5 rounded-[7px] border px-2.5 text-xs font-medium",
              search.aClasser
                ? "border-warn bg-warn text-background"
                : "bg-warn-soft text-warn border-transparent",
            )}
          >
            <span
              className="h-[7px] w-3.5 rounded-[2px]"
              style={{
                background:
                  "repeating-linear-gradient(115deg,currentColor 0 3px,transparent 3px 7px)",
              }}
            />
            À classer seulement
          </button>
        </>
      )}

      {internes && (
        <>
          <Divider />
          {/* Trois états plutôt qu'une bascule : « Seulement » n'est pas un
              filtre de confort, c'est l'écran d'audit de la détection — c'est
              là qu'on vérifie une paire et qu'on écarte un faux positif. */}
          <span
            className="text-subtle flex flex-none items-center gap-1.5 text-[11px]"
            title="Virements entre deux comptes suivis : ils sont écartés de tous les totaux, mais restent listés ici"
          >
            <ArrowLeftRightIcon className="size-[13px]" />
            Internes
          </span>
          <div className="flex flex-none items-center gap-0.5">
            {INTERNES.map((item) => (
              <button
                key={item.value}
                type="button"
                title={item.title}
                onClick={() => setSearch({ internes: item.value, page: 1 })}
                className={cn(
                  "flex h-[26px] items-center rounded-[7px] border px-2.5 text-xs",
                  search.internes === item.value
                    ? "border-border bg-card text-foreground font-semibold"
                    : "text-muted-foreground border-transparent",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {dirty && (
        <button
          type="button"
          className={cn(
            "text-primary text-[11.5px]",
            !right && !searchField && "ml-auto",
          )}
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

      {searchField && (
        <div
          className={cn(
            "bg-card ml-auto flex h-[30px] max-w-[420px] min-w-[150px] flex-1 items-center gap-2 rounded-lg border px-2.5",
            search.q ? "border-primary" : "border-border",
          )}
        >
          <SearchIcon className="text-subtle size-3.5 flex-none" />
          <SearchInput
            param="q"
            resetParams={{ page: 1 }}
            className="h-auto border-0 bg-transparent p-0 text-[12.5px] shadow-none focus-visible:ring-0"
            placeholder="Rechercher un libellé, une catégorie, un montant…"
            aria-label="Recherche"
          />
        </div>
      )}

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
  const parents = useParentCategories();
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
              onClick={() =>
                pick(item.category === "" ? "none" : item.category)
              }
              className={cn(
                "hover:bg-accent grid w-full grid-cols-[22px_minmax(0,1fr)_78px] items-center gap-2.5 rounded-lg px-2.5 py-1 text-left",
                search.category === item.category && "bg-accent-soft",
              )}
            >
              {/* Pastille d'icône de la maquette : la teinte de la famille en
                  fond très pâle, l'icône pleine par-dessus. Le mélange vise
                  `--card`, donc il s'inverse tout seul en thème sombre. */}
              <span
                className="flex size-[22px] items-center justify-center rounded-[7px]"
                style={{
                  background: softCategoryColor(resolveColor(item.color)),
                  color: resolveColor(item.color),
                }}
              >
                <CategoryIcon
                  name={parents.get(item.category)?.icon ?? null}
                  className="size-[13px]"
                />
              </span>
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
