"use client";

import type { DateRange } from "react-day-picker";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@budget/ui";
import { Button } from "@budget/ui/button";
import { Calendar } from "@budget/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import { dateFr } from "~/lib/format";

export function RangePicker({
  value,
  onChange,
  placeholder = "Choisir une période",
  className,
}: {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={(props) => (
          <Button
            variant="outline"
            aria-label={placeholder}
            className={cn(
              "min-w-56 justify-start px-2.5 font-normal",
              className,
            )}
            {...props}
          >
            <CalendarIcon data-icon="inline-start" />
            {value?.from ? (
              value.to ? (
                <>
                  {dateFr.format(value.from)} - {dateFr.format(value.to)}
                </>
              ) : (
                dateFr.format(value.from)
              )
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        )}
      />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          locale={fr}
          defaultMonth={value?.from}
          selected={value}
          onSelect={onChange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}
