import { useQuery } from "@tanstack/react-query";
import { Button, Typography, useThemeColor } from "heroui-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { View } from "react-native";

import { monthRange, usePeriod } from "~/lib/period";
import { trpc } from "~/lib/trpc";

// Steps month by month within the data, like the web picker's arrows: from the
// earliest transaction to today.
export function PeriodPicker() {
  const { month, setMonth, label } = usePeriod();
  const { data: earliest } = useQuery(
    trpc.transactions.earliestDate.queryOptions(),
  );
  const iconColor = useThemeColor("foreground");

  const step = (offset: number) => {
    const target = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    return {
      target,
      reachable:
        target <= new Date() &&
        (!earliest || monthRange(target).dateTo >= earliest),
    };
  };
  const previous = step(-1);
  const next = step(1);

  return (
    <View className="flex-row items-center gap-1">
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        accessibilityLabel="Période précédente"
        isDisabled={!previous.reachable}
        onPress={() => setMonth(previous.target)}
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
        onPress={() => setMonth(next.target)}
      >
        <ChevronRight size={20} color={iconColor} />
      </Button>
    </View>
  );
}
