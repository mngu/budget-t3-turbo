"use client";

import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { Drill } from "./use-drill";
import { CategoryIcon } from "~/component/category-icon";
import { DRILL } from "./use-drill";

export interface RingSlice {
  name: string;
  total: number;
  color: string;
  /** Nom d'icône Lucide, `null` pour les sous-catégories (elles n'en ont pas). */
  icon: string | null;
}

// Géométrie de la maquette, reprise au chiffre près : le facteur ~0,77 du
// portage s'applique aux gouttières de page, jamais aux entrailles d'un
// graphique. Le viewBox est carré, l'anneau se dimensionne par le CSS.
const RADIUS = 112;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_GAP = 2.5;
const ARC_WIDTH = { base: 30, hover: 36, active: 44 };
// Halo coloré sous chaque arc. La maquette le calcule sur la teinte à une
// clarté fixe ; ici il est mélangé depuis la couleur déjà résolue au thème, et
// c'est le *taux* de mélange qui change de thème — d'où les deux variables CSS
// posées sur le conteneur plutôt qu'un `resolvedTheme` relu en JS.
const ARC_GLOW = { base: "6px", lit: "9px" };
// Une part plus fine que ça n'a pas la place de porter son icône.
const ICON_MIN_SHARE = 0.022;
// …et il en faut une bien plus grosse pour porter son intitulé, qui déborde de
// l'anneau vers l'extérieur et croiserait celui de sa voisine.
const LABEL_MIN_SHARE = 0.045;
// Rayon de l'étiquette, en % de la boîte carrée : elle avance vers l'extérieur
// à mesure que l'arc s'épaissit.
const ICON_RADIUS = { base: 40, hover: 42, active: 43.5 };

interface Arc {
  slice: RingSlice;
  index: number;
  /** Part du total du niveau, et origine angulaire (la somme des précédentes). */
  share: number;
  offset: number;
  active: boolean;
  hovered: boolean;
}

const dash = (share: number) => {
  const length = Math.max(CIRCUMFERENCE * share - ARC_GAP, 1.5);
  return `${length.toFixed(2)} ${(CIRCUMFERENCE - length).toFixed(2)}`;
};

/** L'arc « en avant » : le survolé, sinon l'ouvert. C'est lui que le centre nomme. */
const litArc = (arcs: Arc[]) =>
  arcs.find((arc) => arc.hovered) ?? arcs.find((arc) => arc.active) ?? null;

// Hors du composant : le compilateur React interdit d'accumuler dans une
// variable déclarée dans le corps d'un rendu.
function buildArcs(
  slices: RingSlice[],
  activeIndex: number | null,
  hover: string | null,
): Arc[] {
  const sum = slices.reduce((acc, slice) => acc + slice.total, 0);
  const arcs: Arc[] = [];
  let offset = 0;
  for (const [index, slice] of slices.entries()) {
    const share = sum > 0 ? slice.total / sum : 0;
    arcs.push({
      slice,
      index,
      share,
      offset,
      active: index === activeIndex,
      hovered: slice.name === hover,
    });
    offset += share;
  }
  return arcs;
}

