"use client";

import type {
  NewCategoryOverviewType,
  TransactionsSearch,
} from "@budget/api/schemas";

import { SearchIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { InputGroup, InputGroupAddon } from "@budget/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";
import { SearchInput } from "~/component/search-input";
import { useRevueSearch } from "~/lib/use-revue-search";

import {
  CategorySelector,
  SelectedCategory,
} from "./category-selector/category-selector";

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

// Filtres de *contenu* : ceux que les barres ci-dessous posent et retirent. La
// banque n'en fait pas partie — elle se règle depuis l'en-tête, où son état est
// visible depuis n'importe quel écran.
const CONTEXT_FILTERS = {
  direction: undefined,
  category: undefined,
} satisfies Partial<TransactionsSearch>;

/**
 * Résout le nom porté par l'URL (`?category=`) en chemin de l'arborescence, pour
 * que le bouton de filtre lise la même source que la table. Sans ça, l'état du
 * bouton doublerait l'URL et divergerait d'elle au premier « ✕ » ou retour
 * arrière.
 */
export function selectedCategory(
  newOverview: NewCategoryOverviewType,
  category: string | undefined,
): SelectedCategory | undefined {
  let parentFound = newOverview.find((parent) => parent.name === category);
  if (parentFound) {
    return { parent: parentFound };
  }
  let childFound;
  newOverview.forEach((parent) =>
    parent.children?.forEach((child) => {
      if (child.name === category) {
        parentFound = parent;
        childFound = child;
      }
    }),
  );
  if (childFound && parentFound) {
    return { parent: parentFound, child: childFound };
  }
}

// Séparateur vertical entre groupes de contrôles de la barre (maquette : 1×20).
function Divider() {
  return <span className="bg-border h-5 w-px flex-none" />;
}

/**
 * Barre « Affiner … » propre à un écran. Chaque écran n'expose que les filtres
 * qui ont un sens pour lui.
 */
export function RefineBar({
  label,
  sens,
  searchField,
  newOverview,
  right,
  className,
}: {
  /** Intitulé en capitales. Absent sur `/transactions`, dont la maquette pose
   *  une barre encadrée qui se passe de titre. */
  label?: string;
  /** Sélecteur Tous / Débit / Crédit. */
  sens?: boolean;
  newOverview: NewCategoryOverviewType;
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
  const dirty = !!(search.direction ?? search.category);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2.5", className)}
    >
      {label && <span className="label-caps mr-0.5">{label}</span>}

      {sens && (
        <>
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
          <CategorySelector
            value={selectedCategory(newOverview, search.category)}
            onChange={(selected) =>
              setSearch({
                category: !selected
                  ? undefined
                  : (selected.child?.name ?? selected.parent.name ?? "none"),
              })
            }
          />
        </>
      )}

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
    </div>
  );
}
