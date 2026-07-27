import { Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { CategoryBreakdownItem } from "@budget/api";
import { Card, CardContent, CardHeader, CardTitle } from "@budget/ui/card";

import { useCategoryColor } from "~/component/category/lib/category-color";
import { euro, sharePercent } from "~/lib/format";

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

export function CategoryPieChart({
  title,
  data,
}: {
  title: string;
  data: CategoryBreakdownItem[];
}) {
  const resolve = useCategoryColor();
  const coloredData = data.map((entry) => ({
    ...entry,
    color: resolve(entry.color),
    fill: resolve(entry.color),
  }));

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
                data={coloredData}
                dataKey="total"
                nameKey="category"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Legend />
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
      <div className="flex items-baseline justify-between gap-6 font-medium">
        <span>{item.category}</span>
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
