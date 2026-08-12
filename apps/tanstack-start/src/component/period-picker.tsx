"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addDays,
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
} from "date-fns";
import { fr } from "date-fns/locale";

import { cn } from "@budget/ui";
import { Calendar } from "@budget/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@budget/ui/popover";

import {
  cycleOf,
  MONTH_START_DAYS,
  monthBounds,
  monthStartDay,
  setMonthStartDay,
  toISODate,
} from "~/lib/date";
import { dateFr, dayMonthFr } from "~/lib/format";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";

const monthFr = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// « Juillet 2026 » quand les bornes couvrent exactement un cycle mensuel, sinon
// la plage complète : les flèches posent toujours un cycle entier, mais le
// calendrier permet une période quelconque et l'intitulé doit rester honnête.
//
// Le cycle est nommé d'après le mois de son *milieu* et non de son début : un
// mois qui commence le 28 juin est « Juillet » pour qui l'a réglé ainsi. Avec un
// départ au 1er, milieu et début tombent dans le même mois — rien ne change.
function periodLabel(from?: Date, to?: Date, startDay = 1) {
  if (!from || !to) return "Toute la période";
  const cycle = cycleOf(from, startDay);
  if (isSameDay(cycle.start, from) && isSameDay(cycle.end, to))
    return capitalize(
      monthFr.format(
        addDays(from, Math.floor(differenceInCalendarDays(to, from) / 2)),
      ),
    );
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
function buildPresets(anchor: Date, startDay: number): Preset[] {
  const current = cycleOf(anchor, startDay);
  const previous = cycleOf(subDays(current.start, 1), startDay);
  return [
    { label: "Ce mois", from: current.start, to: current.end },
    { label: "Mois dernier", from: previous.start, to: previous.end },
    {
      label: "30 derniers jours",
      from: subDays(current.end, 29),
      to: current.end,
    },
    {
      label: "Ce trimestre",
      from: startOfQuarter(anchor),
      to: endOfQuarter(anchor),
    },
    { label: "Cette année", from: startOfYear(anchor), to: endOfYear(anchor) },
  ];
}

/**
 * Sélecteur de période de l'en-tête : `Juillet 2026 ▾  [‹|›]`. L'intitulé ouvre
 * un panneau à deux colonnes (raccourcis, calendrier) et les deux flèches, qui
 * sautent de mois en mois, sont **groupées à sa droite** dans une coque à bord.
 * Elles l'encadraient sans coque jusqu'à la révision de maquette du 2026-08-07 :
 * un pas d'un mois est un seul contrôle à deux sens, pas deux boutons posés de
 * part et d'autre d'un troisième qui, lui, ouvre un panneau.
 *
 * La plage n'est écrite dans l'URL qu'au **second** clic du calendrier, jamais
 * au premier : la borne de début vit dans `draft` en attendant sa fin. Pousser
 * `dateFrom` seul rejouerait tous les loaders de l'app sur une période ouverte —
 * un aller-retour complet, visible, pour un état que l'utilisateur n'a pas fini
 * de composer.
 */
export function PeriodPicker() {
  const trpc = useTRPC();
  const { search, setSearch } = useRevueSearch();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  // Lu au premier rendu comme le fait `ThemeProvider` : le serveur n'a pas le
  // réglage et rend le mois calendaire, le client corrige — la réécriture d'URL
  // qui suit rejoue les loaders sur le bon cycle.
  const [startDay, setStartDay] = useState(monthStartDay);

  const from = search.dateFrom ? parseISO(search.dateFrom) : undefined;
  const to = search.dateTo ? parseISO(search.dateTo) : undefined;
  const anchor = from ?? new Date();

  // Bornes du sélecteur. La haute est aujourd'hui — il n'y a rien à regarder
  // après. La basse est la première transaction de l'espace, et son absence
  // (requête en vol, ou espace encore vide) vaut « pas de borne basse » plutôt
  // que « rien n'est cliquable » : un calendrier libre pendant 200 ms est
  // préférable à un calendrier mort.
  const { data: earliest } = useQuery(
    trpc.transactions.earliestDate.queryOptions(),
  );
  const today = new Date();
  const min = earliest ? parseISO(earliest) : undefined;
  // Comparé au *cycle* et non au jour : un mois est atteignable dès qu'il
  // intersecte les bornes, sinon le mois de la première transaction et le mois
  // en cours seraient l'un et l'autre inatteignables.
  const monthReachable = (date: Date) => {
    const cycle = cycleOf(date, startDay);
    return (!min || cycle.end >= min) && cycle.start <= today;
  };

  const commit = (start: Date, end: Date) => {
    setDraft(null);
    setOpen(false);
    setSearch({ dateFrom: toISODate(start), dateTo: toISODate(end) });
  };

  // Un pas se prend sur les *bords* du cycle affiché et non par `addMonths` :
  // avec un départ au 29 ou plus, le décalage d'un mois est écrêté en février et
  // ne se rejoue pas à l'envers — la période dériverait à chaque aller-retour.
  const stepTarget = (delta: number) => {
    const cycle = cycleOf(anchor, startDay);
    return delta < 0 ? subDays(cycle.start, 1) : addDays(cycle.end, 1);
  };

  // La garde est ici et pas seulement sur le bouton : une URL fabriquée à la
  // main ou un signet périmé peut poser un `dateFrom` hors bornes, et le pas
  // suivant repartirait de là.
  const shiftMonth = (delta: number) => {
    const target = stepTarget(delta);
    if (!monthReachable(target)) return;
    setSearch(monthBounds(target, startDay));
  };

  // Changer le départ recale la période affichée sur le cycle correspondant :
  // le réglage n'a d'effet visible que là, et un écran resté sur l'ancienne
  // plage laisserait croire qu'il n'a rien fait.
  const changeStartDay = (day: number) => {
    setStartDay(day);
    setMonthStartDay(day);
    setSearch(monthBounds(anchor, day));
  };

  return (
    <div className="ml-auto flex items-center gap-1">
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
              className="num hover:text-foreground flex h-6 items-center gap-1.5 pr-0.5 font-medium tracking-[-0.01em] whitespace-nowrap"
              // Le serveur ignore le jour de départ : l'intitulé rendu par SSR
              // peut différer de celui du client jusqu'à la réécriture d'URL.
              suppressHydrationWarning
              {...props}
            >
              {periodLabel(from, to, startDay)}
              <span className="text-subtle text-label flex-none">▾</span>
            </button>
          )}
        />
        <PopoverContent align="end" className="w-auto gap-0 p-3.5">
          <div className="flex gap-4">
            <div className="flex w-28 flex-none flex-col gap-0.5 pt-0.5">
              {buildPresets(anchor, startDay).map((preset) => {
                const active =
                  !!from &&
                  !!to &&
                  isSameDay(preset.from, from) &&
                  isSameDay(preset.to, to);
                // Désactivé, jamais rogné : un raccourci dont on aurait déplacé
                // la borne mentirait sur ce qu'il vient de sélectionner. Un
                // raccourci qui *chevauche* les bornes reste bon — « Ce mois »
                // sur le mois en cours finit après aujourd'hui, et c'est le mois
                // entier qu'on veut (les budgets comptent en mois pleins).
                const reachable =
                  (!min || preset.to >= min) && preset.from <= today;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={!reachable}
                    onClick={() => commit(preset.from, preset.to)}
                    className={cn(
                      "text-control py-1 text-left disabled:pointer-events-none disabled:opacity-40",
                      active
                        ? "text-primary font-semibold"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {preset.label}
                  </button>
                );
              })}

              {/* Cycle de paie : « mon mois commence le 28 ». Un `<select>`
                  natif — 31 valeurs, aucune saisie à valider. Les jours 29 à 31
                  sont ramenés au dernier jour des mois plus courts. */}
              <label className="border-border text-subtle text-label mt-2 flex flex-col gap-1 border-t pt-2">
                Le mois commence le
                <select
                  value={startDay}
                  onChange={(e) => changeStartDay(Number(e.target.value))}
                  className="border-border bg-card text-foreground text-control rounded-md border px-1.5 py-1"
                >
                  {MONTH_START_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </label>
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
                // `endMonth` est la *fin* du mois en cours et non aujourd'hui :
                // le mois courant doit rester entièrement visible et
                // sélectionnable comme mois plein. Ce sont les jours d'après
                // qu'on grise, pas le mois.
                startMonth={min ? startOfMonth(min) : undefined}
                endMonth={endOfMonth(today)}
                disabled={
                  min ? { before: min, after: today } : { after: today }
                }
                selected={
                  draft ? { from: draft } : from ? { from, to } : undefined
                }
                onSelect={(_range, day) => {
                  if (!draft) {
                    setDraft(day);
                    return;
                  }
                  const [start, end] =
                    day < draft ? [day, draft] : [draft, day];
                  commit(start, end);
                }}
                className="p-0"
              />

              <div className="mt-2.5 flex items-center gap-2.5">
                <span className="text-subtle num text-meta">
                  {draft
                    ? `Début : ${dayMonthFr.format(draft)} — choisir la fin`
                    : from && to
                      ? // Les bornes en clair : sur un cycle qui ne commence pas
                        // le 1er, l'intitulé de l'en-tête ne dit qu'un nom de mois.
                        `${dayMonthFr.format(from)} – ${dayMonthFr.format(to)} · ${differenceInCalendarDays(to, from) + 1} j`
                      : "Toute la période"}
                </span>
                <button
                  type="button"
                  className="text-primary text-control ml-auto"
                  onClick={() => setOpen(false)}
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="border-border bg-card ml-1.5 flex items-center gap-px rounded-md border p-px">
        <StepButton
          label="Période précédente"
          onClick={() => shiftMonth(-1)}
          disabled={!monthReachable(stepTarget(-1))}
          glyph="‹"
        />
        <span className="bg-border h-3 w-px" />
        <StepButton
          label="Période suivante"
          onClick={() => shiftMonth(1)}
          disabled={!monthReachable(stepTarget(1))}
          glyph="›"
        />
      </div>
    </div>
  );
}

function StepButton({
  label,
  glyph,
  onClick,
  disabled,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="text-subtle hover:bg-accent hover:text-foreground text-body flex h-5 w-6 items-center justify-center rounded-sm disabled:pointer-events-none disabled:opacity-30"
    >
      {glyph}
    </button>
  );
}
