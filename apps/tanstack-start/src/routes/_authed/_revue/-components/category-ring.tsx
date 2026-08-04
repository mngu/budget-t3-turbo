"use client";

import { ArrowLeftIcon } from "lucide-react";

import { CategoryIcon } from "../../categories/-components/category-icon";

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
// Rayon de l'icône, en % de la boîte carrée : elle avance vers l'extérieur à
// mesure que l'arc s'épaissit.
const ICON_RADIUS = { base: 40, hover: 42, active: 43.5 };

const dash = (
  circumference: number,
  share: number,
  gap: number,
  min: number,
) => {
  const length = Math.max(circumference * share - gap, min);
  return `${length.toFixed(2)} ${(circumference - length).toFixed(2)}`;
};

// Part de chaque arc et origine angulaire (la somme de celles qui le précèdent).
// Hors du composant : le compilateur React interdit d'accumuler dans une
// variable déclarée dans le corps d'un rendu.
function arcLayout(totals: number[]): { share: number; offset: number }[] {
  const sum = totals.reduce((acc, total) => acc + total, 0);
  const layout: { share: number; offset: number }[] = [];
  let offset = 0;
  for (const total of totals) {
    const share = sum > 0 ? total / sum : 0;
    layout.push({ share, offset });
    offset += share;
  }
  return layout;
}

