"use client";

import { useEffect, useState } from "react";
import {
  MinusIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@budget/ui";

import type { BreakdownRow } from "./breakdown-list";
import type { RingSlice } from "./category-ring";
import { HEADER_ICON_BUTTON } from "~/component/theme-button";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";
import { CategoryIcon } from "../../categories/-components/category-icon";
import { BreakdownList } from "./breakdown-list";
import { CategoryRing } from "./category-ring";

/** Écart d'un montant à sa moyenne de référence. */
export interface Delta {
  /** En euros, signé. */
  amount: number;
  /** En pourcentage de la moyenne, signé. `null` si la moyenne vaut zéro. */
  pct: number | null;
}

/** Une catégorie parente de sortie, telle que l'anneau la manipule. */
export interface EpureeCategory {
  /** Libellé affiché — « Sans catégorie » pour le groupe sans rattachement. */
  name: string;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide de `categories.icon`, `null` si aucune n'est choisie. */
  icon: string | null;
  /**
   * Sous-catégories, déjà triées du plus gros au plus petit, « À classer »
   * compris — c'est l'ordre que `transactions.byCategory` garantit, et dont les
   * nuances de la teinte parente dérivent.
   */
  subs: { name: string; total: number }[];
  delta: Delta | null;
}

// Les chiffres de tête sont à l'euro près dans la maquette — les centimes ne se
// lisent pas à 30 px et font sauter la colonne d'un mois à l'autre. Le détail
// (liste, survol) garde le `euro` partagé, à deux décimales.
const euro0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const signedEuro0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});
const signedPercent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

const AMOUNT_CLASS =
  "num text-[clamp(24px,2.4vw,30px)] leading-[1.1] font-medium tracking-[-0.03em]";

// Largeur de la colonne de droite : celle de la liste, moins la place du bouton
// de fermeture. La maquette la calcule (`rdStackPx = listW - 46`) parce qu'elle
// mesure tout ; ici les deux valeurs sont posées, la liste à 300 px.
const STACK_CLASS = "flex w-[254px] max-w-full flex-none flex-col items-end";