export function CategoryRing({
  slices,
  activeIndex,
  onActivate,
  drill,
  children,
}: {
  slices: RingSlice[];
  /** Part « ouverte » : les autres s'estompent. `null` quand rien n'est ouvert. */
  activeIndex: number | null;
  /** Absent = niveau en lecture seule : les arcs ne répondent plus au clic. */
  onActivate?: (index: number) => void;
  /**
   * L'étape du forage, telle que `useDrill` la rend. Toute phase non nulle
   * **replie** l'anneau : arcs à longueur nulle, étiquettes et centre effacés.
   * Le séquencement, lui, appartient à l'appelant — c'est lui qui commande le
   * niveau.
   */
  drill: Drill;
  /**
   * Le contenu de la carte du centre, à qui l'anneau passe la part qu'il met en
   * avant (survolée, sinon ouverte). Composition plutôt qu'une demi-douzaine de
   * props : ce que le centre affiche est une décision de l'écran, la carte de
   * verre et son effacement pendant le forage sont celles de l'anneau.
   */
  children: (lit: RingSlice | null) => ReactNode;
}) {
  // Le survol est de l'affichage pur : il n'a rien à faire dans l'écran. Retenu
  // par **nom** et non par index — un index survivrait au changement de niveau
  // en désignant une part qui n'a plus rien à voir, un nom absent ne désigne
  // simplement plus rien.
  const [hover, setHover] = useState<string | null>(null);

  const arcs = buildArcs(slices, activeIndex, hover);

  // Replié : les arcs à longueur nulle, l'anneau reculé d'un cran et presque
  // effacé. Le repli est *rapide et sec* (courbe d'entrée), le dépliage lent et
  // amorti (courbe de sortie) — c'est ce contraste qui donne au geste le sens
  // d'une plongée plutôt que d'un simple fondu.
  const folded = drill.phase !== null;
  const easing = drill.phase === "out" ? DRILL.outEase : DRILL.inEase;
  const duration = drill.phase === "out" ? DRILL.outMs : DRILL.inMs;

  return (
    // `container-type: size` plutôt qu'un ResizeObserver : la boîte carrée se
    // déduit en CSS de la place restante (`min(100cqw,100cqh)`), sans état ni
    // rendu serveur à zéro qui ferait clignoter l'anneau à l'hydratation.
    //
    // La gouttière latérale est la place des intitulés d'arcs, qui débordent de
    // la boîte : c'est le `- 130` que la maquette retranche à la largeur avant
    // d'en tirer le diamètre. En padding plutôt qu'en arithmétique — `cqw` se
    // mesure sur la boîte de contenu, l'anneau se rétrécit donc tout seul. Sans
    // elle, rien ne se voit tant que la hauteur commande le diamètre (le cas
    // d'une fenêtre large) et l'intitulé de gauche se fait couper dès que c'est
    // la largeur qui commande.
    <div className="[container-type:size] flex min-h-0 min-w-0 flex-1 items-center justify-center px-16">
      <div
        // Taux de mélange du halo, plus soutenu sur fond sombre. Lu par le
        // `filter` de chaque arc, qui ne peut pas porter de variante `dark:` :
        // sa couleur dépend de l'arc et vit donc en style inline.
        className="relative aspect-square w-[min(100cqw,100cqh)] [--arc-glow-lit:48%] [--arc-glow:32%] dark:[--arc-glow-lit:65%] dark:[--arc-glow:45%]"
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox="0 0 340 340"
          // Durée et courbe en variables CSS, transition en **classe** : c'est
          // ce qui laisse `motion-reduce` la neutraliser (un style inline gagne
          // contre toute règle), comme pour les arcs plus bas.
          className="absolute inset-0 size-full origin-center [transition:transform_var(--drill-duration)_var(--drill-ease),opacity_140ms_ease] motion-reduce:transition-none"
          style={
            {
              // Le sens du forage se lit dans la rotation : on quitte le niveau
              // en tournant d'un côté, on arrive au suivant depuis l'autre.
              transform: folded
                ? drill.phase === "out"
                  ? `rotate(${drill.dir > 0 ? -6 : 6}deg) scale(0.93)`
                  : `rotate(${drill.dir > 0 ? 6 : -6}deg) scale(1.05)`
                : "rotate(0deg) scale(1)",
              opacity: folded ? 0.15 : 1,
              "--drill-duration": `${duration}ms`,
              "--drill-ease": easing,
            } as CSSProperties
          }
        >
          {arcs.map((arc) => (
            <circle
              // Clé = le nom, et surtout **pas** la position (contrairement aux
              // lignes de `BreakdownRow`, où le nom change à chaque niveau) :
              // c'est ce qui borne l'animation à ce qui a du sens. Un poste qui
              // reste glisse vers sa nouvelle géométrie ; un poste qui apparaît
              // se pose là, sans transition. Avec une clé positionnelle le même
              // cercle passait d'une catégorie à l'autre, et toute part insérée
              // faisait balayer l'anneau à celles qui la suivent.
              key={arc.slice.name}
              cx="170"
              cy="170"
              r={RADIUS}
              fill="none"
              stroke={arc.slice.color}
              strokeOpacity={activeIndex === null || arc.active ? 1 : 0.22}
              strokeWidth={
                arc.active
                  ? ARC_WIDTH.active
                  : arc.hovered
                    ? ARC_WIDTH.hover
                    : ARC_WIDTH.base
              }
              strokeDasharray={
                folded ? `0 ${CIRCUMFERENCE.toFixed(2)}` : dash(arc.share)
              }
              transform={`rotate(${(-90 + arc.offset * 360).toFixed(3)} 170 170)`}
              style={
                {
                  filter: `drop-shadow(0 0 ${
                    arc.active || arc.hovered ? ARC_GLOW.lit : ARC_GLOW.base
                  } color-mix(in oklab, ${arc.slice.color} var(${
                    arc.active || arc.hovered ? "--arc-glow-lit" : "--arc-glow"
                  }), transparent))`,
                  "--dash-duration": `${duration}ms`,
                  "--dash-ease": easing,
                  // Le dépliage part du premier arc et court vers le dernier ;
                  // le repli, lui, est d'un seul bloc — sans quoi la moitié de
                  // l'anneau serait encore là quand le niveau change.
                  "--dash-delay":
                    drill.phase === "out"
                      ? "0ms"
                      : `${Math.min(arc.index * DRILL.staggerMs, DRILL.staggerMaxMs)}ms`,
                } as CSSProperties
              }
              // La transition est une classe et non un style inline : c'est ce
              // qui laisse `motion-reduce` la neutraliser, un style inline
              // gagnant contre toute règle. Seule `stroke-dasharray` suit le
              // changement de *données* : le `transform` en est délibérément
              // absent, alors qu'il porte l'origine angulaire de l'arc (la somme
              // des parts qui le précèdent). L'arc se pose donc d'un coup à sa
              // nouvelle origine pendant que sa longueur glisse — c'est un
              // arbitrage assumé pour la sobriété du mouvement, pas un oubli :
              // l'y remettre relance le balayage de tout l'anneau.
              className={cn(
                "[transition:stroke-width_200ms_cubic-bezier(0.22,1,0.36,1),stroke-opacity_200ms_ease,filter_200ms_ease,stroke-dasharray_var(--dash-duration)_var(--dash-ease)_var(--dash-delay)] motion-reduce:transition-none",
                onActivate && "cursor-pointer",
              )}
              // Pas de survol pendant le forage : il désignerait une part de
              // l'anneau replié, et le centre nommerait un poste qui s'en va.
              onMouseEnter={() => !folded && setHover(arc.slice.name)}
              onClick={
                onActivate &&
                ((event) => {
                  event.stopPropagation();
                  onActivate(arc.index);
                })
              }
            >
              <title>{arc.slice.name}</title>
            </circle>
          ))}
        </svg>

        {/* Les étiquettes s'effacent toutes ensemble pendant le forage : une
            opacité de groupe, que celle de chaque étiquette vient multiplier. */}
        <div
          className="pointer-events-none absolute inset-0 [transition:opacity_130ms_ease] motion-reduce:transition-none"
          style={{ opacity: folded ? 0 : 1 }}
        >
          {arcs.map((arc) =>
            arc.share > ICON_MIN_SHARE &&
            (arc.slice.icon !== null || arc.share > LABEL_MIN_SHARE) ? (
              <ArcLabel
                key={arc.slice.name}
                arc={arc}
                dimmed={activeIndex !== null}
              />
            ) : null,
          )}
        </div>

        {/* Le centre ne capte pas la souris : il survolerait les arcs. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[24%]">
          {/* Carte translucide posée sur les arcs : c'est le flou qui la
              détache du halo coloré, pas un aplat opaque — le fond doit rester
              devinable au travers. Elle s'efface pendant le forage : elle nomme
              le niveau, elle ne peut pas rester lisible pendant qu'il change. */}
          <div
            className="border-glass-border bg-glass flex max-w-full flex-col items-center rounded-xl border px-5 pt-4 pb-3.5 text-center shadow-[0_1px_2px_oklch(0_0_0/0.05),0_22px_44px_-22px_oklch(0.25_0.03_265/0.4)] backdrop-blur-[14px] backdrop-saturate-[1.3] [transition:opacity_130ms_ease] motion-reduce:transition-none"
            style={{ opacity: folded ? 0 : 1 }}
          >
            {children(litArc(arcs)?.slice ?? null)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Remonter d'un niveau, posé dans la carte du centre. Il vit ici et non dans
 * l'écran parce que le centre est `pointer-events-none` (il survolerait les
 * arcs) : le bouton doit se les rendre pour lui seul, sans quoi il s'affiche
 * sans jamais répondre au clic.
 *
 * À ne rendre que sélection posée — sinon il creuse un trou permanent sous le
 * libellé du centre.
 */
export function RingBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Revenir à toutes les catégories"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="border-border-strong bg-card text-muted-foreground hover:border-subtle hover:text-foreground text-control pointer-events-auto mt-3 flex h-6 items-center gap-1.5 rounded-full border pr-2.5 pl-2 font-semibold whitespace-nowrap"
    >
      <ArrowLeftIcon className="size-3" aria-hidden />
      Toutes catégories
      {/* La touche est *aussi* une voie de sortie, mais elle ne s'annonçait
          nulle part : la maquette la fait dire par le bouton plutôt que
          d'ajouter une mention à part. */}
      <kbd className="border-border bg-surface-2 num text-subtle text-label ml-0.5 flex h-4 items-center rounded-sm border px-1 font-medium tracking-[0.02em]">
        Esc
      </kbd>
    </button>
  );
}

