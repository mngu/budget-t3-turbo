import { useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";

import { Button } from "@budget/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@budget/ui/select";

import { CategoryTreeSelect } from "~/component/category-tree-select/category-tree-select";
import { SearchInput } from "~/component/search-input";
import { useTRPC } from "~/lib/trpc";

const routeApi = getRouteApi("/_authed/");

export function TransactionsFilters() {
  const trpc = useTRPC();
  // Même contrat que CategoryTreeSelect : la liste vient du cache, que le
  // loader de la route réalimente à chaque passage.
  const { data: banks } = useSuspenseQuery(
    trpc.transactions.banks.queryOptions(),
  );
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

      <CategoryTreeSelect
        className="w-56"
        value={search.category ?? null}
        onValueChange={(v) => setFilter({ category: v ?? undefined })}
      />

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
