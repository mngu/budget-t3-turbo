import { useState } from "react";
import { getRouteApi } from "@tanstack/react-router";

import type { CategoryBreakdownItem } from "@budget/api";
import { cn } from "@budget/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { useTheme } from "@budget/ui/theme";
import {
  createTooltipHandle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@budget/ui/tooltip";

import { useCategoryColor } from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";

const routeApi = getRouteApi("/_authed/");

// La part qui regroupe les transactions sans catégorie sort de l'agrégat sans
// libellé (aucune ligne `categories` à joindre). Le filtre, lui, l'adresse par
// la valeur sentinelle "none" et non par un nom.
const UNCATEGORIZED_LABEL = "Sans catégorie";
const UNCATEGORIZED_FILTER = "none";

// Opacité des segments non sélectionnés. Le graphique n'étant volontairement
// pas filtré par `category` (voir le loader), c'est ce qui matérialise la
// sélection sans faire disparaître le reste de la répartition.
//
// Le palier dépend du thème parce que la composition n'est pas symétrique :
// sur fond clair l'alpha délave vers le blanc et reste lisible bas, sur fond
// sombre il écrase vers le noir et 0,25 éteignait toute la barre — le segment
// sélectionné n'y ressortait plus.
const DIMMED_OPACITY = { light: 0.25, dark: 0.5 } as const;

// Épaisseur de la barre : sous le plafond de 24px, et assez haute pour que
// chaque segment reste une cible de clic confortable.
const BAR_HEIGHT = 20;

// Sous quelques pixels, une sous-catégorie marginale disparaît de la barre et
// devient inatteignable au clic.
const MIN_SEGMENT_WIDTH = 3;

// Les sous-catégories ont leur propre couleur en base, mais la peindre ici
// ferait éclater la barre en confettis et effacerait le regroupement par
// parent. Les segments sont donc des paliers d'une même teinte — celle du
// parent — du plus dense (le plus gros) au plus proche de la surface de la
// carte, ce qui les fait lire comme une famille. Le mélange vise `--card` et
// non du blanc : il s'inverse tout seul en thème sombre.
const SHADE_RANGE = 55;
function shade(color: string, index: number, count: number) {
  const ratio = count <= 1 ? 100 : 100 - (index * SHADE_RANGE) / (count - 1);
  return `color-mix(in oklab, ${color} ${ratio}%, var(--card))`;
}

interface SegmentPayload {
  label: string;
  parent: string;
  total: number;
  parentTotal: number;
  color: string;
}

/**
 * Répartition par catégorie en barres horizontales empilées : une barre par
 * catégorie parente, un segment par sous-catégorie.
 *
 * Le camembert qu'elle remplace n'exposait les sous-catégories que dans son
 * tooltip. Ici les deux niveaux sont visibles d'un coup et cliquables sans
 * nouveau geste : le libellé filtre sur le parent (le filtre SQL est
 * parent-inclusif), un segment sur sa sous-catégorie.
 */
export function CategoryBreakdownChart({
  title,
  data,
  direction,
}: {
  title: string;
  data: CategoryBreakdownItem[];
  /** Sens des mouvements agrégés — posé en filtre avec la catégorie au clic. */
  direction: "debit" | "credit";
}) {
  const resolve = useCategoryColor();
  const { resolvedTheme } = useTheme();
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  // Un handle par instance : partagé entre les deux graphiques, il ferait
  // s'ouvrir la bulle de l'un au survol de l'autre.
  const [tooltip] = useState(() => createTooltipHandle<string>());

  // Un filtre posé depuis le Select ne porte pas de sens : les deux graphiques
  // surlignent alors leur segment. Posé au clic, il cible un seul graphique.
  const selected =
    search.direction === undefined || search.direction === direction
      ? search.category
      : undefined;

  const select = (value: string) => {
    const active = selected === value;
    void navigate({
      search: (prev) => ({
        ...prev,
        category: active ? undefined : value,
        direction: active ? undefined : direction,
        page: 1,
      }),
    });
  };

  // L'agrégat est déjà trié par total décroissant : la première barre donne
  // l'échelle des autres. Elle est propre à la carte — comparer une dépense à
  // un revenu n'aurait pas de sens, et une échelle commune écraserait la
  // résolution du plus petit des deux graphiques.
  const scale = data[0]?.total ?? 0;
  const chartTotal = data.reduce((acc, item) => acc + item.total, 0);

  const rows = data.map((item) => {
    const label = item.category === "" ? UNCATEGORIZED_LABEL : item.category;
    const parentValue =
      item.category === "" ? UNCATEGORIZED_FILTER : item.category;
    const color = resolve(item.color);

    // Une catégorie sans enfant (et la part « sans catégorie ») n'a pas de
    // détail : sa barre reste d'un seul tenant, dans la teinte du parent.
    const details =
      item.breakdown.length > 0
        ? item.breakdown
        : [{ category: label, total: item.total, unallocated: true }];

    const segments = details.map((detail, index) => {
      // « Non ventilé » n'est pas une catégorie : le montant est porté par le
      // parent lui-même, et aucune ligne ne répondrait à
      // `category=Non ventilé`. Le segment reste cliquable — il sélectionne
      // alors le parent, dont il fait partie.
      const filterValue = detail.unallocated ? parentValue : detail.category;
      return {
        // Deux parents peuvent avoir une sous-catégorie de même libellé, et
        // c'est cette clé qui identifie le segment survolé.
        key: `${parentValue}·${detail.category}`,
        label: detail.category,
        filterValue,
        total: detail.total,
        color: shade(color, index, details.length),
        active:
          selected === undefined ||
          selected === parentValue ||
          selected === filterValue,
      };
    });

    return {
      label,
      parentValue,
      total: item.total,
      // Une catégorie au total nul ou négatif (un remboursement qui dépasse
      // les dépenses de la période) garde sa ligne et son montant, mais pas de
      // barre : une largeur négative n'a pas de sens.
      width: scale > 0 ? (Math.max(item.total, 0) / scale) * 100 : 0,
      active: selected === undefined || segments.some((s) => s.active),
      segments,
    };
  });

  // La bulle reçoit une clé, pas l'objet décrivant le segment : Base UI
  // resynchronise son store dès que le `payload` d'un déclencheur change
  // d'identité, et un objet littéral — recréé à chaque rendu — relançait cette
  // synchronisation en boucle jusqu'à figer l'onglet. Une chaîne se compare par
  // valeur, la boucle n'a plus lieu d'être.
  const segmentsByKey = new Map(
    rows.flatMap((row) =>
      row.segments.map(
        (segment) =>
          [
            segment.key,
            {
              label: segment.label,
              parent: row.label,
              total: segment.total,
              parentTotal: row.total,
              color: segment.color,
            },
          ] as const,
      ),
    ),
  );

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            Aucune donnée pour cette période.
          </p>
        ) : (
          <TooltipProvider>
            <Tooltip handle={tooltip}>
              {({ payload }) => {
                const segment = payload
                  ? segmentsByKey.get(payload)
                  : undefined;
                return (
                  <TooltipContent>
                    {segment && <SegmentTooltip {...segment} />}
                  </TooltipContent>
                );
              }}
            </Tooltip>
            <ul className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <li key={row.parentValue}>
                  <div
                    className="flex items-baseline justify-between gap-3 text-xs transition-opacity"
                    style={{
                      opacity: row.active ? 1 : DIMMED_OPACITY[resolvedTheme],
                    }}
                  >
                    {/* Le libellé porte le filtre parent : la cible de clic
                        large et nommée qu'offrait la légende du camembert,
                        mais alignée sur sa barre. */}
                    <button
                      type="button"
                      title={row.label}
                      aria-pressed={selected === row.parentValue}
                      onClick={() => select(row.parentValue)}
                      className="focus-visible:ring-ring/50 truncate rounded-sm text-left font-medium outline-none hover:underline focus-visible:ring-3"
                    >
                      {row.label}
                    </button>
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {euro.format(row.total)}
                      <span className="ml-2">
                        {sharePercent(row.total, chartTotal)}
                      </span>
                    </span>
                  </div>
                  <div
                    className="mt-1.5 flex gap-[2px]"
                    style={{ height: BAR_HEIGHT, width: `${row.width}%` }}
                  >
                    {row.segments.map((segment, index) => (
                      <TooltipTrigger
                        key={segment.key}
                        handle={tooltip}
                        payload={segment.key}
                        // Un segment n'a pour tout contenu qu'un aplat de
                        // couleur : sans nom accessible, un lecteur d'écran
                        // n'annoncerait que « bouton », autant de fois qu'il y
                        // a de sous-catégories.
                        aria-label={`${segment.label} : ${euro.format(segment.total)}`}
                        aria-pressed={selected === segment.filterValue}
                        onClick={() => select(segment.filterValue)}
                        // Couleur et largeur viennent des données : Tailwind
                        // ne peut générer ni l'une ni l'autre.
                        style={{
                          background: segment.color,
                          flexGrow: Math.max(segment.total, 0),
                          minWidth: MIN_SEGMENT_WIDTH,
                          opacity: segment.active
                            ? 1
                            : DIMMED_OPACITY[resolvedTheme],
                        }}
                        className={cn(
                          "focus-visible:ring-ring/50 h-full basis-0 transition-[filter,opacity] outline-none hover:brightness-110 focus-visible:ring-3",
                          // Extrémité arrondie côté valeur, carrée sur la ligne
                          // de base. Jamais de contour : ce sont les 2px de gap
                          // qui séparent les segments.
                          index === row.segments.length - 1 && "rounded-r",
                        )}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

// La valeur mène, le libellé suit : au survol d'un segment le lecteur tient
// déjà la catégorie et cherche le montant.
function SegmentTooltip({
  label,
  parent,
  total,
  parentTotal,
  color,
}: SegmentPayload) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <span className="font-semibold tabular-nums">{euro.format(total)}</span>
        <span className="text-muted-foreground tabular-nums">
          {sharePercent(total, parentTotal)}
        </span>
      </div>
      <div className="mt-0.5">
        {label}
        {label !== parent && (
          <span className="text-muted-foreground"> · {parent}</span>
        )}
      </div>
    </>
  );
}
