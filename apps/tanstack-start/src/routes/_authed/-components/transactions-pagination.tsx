import { getRouteApi } from "@tanstack/react-router";

import { Button } from "@budget/ui/button";
import { PAGE_SIZE } from "@budget/shared";

const routeApi = getRouteApi("/_authed/");

export function TransactionsPagination({ total }: { total: number }) {
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-muted-foreground text-sm">
        Page {search.page} / {pageCount} — {total} transactions
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={search.page <= 1}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: prev.page - 1 }) })
          }
        >
          ← Précédent
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={search.page >= pageCount}
          onClick={() =>
            navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
          }
        >
          Suivant →
        </Button>
      </div>
    </div>
  );
}
