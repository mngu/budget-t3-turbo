import { Text } from "react-native";
import { PieChart } from "react-native-gifted-charts";

import type { CategoryBreakdownItem } from "@budget/api";

import { Card } from "~/components/ui/card";
import { toPieChartData } from "~/lib/category-breakdown";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export function CategoryBreakdownChart({
  title,
  items,
}: {
  title: string;
  items: CategoryBreakdownItem[];
}) {
  const data = toPieChartData(items);
  const total = items.reduce((acc, i) => acc + i.total, 0);

  return (
    <Card className="mx-4 items-center gap-2 p-4">
      <Text className="text-foreground font-semibold">{title}</Text>
      {data.length === 0 ? (
        <Text className="text-muted-foreground py-8 text-sm">
          Aucune donnée pour cette période.
        </Text>
      ) : (
        <PieChart data={data} donut radius={80} showText textSize={10} />
      )}
      <Text className="text-foreground text-lg font-bold">
        {euro.format(total)}
      </Text>
    </Card>
  );
}
