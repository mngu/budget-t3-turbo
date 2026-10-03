import { ListGroup, Separator, Typography } from "heroui-native";
import { Fragment } from "react";
import { View } from "react-native";

import { usePeriod } from "~/lib/period";

import { BudgetGauge } from "./budget-gauge";
import { Donut } from "./donut";

export interface BreakdownRow {
  label: string;
  iconName: string | null;
  color: string;
  value: number;
  budget: number | null;
  onPress?: () => void;
}

// Shared by the review and a category's detail: a donut, then one gauge per row.
export function Breakdown({
  rows,
  totalBudget,
  label,
}: {
  rows: BreakdownRow[];
  totalBudget: number | null;
  label: string;
}) {
  const { label: month } = usePeriod();
  const spent = rows.filter((row) => row.value > 0);
  const total = spent.reduce((sum, row) => sum + row.value, 0);
  const max = Math.max(total, totalBudget ?? 0);

  if (spent.length === 0) {
    return (
      <Typography color="muted" className="p-4 text-center">
        Aucune dépense en {month}.
      </Typography>
    );
  }

  return (
    <View className="gap-6">
      <Donut slices={spent} label={label} />
      <ListGroup>
        {spent.map((row, index) => (
          <Fragment key={row.label}>
            {index > 0 && <Separator className="mx-4" />}
            <ListGroup.Item disabled={!row.onPress} onPress={row.onPress}>
              <BudgetGauge {...row} max={max} />
              {row.onPress ? <ListGroup.ItemSuffix /> : null}
            </ListGroup.Item>
          </Fragment>
        ))}
      </ListGroup>
    </View>
  );
}