export function EpureePanel({
  categories,
  revenues,
  expenses,
  balance,
  revenuesDelta,
  expensesDelta,
  balanceDelta,
}: {
  /** Postes de sortie, du plus gros au plus petit. */
  categories: EpureeCategory[];
  revenues: number;
  expenses: number;
  balance: number;
  revenuesDelta: Delta | null;
  expensesDelta: Delta | null;
  balanceDelta: Delta | null;
}) {
  const resolveColor = useCategoryColor();

  // `sel` et `open` ne sont pas deux tailles du même geste, et c'est tout le
  // ressort de l'écran : `open` (clic sur un arc) met un poste en avant sans
  // quitter le niveau des parents, `sel` (clic sur une ligne de la liste) fait
  // *descendre* l'anneau dans ses sous-catégories.
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [subSel, setSubSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const clear = () => {
    setSel(null);
    setOpen(null);
    setSubSel(null);
    setHover(null);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSel(null);
      setOpen(null);
      setSubSel(null);
      setHover(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const selected = sel
    ? (categories.find((c) => c.name === sel) ?? null)
    : null;
  // Un poste ne peut pas être « en avant » et « ouvert » à la fois : descendre
  // dans une catégorie remet l'anneau à plat sur ses enfants.
  const opened =
    !selected && open
      ? (categories.find((c) => c.name === open) ?? null)
      : null;
  const parent = opened ?? selected;
  const parentColor = parent ? resolveColor(parent.color) : "";

  // Une sous-catégorie n'a pas de couleur propre à l'écran : c'est un palier de
  // la teinte de son parent, du plus dense au plus proche de la surface — même
  // convention que les barres de la revue.
  const slices: RingSlice[] = selected
    ? selected.subs.map((sub, index) => ({
        name: sub.name,
        total: sub.total,
        color: shadeCategoryColor(
          resolveColor(selected.color),
          index,
          selected.subs.length,
        ),
        icon: null,
      }))
    : categories.map((category) => ({
        name: category.name,
        total: category.total,
        color: resolveColor(category.color),
        icon: category.icon,
      }));

  const levelTotal = slices.reduce((acc, s) => acc + s.total, 0);
  const activeName = selected ? subSel : (opened?.name ?? null);
  const activeIndex = activeName
    ? slices.findIndex((s) => s.name === activeName)
    : -1;
  const focus =
    (hover !== null ? slices[hover] : null) ??
    (activeIndex >= 0 ? slices[activeIndex] : null) ??
    null;

  const listRows: BreakdownRow[] = parent
    ? parent.subs.map((sub, index) => ({
        name: sub.name,
        total: sub.total,
        color: shadeCategoryColor(parentColor, index, parent.subs.length),
      }))
    : categories.map((category) => ({
        name: category.name,
        total: category.total,
        color: resolveColor(category.color),
        onSelect: () => {
          setSel(category.name);
          setHover(null);
          setSubSel(null);
        },
      }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5 pb-4">
      {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous 460 px :
          il évite que la colonne de droite, à largeur fixe, ne pousse les deux
          chiffres de gauche hors de l'écran sur une fenêtre étroite. */}
      <div className="flex min-h-[68px] flex-none flex-wrap items-end gap-x-[clamp(11px,1.9vw,32px)] gap-y-3">
        <Kpi
          label="Solde"
          amount={euro0.format(balance)}
          amountClassName={balance < 0 ? "text-bad" : "text-ok"}
          delta={balanceDelta}
          worseWhenUp={false}
        />
        <Kpi
          label="Entrées"
          amount={euro0.format(revenues)}
          amountClassName="text-ok"
          delta={revenuesDelta}
          worseWhenUp={false}
        />

        <div className="ml-auto flex flex-none items-center gap-3">
          {/* Le poste ouvert prend la place des sorties, il ne s'ajoute pas à
              côté : c'est la même colonne, calée sur la largeur de la liste, et
              c'est ce qui évite au bandeau de chiffres de sauter au premier
              clic. Rien n'apparaît ni ne disparaît, le contenu change. */}
          {parent ? (
            <Stack
              label={`${parent.subs.length} sous-catégorie${parent.subs.length > 1 ? "s" : ""}`}
              // Une sortie qui monte est une mauvaise nouvelle, à l'inverse des
              // entrées : les pastilles de l'écran n'ont pas toutes la même
              // polarité.
              delta={parent.delta}
              worseWhenUp
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="flex flex-none self-center"
                  style={{ color: parentColor }}
                >
                  <CategoryIcon name={parent.icon} className="size-[15px]" />
                </span>
                <span className="line-clamp-2 min-w-0 text-sm leading-[1.15] font-semibold tracking-[-0.01em]">
                  {parent.name}
                </span>
              </span>
              {/* Deux décimales, comme les lignes de la liste : ce chiffre-là
                  est un montant précis, pas un ordre de grandeur. */}
              <span className="num min-w-24 flex-none text-right text-[19px] font-medium tracking-[-0.02em]">
                {euro.format(parent.total)}
              </span>
            </Stack>
          ) : (
            <Stack
              label="Sorties"
              delta={expensesDelta}
              worseWhenUp
              align="baseline"
            >
              <span className={cn(AMOUNT_CLASS, "text-bad")}>
                {euro0.format(expenses)}
              </span>
            </Stack>
          )}
          <button
            type="button"
            onClick={clear}
            title="Revenir au mois (Échap)"
            aria-label="Revenir au mois"
            // `invisible` et non `hidden` : le bouton garde sa place, sinon la
            // colonne de droite se décalerait à l'ouverture d'un poste.
            className={cn(HEADER_ICON_BUTTON, !parent && "invisible")}
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Cliquer à côté referme, comme la touche Échap. L'anneau et la liste
          s'étirent sur toute la place disponible (pas d'`items-center`) : c'est
          de là que l'anneau tire sa taille, sa boîte carrée étant en
          confinement de taille — centrée dans un conteneur à dimension
          automatique, elle s'effondrerait à zéro. Empilés sous `lg`, où la
          liste passe sous l'anneau plutôt que de disparaître. */}
      <div
        className="relative mt-5 flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-5"
        onClick={clear}
      >
        <CategoryRing
          slices={slices}
          activeIndex={activeIndex >= 0 ? activeIndex : null}
          hoverIndex={hover}
          onHover={setHover}
          onActivate={(index) => {
            const name = slices[index]?.name;
            if (name === undefined) return;
            if (selected) {
              setSubSel((current) => (current === name ? null : name));
              return;
            }
            setOpen((current) => (current === name ? null : name));
          }}
          center={{
            icon: focus
              ? selected
                ? null
                : (categories.find((c) => c.name === focus.name)?.icon ?? null)
              : (selected?.icon ?? null),
            iconColor: focus ? focus.color : parentColor || "var(--subtle)",
            name: focus?.name ?? selected?.name ?? "",
            amount: euro0.format(focus?.total ?? selected?.total ?? levelTotal),
            label: focus
              ? `${sharePercent(focus.total, levelTotal)} ${selected ? "du poste" : "du total"}`
              : selected
                ? `${sharePercent(selected.total, expenses)} du total`
                : "Sorties",
          }}
        />

        <BreakdownList rows={listRows} />
      </div>
    </div>
  );
}

function Kpi({
  label,
  amount,
  amountClassName,
  delta,
  worseWhenUp,
}: {
  label: string;
  amount: string;
  amountClassName?: string;
  delta: Delta | null;
  /** Sens dans lequel une hausse est une mauvaise nouvelle. */
  worseWhenUp: boolean;
}) {
  return (
    <div className="min-w-max flex-[0_1_auto]">
      <div className="label-caps">{label}</div>
      <div className={cn(AMOUNT_CLASS, "mt-0.5", amountClassName)}>
        {amount}
      </div>
      <DeltaRow delta={delta} worseWhenUp={worseWhenUp} />
    </div>
  );
}

/**
 * Colonne de droite du bandeau : intitulé calé à gauche, contenu sur une rangée
 * de 33 px calée à droite, écart en dessous. Deux occupants qui se relaient —
 * les sorties du mois, ou le poste ouvert.
 */
function Stack({
  label,
  delta,
  worseWhenUp,
  align = "center",
  children,
}: {
  label: string;
  delta: Delta | null;
  worseWhenUp: boolean;
  /** Le gros chiffre des sorties s'aligne sur sa ligne de base, pas son centre. */
  align?: "center" | "baseline";
  children: React.ReactNode;
}) {
  return (
    <div className={STACK_CLASS}>
      <div className="label-caps self-start whitespace-nowrap">{label}</div>
      <div
        className={cn(
          "mt-0.5 flex h-[33px] w-full min-w-0 justify-between gap-3.5",
          align === "baseline" ? "items-baseline justify-end" : "items-center",
        )}
      >
        {children}
      </div>
      <DeltaRow delta={delta} worseWhenUp={worseWhenUp} justify="end" />
    </div>
  );
}

function DeltaRow({
  delta,
  worseWhenUp,
  justify,
}: {
  delta: Delta | null;
  worseWhenUp: boolean;
  justify?: "end";
}) {
  return (
    <div
      className={cn(
        "mt-1.5 flex min-h-[19px] items-center gap-2.5 whitespace-nowrap",
        justify === "end" && "justify-end",
      )}
    >
      {delta ? (
        <>
          <DeltaPill delta={delta} worseWhenUp={worseWhenUp} />
          <DeltaAmount delta={delta} />
        </>
      ) : (
        <span className="text-subtle text-[11px]">
          Pas d'historique de comparaison
        </span>
      )}
    </div>
  );
}

function DeltaPill({
  delta,
  worseWhenUp,
}: {
  delta: Delta | null;
  worseWhenUp: boolean;
}) {
  // Pas de pourcentage quand la référence vaut zéro : « +∞ % » ne dit rien que
  // l'écart en euros ne dise mieux.
  if (!delta) return null;
  if (delta.pct === null) return null;
  const bad = worseWhenUp ? delta.amount > 0 : delta.amount < 0;
  const Trend =
    delta.amount > 0
      ? TrendingUpIcon
      : delta.amount < 0
        ? TrendingDownIcon
        : MinusIcon;
  return (
    <span
      className={cn(
        "num flex h-[19px] items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold",
        bad ? "bg-bad-soft text-bad" : "bg-ok-soft text-ok",
      )}
    >
      <Trend className="size-[13px]" aria-hidden />
      {signedPercent.format(delta.pct)} %
    </span>
  );
}

// L'écart en euros, second rôle de la pastille : premier sacrifié quand la
// fenêtre se resserre.
function DeltaAmount({ delta }: { delta: Delta | null }) {
  if (!delta) return null;
  return (
    <span className="num text-subtle text-[11px] max-xl:hidden">
      {signedEuro0.format(delta.amount)} vs moy.
    </span>
  );
}