/**
 * L'étiquette d'un arc, posée juste au-delà de l'anneau : l'icône du poste puis
 * son intitulé, tous deux *fuyant vers l'extérieur*. Le point ancré n'est donc
 * pas le centre du bloc mais son bord intérieur, et la moitié gauche de
 * l'anneau lit le bloc en miroir (`flex-row-reverse`), sans quoi l'icône se
 * retrouverait du côté du vide et le texte à cheval sur les arcs.
 *
 * L'intitulé ne s'affiche qu'au-delà de `LABEL_MIN_SHARE` — au niveau des
 * sous-catégories il est seul, elles n'ont pas d'icône (voir `RingSlice`).
 *
 * Écart assumé avec la maquette : elle ne pose rien du tout sur une parente
 * sans icône (son jeu d'icônes est en dur, `Autres: null`), là où « aucune
 * icône choisie » est ici un état courant. Le poste garde donc son intitulé, et
 * seule la pastille creuse disparaît — c'est l'anneau, pas la liste : un arc
 * anonyme n'a aucun autre moyen de se nommer.
 */
function ArcLabel({ arc, dimmed }: { arc: Arc; dimmed: boolean }) {
  const angle = (arc.offset + arc.share / 2) * 2 * Math.PI - Math.PI / 2;
  const lit = arc.active || arc.hovered;
  const radius = arc.active
    ? ICON_RADIUS.active
    : arc.hovered
      ? ICON_RADIUS.hover
      : ICON_RADIUS.base;
  const right = Math.cos(angle) >= 0;

  return (
    <div
      // Même durée que l'arc pour la position, même durée que le survol pour
      // l'estompage : l'étiquette glisse *avec* sa part, elle ne la rattrape pas.
      className={cn(
        "absolute flex -translate-y-1/2 items-center gap-1 whitespace-nowrap [transition:left_200ms_cubic-bezier(0.22,1,0.36,1),top_200ms_cubic-bezier(0.22,1,0.36,1),opacity_160ms_ease] motion-reduce:transition-none",
        right
          ? "translate-x-[2px]"
          : "translate-x-[calc(-100%_-_2px)] flex-row-reverse",
      )}
      style={{
        left: `${(50 + Math.cos(angle) * radius).toFixed(2)}%`,
        top: `${(50 + Math.sin(angle) * radius).toFixed(2)}%`,
        opacity: lit ? 1 : dimmed ? 0.18 : 0.62,
      }}
    >
      {arc.slice.icon !== null && (
        <span className="flex flex-none">
          <CategoryIcon
            name={arc.slice.icon}
            className={lit ? "size-5" : "size-4"}
            color={arc.slice.color}
          />
        </span>
      )}
      {arc.share > LABEL_MIN_SHARE && (
        <span
          className={cn(
            "text-meta tracking-[-0.01em]",
            lit ? "font-[650]" : "font-[550]",
          )}
          // La teinte de l'arc serait illisible en corps 11 : la maquette pose
          // un ton dérivé de la même teinte mais poussé vers le texte — ici un
          // mélange vers `--foreground`, qui s'inverse tout seul de thème en
          // thème (sombre en clair, clair en sombre).
          style={{
            color: `color-mix(in oklab, ${arc.slice.color} 32%, var(--foreground))`,
          }}
        >
          {arc.slice.name}
        </span>
      )}
    </div>
  );
}
