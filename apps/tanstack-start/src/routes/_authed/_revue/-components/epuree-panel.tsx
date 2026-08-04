"use client";

import { useEffect, useState } from "react";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";



import { cn } from "@budget/ui";



import type { BreakdownItem } from "./breakdown-list";
import type { RingSlice } from "./category-ring";
import type { Delta } from "~/lib/history";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro, euro0, sharePercent, signedEuro0 } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryIcon } from "../../categories/-components/category-icon";
import { BreakdownList } from "./breakdown-list";
import { CategoryRing } from "./category-ring";
import { KpiBand } from "./kpi-band";


/** Une catégorie parente de sortie, telle que l'anneau la manipule. */
export interface EpureeCategory {
  /** Libellé affiché — « Sans catégorie » pour le groupe sans rattachement. */
  name: string;
  /**
   * Valeur à poser dans le search param `category` pour désigner ce poste :
   * le libellé affiché n'en tient pas lieu, le groupe sans rattachement se
   * filtrant par la sentinelle `"none"` (voir `categoryFilterLabel`).
   */
  filter: string;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide de `categories.icon`, `null` si aucune n'est choisie. */
  icon: string | null;
  /**
   * Sous-catégories, déjà triées du plus gros au plus petit, « À classer »
   * compris — c'est l'ordre que `transactions.byCategory` garantit, et dont les
   * nuances de la teinte parente dérivent.
   *
   * `filter: null` désigne le segment « À classer », que `byCategory` fabrique
   * (le reliquat porté par la parente elle-même) et qui n'est **pas** une ligne
   * de `categories` : aucune valeur de `category` ne le sélectionne, le poser
   * dans l'URL donnerait un filtre sans résultat.
   */
  subs: { name: string; total: number; filter: string | null }[];
  delta: Delta | null;
}

// Les chiffres de tête sont à l'euro près dans la maquette (`euro0`/`signedEuro0`,
// partagés avec le bandeau de `/transactions` depuis `~/lib/format`) ; le détail
// — liste, survol — garde le `euro` à deux décimales.
const signedPercent = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
  signDisplay: "exceptZero",
});

