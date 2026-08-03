"use client";

import { useState } from "react";
import {
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

import { cn } from "@budget/ui";
import { Calendar } from "@budget/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import { monthBounds, toISODate } from "~/lib/date";
import { dateFr, dayMonthFr } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";

const monthFr = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Juillet 2026 » quand les bornes couvrent exactement un mois, sinon la plage
// complète : les flèches posent toujours un mois entier, mais le calendrier
// permet une période quelconque et l'intitulé doit rester honnête.
function periodLabel(from?: Date, to?: Date) {
  if (!from || !to) return "Toute la période";
  if (isSameDay(from, startOfMonth(from)) && isSameDay(to, endOfMonth(from)))
    return capitalize(monthFr.format(from));
  return `${dateFr.format(from)} – ${dateFr.format(to)}`;
}

interface Preset {
  label: string;
  from: Date;
  to: Date;
}

/**
 * Raccourcis de la colonne de gauche, tous ancrés sur la période **affichée** et
 * non sur aujourd'hui — y compris « 30 derniers jours », que la maquette fait
 * finir à la fin du mois affiché (`new Date(y, m, end.getDate() - 29)` → `end`).
 * Sur le mois en cours les deux lectures coïncident ; sur un mois passé, le
 * raccourci reste dans la période qu'on est en train de regarder au lieu de
 * ramener brutalement à aujourd'hui.
 */
function buildPresets(anchor: Date): Preset[] {
  const monthEnd = endOfMonth(anchor);
  const previous = subMonths(anchor, 1);
  return [
    { label: "Ce mois", from: startOfMonth(anchor), to: monthEnd },
    {
      label: "Mois dernier",
      from: startOfMonth(previous),
      to: endOfMonth(previous),
    },
    { label: "30 derniers jours", from: subDays(monthEnd, 29), to: monthEnd },
    { label: "Ce trimestre", from: startOfQuarter(anchor), to: endOfQuarter(anchor) },
    { label: "Cette année", from: startOfYear(anchor), to: endOfYear(anchor) },
  ];
}

/**
 * Sélecteur de période de l'en-tête : `‹ Juillet 2026 ▾ ›`, sans coque ni fond —
 * les flèches sautent de mois en mois, l'intitulé ouvre un panneau à deux
 * colonnes (raccourcis, calendrier).
 *
 * La plage n'est écrite dans l'URL qu'au **second** clic du calendrier, jamais
 * au premier : la borne de début vit dans `draft` en attendant sa fin. Pousser
 * `dateFrom` seul rejouerait tous les loaders de l'app sur une période ouverte —
 * un aller-retour complet, visible, pour un état que l'utilisateur n'a pas fini
 * de composer.
 */
export function PeriodPicker() {
  const { search, setSearch } = useRevueSearch();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);

  const from = search.dateFrom ? parseISO(search.dateFrom) : undefined;
  const to = search.dateTo ? parseISO(search.dateTo) : undefined;
  const anchor = from ?? new Date();

  const commit = (start: Date, end: Date) => {
    setDraft(null);
    setOpen(false);
    setSearch({ dateFrom: toISODate(start), dateTo: toISODate(end) });
  };

  const shiftMonth = (delta: number) =>
    setSearch(
      monthBounds(
        delta < 0 ? subMonths(anchor, -delta) : addMonths(anchor, delta),
      ),
    );

  return (
    <div className="ml-auto flex items-center gap-1">
      <StepButton
        label="Période précédente"
        onClick={() => shiftMonth(-1)}
        glyph="‹"
      />

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Une borne de début restée seule ne survit pas à la fermeture :
          // rouvrir doit repartir de la période réellement en vigueur.
          if (!next) setDraft(null);
        }}
      >
        <PopoverTrigger
          render={(props) => (
            <button
              type="button"
              title="Choisir une période"
              className="num hover:text-foreground flex h-[22px] items-center gap-1.5 font-medium tracking-[-0.01em]"
              {...props}
            >
              {periodLabel(from, to)}
              <span className="text-subtle text-[9px]">▾</span>
            </button>
          )}
        />
        <PopoverContent align="end" className="w-auto gap-0 p-3.5">
          <div className="flex gap-4">
            <div className="flex w-28 flex-none flex-col gap-0.5 pt-0.5">
              {buildPresets(anchor).map((preset) => {
                const active =
                  !!from &&
                  !!to &&
                  isSameDay(preset.from, from) &&
                  isSameDay(preset.to, to);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => commit(preset.from, preset.to)}
                    className={cn(
                      "py-1 text-left text-xs",
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col">
              {/* Le calendrier est celui du design system, pas la grille de 42
                  cellules dessinée à la main dans la maquette : mêmes gestes,
                  mêmes états, et le style de la plage suit les jetons de l'app. */}
              <Calendar
                mode="range"
                locale={fr}
                numberOfMonths={1}
                defaultMonth={anchor}
                selected={draft ? { from: draft } : from ? { from, to } : undefined}
                onSelect={(_range, day) => {
                  if (!draft) {
                    setDraft(day);
                    return;
                  }
                  const [start, end] = day < draft ? [day, draft] : [draft, day];
                  commit(start, end);
                }}
                className="p-0"
              />

              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="text-subtle num text-[11px]">
                  {draft
                    ? `Début : ${dayMonthFr.format(draft)} — choisir la fin`
                    : from && to
                      ? `${differenceInCalendarDays(to, from) + 1} jours`
                      : "Toute la période"}
                </span>
                <button
                  type="button"
                  className="text-primary ml-auto text-[11.5px]"
                  onClick={() => setOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <StepButton
        label="Période suivante"
        onClick={() => shiftMonth(1)}
        glyph="›"
      />
    </div>
  );
}

function StepButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="text-subtle hover:text-foreground flex h-[22px] w-5 items-center justify-center text-sm"
    >
      {glyph}
    </button>
  );
}
