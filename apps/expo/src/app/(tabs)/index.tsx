import { router } from "expo-router";
import { Spinner, Typography } from "heroui-native";
import { useEffect, useState } from "react";
import { AppState, RefreshControl, ScrollView, View } from "react-native";

import {
  familyBudget,
  getCategoryLabel,
  NO_CATEGORY_NAME,
  sumBy,
} from "@budget/api/schemas";
import { Breakdown } from "~/components/breakdown";
import { KpiBand } from "~/components/kpi-band";
import { useCategoryColors } from "~/lib/category-color";
import { useOverview } from "~/lib/overview";
import { queryClient, trpc, trpcClient } from "~/lib/trpc";

// Bypasses useMutation: the global MutationCache would refetch every query
// even when no balance moved.
async function refreshBalances() {
  try {
    if (await trpcClient.connections.refreshBalances.mutate()) {
      await queryClient.invalidateQueries(
        trpc.connections.balances.queryFilter(),
      );
    }
  } catch {
    // A stale balance stays on screen with its date; nothing to tell the user.
  }
}

export default function Review() {
  const { data: overview, error } = useOverview();
  const { resolve: resolveColor } = useCategoryColors();
  const [refreshing, setRefreshing] = useState(false);

  // The tab stays mounted in the background: coming back is "opening the app".
  useEffect(() => {
    void refreshBalances();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshBalances();
    });
    return () => subscription.remove();
  }, []);
  // The band, the donut and the list each own a query: refresh whatever is on screen.
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.refetchQueries({ type: "active" }),
      refreshBalances(),
    ]);
    setRefreshing(false);
  };

  if (error) {
    return (
      <Typography color="muted" className="p-4">
        Impossible de charger la revue du mois.
      </Typography>
    );
  }
  if (!overview) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} />
      }
    >
      <KpiBand />
      <Breakdown
        label="Dépenses"
        totalBudget={sumBy(overview, (category) => familyBudget(category) ?? 0)}
        rows={overview.map((category) => ({
          label: getCategoryLabel(category.name),
          iconName: category.icon,
          color: resolveColor(category.color),
          value: category.totalAmount ?? 0,
          budget: familyBudget(category),
          onPress: () =>
            router.push({
              pathname: "/categorie/[name]",
              params: { name: category.name ?? NO_CATEGORY_NAME },
            }),
        }))}
      />
    </ScrollView>
  );
}
