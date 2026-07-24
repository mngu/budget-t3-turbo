import { getRouteApi } from "@tanstack/react-router";

import type { CategoryTreeNode } from "@budget/api";
import { Button } from "@budget/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/ui/select";

import { CategoryTreeSelectItems } from "~/component/category-tree-select-items";
import { SearchInput } from "~/component/search-input";

export function TransactionsFilters({
  banks,
  categories,
}: {
  banks: string[];
  categories: CategoryTreeNode[];
}) {
  const routeApi = getRouteApi("/_authed/");
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  // Tout changement de filtre revient page 1.
  const setFilter = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });

  const directionItems = [
    { value: "debit", label: "Débits" },
    { value: "credit", label: "Crédits" },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <SearchInput
        param="q"
        resetParams={{ page: 1 }}
        className="w-64"
        placeholder="Rechercher (libellé, contrepartie)…"
        aria-label="Recherche"
      />

      <Select
        value={search.bank ?? null}
        onValueChange={(v) => setFilter({ bank: v ?? undefined })}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Banque" />
        </SelectTrigger>
        <SelectContent>
          {banks.map((b) => (
            <SelectItem key={b} value={b}>
              {b}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={directionItems}
        value={search.direction ?? null}
        onValueChange={(v) => setFilter({ direction: v ?? undefined })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          {directionItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={search.category ?? null}
        onValueChange={(v) => setFilter({ category: v ?? undefined })}
      >
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Catégorie" />
        </SelectTrigger>
        <SelectContent>
          <CategoryTreeSelectItems categories={categories} />
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        onClick={() =>
          navigate({
            search: { page: 1, sort: search.sort, order: search.order },
          })
        }
      >
        Réinitialiser
      </Button>
    </div>
  );
}
