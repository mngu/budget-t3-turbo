import { getRouteApi } from "@tanstack/react-router";
import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CategoryBreakdownItem } from "@budget/api";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";
import { useTheme } from "@budget/ui/theme";

import { useCategoryColor } from "~/lib/category-color";
import { euro, sharePercent } from "~/lib/format";

const routeApi = getRouteApi("/_authed/");

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

// Le tooltip est clampé dans la zone du graphique (Card en overflow-hidden) :
// au-delà de cette limite les lignes en trop sont repliées en une seule.
const MAX_TOOLTIP_ROWS = 10;

// La part qui regroupe les transactions sans catégorie sort de l'agrégat sans
// libellé (aucune ligne `categories` à joindre). Le filtre, lui, l'adresse par
// la valeur sentinelle "none" et non par un nom.
const UNCATEGORIZED_LABEL = "Sans catégorie";
const UNCATEGORIZED_FILTER = "none";

// Opacité des parts non sélectionnées. Le graphique n'étant volontairement pas
// filtré par `category` (voir le loader), c'est ce qui matérialise la
// sélection sans faire disparaître le reste de la répartition.
//
// Le palier dépend du thème parce que la composition n'est pas symétrique :
// sur fond clair l'alpha délave vers le blanc et reste lisible bas, sur fond
// sombre il écrase vers le noir et 0,25 éteignait tout le camembert — la part
// sélectionnée n'y ressortait plus.
const DIMMED_OPACITY = { light: 0.25, dark: 0.5 } as const;

export function CategoryPieChart({
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

  // Un filtre posé depuis le Select ne porte pas de sens : les deux graphiques
  // surlignent alors leur part. Posé au clic, il cible un seul graphique.
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

  const coloredData = data.map((entry) => {
    // Surtout pas nommé `value` : recharts étale le datum dans les props du
    // secteur, où `value` est déjà son montant numérique.
    const filterValue =
      entry.category === "" ? UNCATEGORIZED_FILTER : entry.category;
    const color = resolve(entry.color);
    return {
      ...entry,
      category: entry.category === "" ? UNCATEGORIZED_LABEL : entry.category,
      filterValue,
      color,
      fill: color,
      fillOpacity:
        selected === undefined || selected === filterValue
          ? 1
          : DIMMED_OPACITY[resolvedTheme],
    };
  });

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        {data.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
            Aucune donnée pour cette période.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                className="cursor-pointer"
                data={coloredData}
                dataKey="total"
                nameKey="category"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                // recharts poserait `stroke="#fff"` : des liserés blancs, qui
                // passent pour des séparateurs tant que les fonds sont vifs
                // mais deviennent l'élément dominant dès qu'ils sont éteints.
                stroke="var(--card)"
                onClick={(_, index) => {
                  const item = coloredData[index];
                  if (item) select(item.filterValue);
                }}
              />
              <Tooltip content={<CategoryTooltip />} />
              {/* Second point d'entrée, plus large et libellé, pour les parts
                  fines. Ni les secteurs ni la légende de recharts ne sont
                  focusables au clavier : le Select des filtres reste le seul
                  chemin accessible vers la même sélection. */}
              <Legend
                wrapperStyle={{ cursor: "pointer" }}
                onClick={(_, index) => {
                  const item = coloredData[index];
                  if (item) select(item.filterValue);
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// Tooltip custom : `content` court-circuite `formatter`/`contentStyle` de
// recharts, le style et le format euro sont donc portés ici.
function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: CategoryBreakdownItem }[];
}) {
  const item = payload?.[0]?.payload;
  if (!active || !item) return null;

  const shown = item.breakdown.slice(0, MAX_TOOLTIP_ROWS);
  const hidden = item.breakdown.slice(MAX_TOOLTIP_ROWS);
  const rows =
    hidden.length === 0
      ? shown
      : [
          ...shown,
          {
            category: `${hidden.length} autres`,
            total: hidden.reduce((acc, d) => acc + d.total, 0),
            color: item.color,
          },
        ];

  return (
    <div style={tooltipStyle} className="px-3 py-2">
      <div
        className="flex items-baseline justify-between gap-6 font-medium"
        style={{ color: item.color }}
      >
        <span className="font-semibold">{item.category}</span>
        <span className="tabular-nums">{euro.format(item.total)}</span>
      </div>
      {rows.length > 0 && (
        <ul className="border-border mt-2 space-y-1 border-t pt-2">
          {rows.map((detail) => (
            <li
              key={detail.category}
              className="flex items-baseline justify-between gap-6"
            >
              <span className="text-muted-foreground">{detail.category}</span>
              <span className="tabular-nums">
                {euro.format(detail.total)}
                <span className="text-muted-foreground ml-2">
                  {sharePercent(detail.total, item.total)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
