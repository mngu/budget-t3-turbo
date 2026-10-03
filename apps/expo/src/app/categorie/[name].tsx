import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView } from "react-native";

import { familyBudget, getCategoryLabel } from "@budget/api/schemas";
import { Breakdown } from "~/components/breakdown";
import { useCategoryColors } from "~/lib/category-color";
import { useOverview } from "~/lib/overview";

// A parent category's children, read from the review's cached overview.
export default function CategoryDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const category = useOverview().data?.find(
    (candidate) => getCategoryLabel(candidate.name) === name,
  );
  const { resolve, shade } = useCategoryColors();
  const color = resolve(category?.color ?? null);
  const children = category?.children ?? [];

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: name }} />
      {category && (
        <Breakdown
          label={name}
          totalBudget={familyBudget(category)}
          rows={children.map((child, index) => ({
            label: child.name,
            iconName: category.icon,
            color: shade(color, index, children.length),
            value: child.totalAmount ?? 0,
            budget: child.budgetAmount,
          }))}
        />
      )}
    </ScrollView>
  );
}
