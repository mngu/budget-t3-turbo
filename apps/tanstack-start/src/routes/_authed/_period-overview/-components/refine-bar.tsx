"use client";

import type { SelectedCategory } from "./category-selector/category-selector";
import type {
  CategoryOverviewType,
  TransactionsSearch,
} from "@budget/api/schemas";

import { SearchIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { InputGroup, InputGroupAddon } from "@budget/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@budget/ui/toggle-group";
import { SearchInput } from "~/component/search-input";
import { useRevueSearch } from "~/lib/use-revue-search";

import { CategorySelector } from "./category-selector/category-selector";

const SENSES = [
  { value: "tous", label: "Tous" },
  { value: "debit", label: "Débits" },
  { value: "credit", label: "Crédits" },
];

const CONTEXT_FILTERS = {
  direction: undefined,
  category: undefined,
} satisfies Partial<TransactionsSearch>;

function selectedCategory(
  overview: CategoryOverviewType,
  category: string | undefined,
): SelectedCategory | undefined {
  let parentFound = overview.find((parent) => parent.name === category);
  if (parentFound) {
    return { parent: parentFound };
  }
  let childFound;
  overview.forEach((parent) =>
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

function Divider() {
  return <span className="bg-border h-5 w-px flex-none" />;
}

export function RefineBar({
  overview,
  className,
}: {
  overview: CategoryOverviewType;
  className?: string;
}) {
  const { search, setSearch } = useRevueSearch();
  const dirty = !!(search.direction ?? search.category);

  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2.5", className)}
    >
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
        value={selectedCategory(overview, search.category)}
        onChange={(selected) =>
          setSearch({
            category: !selected
              ? undefined
              : (selected.child?.name ?? selected.parent.name ?? "none"),
          })
        }
      />

      {search.category && (
        <button
          type="button"
          title="Retirer le filtre de catégorie"
          aria-label="Retirer le filtre de catégorie"
          onClick={() => setSearch({ category: undefined })}
          className="text-subtle hover:bg-default hover:text-foreground text-meta hit-area flex size-6 flex-none items-center justify-center rounded-md"
        >
          ✕
        </button>
      )}

      {dirty && (
        <button
          type="button"
          className="text-primary text-control"
          onClick={() => setSearch(CONTEXT_FILTERS)}
        >
          Retirer ces filtres
        </button>
      )}

      <InputGroup className="order-first grow basis-full md:order-none md:ml-auto md:max-w-105 md:min-w-38 md:basis-0">
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
    </div>
  );
}
