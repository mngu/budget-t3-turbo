import { getRouteApi } from "@tanstack/react-router";
import { addMonths, parseISO, subMonths } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@budget/ui/button";
import { ButtonGroup } from "@budget/ui/button-group";

import { RangePicker } from "~/component/range-picker";
import { monthBounds, toISODate } from "~/lib/date";

export function CalendarFilter() {
  const routeApi = getRouteApi("/_authed/");
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();

  const setFilter = (patch: Partial<typeof search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch, page: 1 }) });

  const shiftMonth = (delta: number) => {
    const anchor = search.dateFrom ? parseISO(search.dateFrom) : new Date();
    const shifted =
      delta < 0 ? subMonths(anchor, -delta) : addMonths(anchor, delta);
    void setFilter(monthBounds(shifted));
  };

  return (
    <ButtonGroup>
      <Button
        variant="outline"
        size="icon"
        aria-label="Mois précédent"
        onClick={() => shiftMonth(-1)}
      >
        <ChevronLeftIcon />
      </Button>
      <RangePicker
        value={{
          from: search.dateFrom ? parseISO(search.dateFrom) : undefined,
          to: search.dateTo ? parseISO(search.dateTo) : undefined,
        }}
        onChange={(range) =>
          setFilter({
            dateFrom: range?.from ? toISODate(range.from) : undefined,
            dateTo: range?.to ? toISODate(range.to) : undefined,
          })
        }
      />
      <Button
        variant="outline"
        size="icon"
        aria-label="Mois suivant"
        onClick={() => shiftMonth(1)}
      >
        <ChevronRightIcon />
      </Button>
    </ButtonGroup>
  );
}
