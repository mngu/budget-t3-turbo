import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Typography } from "heroui-native";
import { View } from "react-native";

import { useCategoryColors } from "~/lib/category-color";
import { euro, signedEuro } from "~/lib/format";
import { usePeriod } from "~/lib/period";
import { trpc } from "~/lib/trpc";

import { Gauge } from "./gauge";

export function KpiBand() {
  const { range } = usePeriod();
  const { data } = useQuery({
    ...trpc.transactions.globalStats.queryOptions(range),
    placeholderData: keepPreviousData,
  });
  const { resolve: resolveColor } = useCategoryColors();
  if (!data) return null;

  const { credit, debit } = data;
  const balance = credit - debit;
  const max = Math.max(credit, debit);

  return (
    <View className="gap-2">
      <View>
        <Typography
          type="body-xs"
          color="muted"
          className="font-semibold tracking-wider uppercase"
        >
          Solde
        </Typography>
        <Typography
          type="h1"
          className={`tabular-nums ${balance < 0 ? "text-danger" : "text-success"}`}
        >
          {signedEuro.format(balance)}
        </Typography>
      </View>
      <KpiBar
        label="Entrées"
        value={credit}
        max={max}
        color={resolveColor("#00c65a")}
      />
      <KpiBar
        label="Sorties"
        value={debit}
        max={max}
        color={resolveColor("#fb2c36")}
      />
    </View>
  );
}

function KpiBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <Typography
        type="body-xs"
        color="muted"
        className="w-16 font-semibold tracking-wider uppercase"
      >
        {label}
      </Typography>
      <View className="flex-1">
        <Gauge value={value} max={max} color={color} />
      </View>
      <Typography className="w-28 text-right tabular-nums">
        {euro.format(value)}
      </Typography>
    </View>
  );
}
