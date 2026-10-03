import { Typography } from "heroui-native";
import { View } from "react-native";

import { euro } from "~/lib/format";

import { CategoryIcon } from "./category-icon";
import { Gauge } from "./gauge";

interface BudgetGaugeProps {
  label: string;
  iconName: string | null;
  color: string;
  value: number;
  budget: number | null;
  max: number;
}

export function BudgetGauge({
  label,
  iconName,
  color,
  value,
  budget,
  max,
}: BudgetGaugeProps) {
  const balance = (budget ?? 0) - value;

  return (
    <View className="flex-1 gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          <CategoryIcon name={iconName} color={color} />
          <Typography numberOfLines={1} className="flex-1">
            {label}
          </Typography>
        </View>
        <Typography className="tabular-nums">{euro.format(value)}</Typography>
      </View>

      <Gauge value={value} budget={budget} max={max} color={color} />

      {!!budget && (
        <View className="flex-row justify-between">
          <Typography type="body-xs" color="muted" className="tabular-nums">
            Budget : {euro.format(budget)}
          </Typography>
          {balance < 0 ? (
            <Typography
              type="body-xs"
              className="text-danger font-semibold tabular-nums"
            >
              +{euro.format(-balance)}
            </Typography>
          ) : (
            <Typography type="body-xs" color="muted" className="tabular-nums">
              reste {euro.format(balance)}
            </Typography>
          )}
        </View>
      )}
    </View>
  );
}
