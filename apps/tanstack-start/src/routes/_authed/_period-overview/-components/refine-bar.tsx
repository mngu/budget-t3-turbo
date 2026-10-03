"use client";

import type { SelectedCategory } from "./category-selector/category-selector";
import type {
  CategoryOverviewType,
  TransactionsSearch,
} from "@budget/api/schemas";

import {
  Button,
  CloseButton,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";

import { cn } from "@budget/ui";
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
      <ToggleButtonGroup
        size="sm"
        aria-label="Sens des transactions"
        className="flex-none"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[search.direction ?? "tous"]}
        onSelectionChange={([value]) =>
          setSearch({
            direction:
              value === "debit" || value === "credit" ? value : undefined,
          })
        }
      >
        {SENSES.map((item, i) => (
          <ToggleButton key={item.value} id={item.value}>
            {i > 0 && <ToggleButtonGroup.Separator />}
            {item.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Separator orientation="vertical" className="h-5" />
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
        <CloseButton
          aria-label="Retirer le filtre de catégorie"
          onPress={() => setSearch({ category: undefined })}
        />
      )}

      {dirty && (
        <Button
          variant="ghost"
          size="sm"
          onPress={() => setSearch(CONTEXT_FILTERS)}
        >
          Retirer ces filtres
        </Button>
      )}

      <SearchInput
        param="q"
        resetParams={{ page: 1 }}
        placeholder="Rechercher un libellé, une catégorie, un montant…"
        aria-label="Recherche"
        className="order-first grow basis-full md:order-none md:ml-auto md:max-w-105 md:min-w-38 md:basis-0"
      />
    </div>
  );
}
