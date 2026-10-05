import { router } from "expo-router";
import { Spinner, Typography } from "heroui-native";
import { ScrollView, View } from "react-native";

import {
  familyBudget,
  getCategoryLabel,
  NO_CATEGORY_NAME,
} from "@budget/api/schemas";
import { Breakdown } from "~/components/breakdown";
import { KpiBand } from "~/components/kpi-band";
import { useCategoryColors } from "~/lib/category-color";
import { useOverview } from "~/lib/overview";

export default function Review() {
  const { data: overview, error } = useOverview();
  const { resolve: resolveColor } = useCategoryColors();

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
    >
      <KpiBand />
      <Breakdown
        label="Dépenses"
        totalBudget={overview.reduce(
          (sum, category) => sum + (familyBudget(category) ?? 0),
          0,
        )}
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
