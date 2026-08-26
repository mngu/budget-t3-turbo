"use client";

import { useState } from "react";
import { SearchIcon, TagIcon } from "lucide-react";

import type { TransactionsSearch } from "@budget/api/schemas";
import { cn } from "@budget/ui";
import { InputGroup, InputGroupAddon } from "@budget/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";

import { CategoryIcon } from "~/component/category-icon";
import { SearchInput } from "~/component/search-input";
import { useRevueSearch } from "~/lib/use-revue-search";
import { useParentCategories } from "../-lib/category-lookup";
import { CategoryPathPicker } from "./category-path-picker";

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
 * qui ont un sens pour lui.
 */
export function RefineBar({
  label,
  sens,
  searchField,
  right,
  className,
}: {
  /** Intitulé en capitales. Absent sur `/transactions`, dont la maquette pose
   *  une barre encadrée qui se passe de titre. */
  label?: string;
  /** Sélecteur Tous / Débit / Crédit. */
  sens?: boolean;
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
  // Identité de la catégorie filtrée (icône + teinte), lue dans l'arborescence —
  // la même source que le sélecteur, préchargée par le loader du layout.
  const parents = useParentCategories();
  const activeParent = search.category
    ? parents.get(search.category)
    : undefined;

  const dirty =
    !!(search.direction ?? search.category) || search.internes !== "toutes";

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
        <span className="flex flex-none">
          {search.category ? (
            <CategoryIcon
              name={activeParent?.icon ?? null}
              className="size-3"
              color={activeParent?.color ?? "var(--subtle)"}
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

      <CategoryPathPicker
        open={catOpen}
        onOpenChange={setCatOpen}
        title="Filtrer par catégorie"
        description="Choisissez la catégorie à isoler dans le relevé."
        // En filtre, désigner une parente retient aussi ses sous-catégories :
        // « Sans sous-catégorie » y serait faux (voir PARENT_SUB_LABEL).
        parentLabel="Toute la catégorie"
        current={search.category}
        onPick={(category) => setSearch({ category })}
      />
    </div>
  );
}
