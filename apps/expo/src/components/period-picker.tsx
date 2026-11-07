import { useQuery } from "@tanstack/react-query";
import { Button, Typography, useThemeColor } from "heroui-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { View } from "react-native";

import { cycleOf, toISODate } from "@budget/api/schemas";
import { usePeriod } from "~/lib/period";
import { trpc } from "~/lib/trpc";

// Steps cycle by cycle within the data, like the web picker's arrows: from the
// earliest transaction to today.
export function PeriodPicker() {
  const { cycle, startDay, setAnchor, label } = usePeriod();
  const { data: earliest } = useQuery(
    trpc.transactions.earliestDate.queryOptions(),
  );
  const iconColor = useThemeColor("foreground");

  // Step from cycle boundaries: adding a month clamps short months and drifts.
  const step = (target: Date) => {
    const { start, end } = cycleOf(target, startDay);
    return {
      target,
      reachable:
        start <= new Date() && (!earliest || toISODate(end) >= earliest),
    };
  };
  const { start, end } = cycle;
  const previous = step(
    new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1),
  );
  const next = step(
    new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1),
  );

  return (
    <View className="flex-row items-center gap-1">
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        accessibilityLabel="Période précédente"
        isDisabled={!previous.reachable}
        onPress={() => setAnchor(previous.target)}
      >
        <ChevronLeft size={20} color={iconColor} />
      </Button>
      <Typography className="w-36 text-center font-semibold capitalize">
        {label}
      </Typography>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        accessibilityLabel="Période suivante"
        isDisabled={!next.reachable}
        onPress={() => setAnchor(next.target)}
      >
        <ChevronRight size={20} color={iconColor} />
      </Button>
    </View>
  );
}
