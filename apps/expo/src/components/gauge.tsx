import { View } from "react-native";

interface GaugeProps {
  value: number;
  budget?: number | null;
  max: number;
  color: string;
}

export function Gauge({ value, budget, max, color }: GaugeProps) {
  const pct = (amount: number) => `${(amount / (max || 1)) * 100}%` as const;
  const over = budget ? value - budget : 0;

  return (
    <View className="bg-default h-2 flex-row rounded-full">
      <View
        className="rounded-full"
        style={{
          width: pct(budget ? Math.min(value, budget) : value),
          backgroundColor: color,
        }}
      />
      {!!budget &&
        (over > 0 ? (
          <View
            className="bg-danger ml-0.5 rounded-full"
            style={{ width: pct(over) }}
          />
        ) : (
          <View
            className="bg-foreground absolute inset-y-0 -ml-0.5 w-0.5"
            style={{ left: pct(budget) }}
          />
        ))}
    </View>
  );
}
