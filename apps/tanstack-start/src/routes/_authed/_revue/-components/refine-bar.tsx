"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRightIcon, SearchIcon, TagIcon } from "lucide-react";

import type { TransactionsSearch } from "@budget/shared";
import { cn } from "@budget/ui";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@budget/ui/command";
import { InputGroup, InputGroupAddon } from "@budget/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@budget/ui/tooltip";

import { SearchInput } from "~/component/search-input";
import { softCategoryColor, useCategoryColor } from "~/lib/category-color";
import { useParentCategories } from "~/lib/category-lookup";
import { euro } from "~/lib/format";
import { wholePeriod } from "~/lib/transactions-search";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryIcon } from "../../settings/categories/-components/category-icon";

// Au pluriel, comme les deux totaux qui les surplombent sur `/transactions` :
// le bouton nomme un ensemble de lignes, pas le sens d'une transaction.
//
// `ToggleGroup` ne manipule que des chaînes : « Tous » y est la valeur
// `"tous"`, traduite en `direction: undefined` à l'aller comme au retour.
const SENSES = [
  { value: "tous", label: "Tous" },
  { value: "debit", label: "Débits" },
  { value: "credit", label: "Crédits" },
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
          {/* Sélection unique : `multiple` vaut `false` par défaut. Décocher
              l'actif rend un tableau vide, qui retombe sur « Tous » — c'est
              exactement ce que veut dire « plus aucun sens choisi ». */}
          <ToggleGroup
            size="sm"
            aria-label="Sens des transactions"
            className="flex-none"
            value={[search.direction ?? "tous"]}
            onValueChange={([value]) =>
              setSearch({
                direction:
                  value === "debit" || value === "credit" ? value : undefined,
              })
            }
          >
            {SENSES.map((item) => (
              <ToggleGroupItem key={item.value} value={item.value}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Divider />
        </>
      )}

      <button
        type="button"
        onClick={() => setCatOpen(true)}
        className={cn(
          "text-control flex h-7 max-w-62 flex-none items-center gap-1.5 rounded-md border px-2.5",
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
              className="size-3"
            />
          ) : (
            <TagIcon className="size-3" />
          )}
        </span>
        <span className="min-w-0 truncate">
          {search.category
            ? categoryFilterLabel(search.category)
            : "Toutes catégories"}
        </span>
        <span className="text-subtle text-label flex-none">▾</span>
      </button>

      {search.category && (
        <button
          type="button"
          title="Retirer le filtre de catégorie"
          aria-label="Retirer le filtre de catégorie"
          onClick={() => setSearch({ category: undefined })}
          className="text-subtle hover:bg-accent hover:text-foreground text-meta flex size-6 flex-none items-center justify-center rounded-md"
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
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() =>
                    setSearch({ aClasser: search.aClasser ? undefined : true })
                  }
                  className={cn(
                    "text-control flex h-7 flex-none items-center gap-1.5 rounded-md border px-2.5 font-medium",
                    search.aClasser
                      ? "border-warn bg-warn text-background"
                      : "bg-warn-soft text-warn border-transparent",
                  )}
                >
                  <span
                    className="h-2 w-3.5 rounded-xs"
                    style={{
                      background:
                        "repeating-linear-gradient(115deg,currentColor 0 3px,transparent 3px 7px)",
                    }}
                  />
                  À classer seulement
                </button>
              }
            />
            <TooltipContent>
              Transactions rattachées à une catégorie parente qui a des
              sous-catégories
            </TooltipContent>
          </Tooltip>
        </>
      )}

      {internes && (
        <>
          <Divider />
          {/* Trois états plutôt qu'une bascule : « Seulement » n'est pas un
              filtre de confort, c'est l'écran d'audit de la détection — c'est
              là qu'on vérifie une paire et qu'on écarte un faux positif. */}
          <Tooltip>
            <TooltipTrigger className="text-subtle text-meta flex flex-none items-center gap-1.5">
              <ArrowLeftRightIcon className="size-3" />
              Internes
            </TooltipTrigger>
            <TooltipContent className="max-w-70">
              Virements entre deux comptes suivis : ils sont écartés de tous les
              totaux, mais restent listés ici
            </TooltipContent>
          </Tooltip>
          <ToggleGroup
            size="sm"
            aria-label="Virements internes"
            className="flex-none"
            value={[search.internes]}
            onValueChange={([value]) =>
              setSearch({
                // Pas de cast : au décochage `value` est bien `undefined`, et
                // c'est la table qui dit ce qui est une valeur légitime.
                internes:
                  INTERNES.find((i) => i.value === value)?.value ?? "toutes",
                page: 1,
              })
            }
          >
            {INTERNES.map((item) => (
              <Tooltip key={item.value}>
                <TooltipTrigger render={<ToggleGroupItem value={item.value} />}>
                  {item.label}
                </TooltipTrigger>
                <TooltipContent>{item.title}</TooltipContent>
              </Tooltip>
            ))}
          </ToggleGroup>
        </>
      )}

      {dirty && (
        <button
          type="button"
          className={cn(
            "text-primary text-control",
            !right && !searchField && "ml-auto",
          )}
          onClick={() => setSearch(CONTEXT_FILTERS)}
        >
          Retirer ces filtres
        </button>
      )}

      {right && (
        <span className="text-subtle text-control ml-auto whitespace-nowrap">
          {right}
        </span>
      )}

      {searchField && (
        <InputGroup className="ml-auto max-w-105 min-w-38 flex-1">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <SearchInput
            param="q"
            resetParams={{ page: 1 }}
            placeholder="Rechercher un libellé, une catégorie, un montant…"
            aria-label="Recherche"
          />
        </InputGroup>
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
    // `CommandDialog` plutôt qu'une liste dans un `Dialog` : la recherche vient
    // avec, et elle manquait — l'arborescence compte 14 parentes.
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Filtrer par catégorie"
      description="Choisissez la catégorie à isoler dans le relevé."
    >
      <CommandInput placeholder="Chercher une catégorie…" />
      <CommandList>
        <CommandEmpty>Aucune catégorie de ce nom.</CommandEmpty>
        <CommandGroup>
          <CommandItem
            value="Toutes les catégories"
            onSelect={() => pick(undefined)}
          >
            Toutes les catégories
          </CommandItem>
          {data?.map((item) => (
            <CommandItem
              key={item.category || "sans-categorie"}
              value={item.category || "Sans catégorie"}
              onSelect={() =>
                pick(item.category === "" ? "none" : item.category)
              }
            >
              {/* Pastille d'icône de la maquette : la teinte de la famille en
                  fond très pâle, l'icône pleine par-dessus. Le mélange vise
                  `--card`, donc il s'inverse tout seul en thème sombre. */}
              <span
                className="flex size-6 flex-none items-center justify-center rounded-md"
                style={{
                  background: softCategoryColor(resolveColor(item.color)),
                  color: resolveColor(item.color),
                }}
              >
                <CategoryIcon
                  name={parents.get(item.category)?.icon ?? null}
                  className="size-3"
                />
              </span>
              <span
                className={cn(
                  "truncate",
                  search.category === item.category && "font-semibold",
                )}
              >
                {item.category || "Sans catégorie"}
              </span>
              <CommandShortcut className="num">
                {euro.format(item.total)}
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