export function CategoryRing({
  slices,
  activeIndex,
  hoverIndex,
  onHover,
  onActivate,
  center,
}: {
  slices: RingSlice[];
  /** Part « ouverte » : les autres s'estompent. `null` quand rien n'est ouvert. */
  activeIndex: number | null;
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
  onActivate: (index: number) => void;
  center: {
    icon: string | null;
    iconColor: string;
    name: string;
    amount: string;
    label: string;
    /**
     * Remonter d'un niveau. Absent tant que rien n'est sélectionné : le bouton
     * n'occupe alors aucune place, plutôt que de creuser un trou permanent sous
     * le libellé du centre.
     */
    onBack?: () => void;
  };
}) {
  const layout = arcLayout(slices.map((s) => s.total));
  const arcs = slices.map((slice, index) => {
    const active = activeIndex === index;
    const hovered = hoverIndex === index;
    return {
      slice,
      index,
      share: layout[index]?.share ?? 0,
      offset: layout[index]?.offset ?? 0,
      active,
      hovered,
      width: active
        ? ARC_WIDTH.active
        : hovered
          ? ARC_WIDTH.hover
          : ARC_WIDTH.base,
    };
  });

  return (
    // `container-type: size` plutôt qu'un ResizeObserver : la boîte carrée se
    // déduit en CSS de la place restante (`min(100cqw,100cqh)`), sans état ni
    // rendu serveur à zéro qui ferait clignoter l'anneau à l'hydratation.
    <div className="[container-type:size] flex min-h-0 min-w-0 flex-1 items-center justify-center">
      <div
        // Taux de mélange du halo, plus soutenu sur fond sombre. Lu par le
        // `filter` de chaque arc, qui ne peut pas porter de variante `dark:` :
        // sa couleur dépend de l'arc et vit donc en style inline.
        className="relative aspect-square w-[min(100cqw,100cqh)] [--arc-glow-lit:48%] [--arc-glow:32%] dark:[--arc-glow-lit:65%] dark:[--arc-glow:45%]"
        onMouseLeave={() => onHover(null)}
      >
        <svg viewBox="0 0 340 340" className="absolute inset-0 size-full">
          {arcs.map((arc) => (
            <circle
              key={arc.slice.name}
              cx="170"
              cy="170"
              r={RADIUS}
              fill="none"
              stroke={arc.slice.color}
              strokeOpacity={activeIndex === null ? 1 : arc.active ? 1 : 0.22}
              strokeWidth={arc.width}
              strokeDasharray={dash(CIRCUMFERENCE, arc.share, ARC_GAP, 1.5)}
              transform={`rotate(${(-90 + arc.offset * 360).toFixed(3)} 170 170)`}
              style={{
                filter: `drop-shadow(0 0 ${
                  arc.active || arc.hovered ? ARC_GLOW.lit : ARC_GLOW.base
                } color-mix(in oklab, ${arc.slice.color} var(${
                  arc.active || arc.hovered ? "--arc-glow-lit" : "--arc-glow"
                }), transparent))`,
              }}
              // La transition est une classe et non un style inline : c'est ce
              // qui laisse `motion-reduce` la neutraliser, un style inline
              // gagnant contre toute règle.
              className="cursor-pointer [transition:stroke-width_200ms_cubic-bezier(0.22,1,0.36,1),stroke-opacity_200ms_ease,filter_200ms_ease] motion-reduce:transition-none"
              onMouseEnter={() => onHover(arc.index)}
              onClick={(event) => {
                event.stopPropagation();
                onActivate(arc.index);
              }}
            >
              <title>{arc.slice.name}</title>
            </circle>
          ))}
        </svg>

        {arcs.map((arc) =>
          arc.share > ICON_MIN_SHARE && arc.slice.icon ? (
            <IconOnRing
              key={arc.slice.name}
              arc={arc}
              dimmed={activeIndex !== null}
            />
          ) : null,
        )}

        {/* Le centre ne capte pas la souris : il survolerait les arcs. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-[24%]">
          {/* Carte translucide posée sur les arcs : c'est le flou qui la
              détache du halo coloré, pas un aplat opaque — le fond doit rester
              devinable au travers. */}
          <div className="border-glass-border bg-glass flex max-w-full flex-col items-center rounded-[18px] border px-[19px] pt-[15px] pb-3.5 text-center shadow-[0_1px_2px_oklch(0_0_0/0.05),0_22px_44px_-22px_oklch(0.25_0.03_265/0.4)] backdrop-blur-[14px] backdrop-saturate-[1.3]">
            {center.icon !== null && (
              <span className="mb-2" style={{ color: center.iconColor }}>
                <CategoryIcon name={center.icon} className="size-5" />
              </span>
            )}
            {center.name && (
              <div className="mb-1 max-w-full truncate text-xs font-semibold tracking-[-0.015em]">
                {center.name}
              </div>
            )}
            <div className="num text-[23px] leading-none font-medium tracking-[-0.03em]">
              {center.amount}
            </div>
            <div className="label-caps mt-1 whitespace-nowrap">
              {center.label}
            </div>
            {/* Le centre est `pointer-events-none` (il survolerait les arcs) :
                le bouton doit se les rendre pour lui seul, sans quoi il
                s'affiche sans jamais répondre au clic. */}
            {center.onBack && (
              <button
                type="button"
                title="Revenir à toutes les catégories"
                onClick={(event) => {
                  event.stopPropagation();
                  center.onBack?.();
                }}
                className="border-border-strong bg-card text-muted-foreground hover:border-subtle hover:text-foreground pointer-events-auto mt-[11px] flex h-6 items-center gap-1.5 rounded-full border pr-2.5 pl-2 text-[11.5px] font-semibold whitespace-nowrap"
              >
                <ArrowLeftIcon className="size-[13px]" aria-hidden />
                Toutes catégories
                {/* La touche est *aussi* une voie de sortie, mais elle ne
                    s'annonçait nulle part : la maquette la fait dire par le
                    bouton plutôt que d'ajouter une mention à part. */}
                <kbd className="border-border bg-surface-2 num text-subtle ml-0.5 flex h-4 items-center rounded-[4px] border px-[5px] text-[9.5px] font-medium tracking-[0.02em]">
                  Esc
                </kbd>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IconOnRing({
  arc,
  dimmed,
}: {
  arc: {
    slice: RingSlice;
    share: number;
    offset: number;
    active: boolean;
    hovered: boolean;
  };
  dimmed: boolean;
}) {
  const angle = (arc.offset + arc.share / 2) * 2 * Math.PI - Math.PI / 2;
  const radius = arc.active
    ? ICON_RADIUS.active
    : arc.hovered
      ? ICON_RADIUS.hover
      : ICON_RADIUS.base;
  const lit = arc.active || arc.hovered;

  return (
    <div
      className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${(50 + Math.cos(angle) * radius).toFixed(2)}%`,
        top: `${(50 + Math.sin(angle) * radius).toFixed(2)}%`,
        color: arc.slice.color,
        opacity: lit ? 1 : dimmed ? 0.18 : 0.62,
      }}
    >
      <CategoryIcon
        name={arc.slice.icon}
        className={lit ? "size-5" : "size-[17px]"}
      />
    </div>
  );
}