// Largeur de la colonne de droite. La maquette la calcule (`rdStackPx = listW -
// 46`) parce qu'elle mesure tout ; ici les deux valeurs sont posées, la liste à
// 300 px.
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
  const { search, setSearch } = useRevueSearch();

  // `sel` et « l'arc surligné » ne sont pas deux tailles du même geste, et c'est
  // tout le ressort de l'écran : cliquer un arc met un poste **en avant** sans
  // quitter le niveau des parents, cliquer une ligne de la liste fait
  // *descendre* l'anneau dans ses sous-catégories.
  //
  // L'arc surligné vit dans l'URL (`category`) et non dans un état local : c'est
  // la même sélection que celle des trois autres écrans, et elle les suit. Le
  // niveau, lui, reste local — un nom de catégorie ne peut pas dire à la fois
  // « surligné parmi ses pairs » et « ouvert sur ses enfants », et c'est `sel`
  // qui départage les deux lectures du même param.
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Le segment « À classer » n'a pas de filtre qui le désigne (voir
  // `EpureeCategory.subs`) : son surlignage est le seul qui reste local.
  const [aClasserSel, setAClasserSel] = useState(false);

  const clear = () => {
    setSel(null);
    setHover(null);
    setAClasserSel(false);
    // Ne naviguer que s'il y a un filtre à retirer : `setSearch` relance le
    // loader de la route, et Échap est *aussi* la touche qui referme les
    // popovers de l'en-tête — sans cette garde, chaque fermeture de sélecteur
    // rejouerait les agrégats de l'écran pour rien.
    if (search.category !== undefined) setSearch({ category: undefined });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Le param désigne une sous-catégorie : l'anneau *descend* de lui-même, sinon
  // l'arc surligné ne serait pas à l'écran. C'est ce qui rend une URL partagée
  // fidèle à ce qu'elle montrait.
  const subOwner = search.category
    ? (categories.find((c) =>
        c.subs.some((s) => s.filter === search.category),
      ) ?? null)
    : null;
  const selected =
    subOwner ?? (sel ? (categories.find((c) => c.name === sel) ?? null) : null);
  // Un poste ne peut pas être « en avant » et « ouvert » à la fois : descendre
  // dans une catégorie remet l'anneau à plat sur ses enfants.
  const opened = selected
    ? null
    : (categories.find((c) => c.filter === search.category) ?? null);
  const parent = opened ?? selected;
  // Sous-catégorie surlignée. Le param prime toujours : le pense-bête local du
  // segment « À classer » ne vaut qu'à défaut, et seulement tant que le filtre
  // est resté sur la parente — sans quoi retirer le filtre depuis le rappel
  // laisserait un arc surligné que plus rien dans l'URL ne justifie.
  const subByParam =
    selected?.subs.find(
      (s) => s.filter !== null && s.filter === search.category,
    ) ?? null;
  const subSelected =
    subByParam ??
    (aClasserSel && selected && search.category === selected.filter
      ? (selected.subs.find((s) => s.filter === null) ?? null)
      : null);
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
  const activeName = selected
    ? (subSelected?.name ?? null)
    : (opened?.name ?? null);
  const activeIndex = activeName
    ? slices.findIndex((s) => s.name === activeName)
    : -1;
  const focus =
    (hover !== null ? slices[hover] : null) ??
    (activeIndex >= 0 ? slices[activeIndex] : null) ??
    null;

  const listRows: BreakdownItem[] = parent
    ? parent.subs.map((sub, index) => ({
        name: sub.name,
        total: sub.total,
        color: shadeCategoryColor(parentColor, index, parent.subs.length),
      }))
    : categories.map((category) => ({
        name: category.name,
        total: category.total,
        color: resolveColor(category.color),
        // Descendre pose *aussi* le filtre : c'est `sel` qui distingue les deux
        // lectures du même param (voir plus haut), pas l'absence de `category`.
        onSelect: () => {
          setSel(category.name);
          setHover(null);
          setAClasserSel(false);
          setSearch({ category: category.filter });
        },
      }));

  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-4.5 pb-4">
      {/* `flex-wrap` n'est pas dans la maquette, qui ne descend pas sous 460 px :
          il évite que la colonne de droite, à largeur fixe, ne pousse le solde
          hors de l'écran sur une fenêtre étroite. */}
      <div className="flex min-h-[68px] flex-1 flex-none flex-wrap items-end gap-x-[clamp(11px,1.85vw,25px)] gap-y-3">
        <div className="min-w-0 flex-1">
          <KpiBand
            label="Solde du mois"
            balance={balance}
            balanceDelta={balanceDelta}
            // Les deux rangées de flux **cèdent la place** au poste ouvert
            // (`showFlow: !parent` dans la maquette) : elles ne se compriment
            // pas à côté de lui. C'est ce qui laisse au poste toute la droite du
            // bandeau, et au solde du mois le seul rôle d'ancre pendant qu'on
            // navigue dans l'anneau.
            flow={{
              revenues: { amount: revenues, delta: revenuesDelta },
              expenses: { amount: expenses, delta: expensesDelta },
            }}
          />
        </div>

        {parent && (
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
            {/* Deux décimales, comme les lignes de la liste : ce chiffre-là est
                un montant précis, pas un ordre de grandeur. */}
            <span className="num min-w-24 flex-none text-right text-[19px] font-medium tracking-[-0.02em]">
              {euro.format(parent.total)}
            </span>
          </Stack>
        )}
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
          // Les arcs sont dans l'ordre de `subs` / `categories`, dont `slices`
          // est le calque : l'index désigne la même part des deux côtés.
          onActivate={(index) => {
            const slice = selected ? selected.subs[index] : categories[index];
            if (!slice) return;
            // Ancrer la descente avant de toucher au param. Sans ça, une visite
            // arrivée par une sous-catégorie (`sel` encore nul, le niveau ne
            // tenant qu'au param) remonterait d'un cran dès que le filtre
            // revient sur la parente — ce que font le dépointage et « À classer ».
            if (selected) setSel(selected.name);
            // « À classer » n'est pas une catégorie de la base : le poser dans
            // l'URL donnerait un filtre sans résultat. Seul segment dont le
            // surlignage ne quitte pas la page.
            if (slice.filter === null) {
              setAClasserSel((current) => !current);
              // Le filtre revient sur la parente : c'est ce que le segment
              // désigne de plus précis, et c'est aussi ce qui ancre le
              // pense-bête local (voir `subSelected`).
              setSearch({ category: selected?.filter });
              return;
            }
            setAClasserSel(false);
            setSearch({
              category:
                search.category === slice.filter
                  ? // Retirer le surlignage d'une sous-catégorie ne remonte pas
                    // d'un cran : on est toujours *dans* le poste ouvert, et le
                    // filtre revient donc à lui, pas à rien.
                    selected?.filter
                  : slice.filter,
            });
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

        <BreakdownList rows={listRows} fold={parent !== null} />
      </div>
    </div>
  );
}

/**
 * Colonne de droite du bandeau, le poste ouvert : intitulé calé à gauche,
 * contenu sur une rangée de 33 px calée à droite, écart en dessous. Elle
 * n'existe que tant qu'un poste l'occupe — c'est la contrepartie du bandeau de
 * flux, qui disparaît au même moment.
 */
function Stack({
  label,
  delta,
  worseWhenUp,
  children,
}: {
  label: string;
  delta: Delta | null;
  worseWhenUp: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={STACK_CLASS}>
      <div className="label-caps self-start whitespace-nowrap">{label}</div>
      <div className="mt-0.5 flex h-[33px] w-full min-w-0 items-center justify-between gap-3.5">
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
