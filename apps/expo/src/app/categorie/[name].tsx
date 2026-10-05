import { router, Stack, useLocalSearchParams } from "expo-router";
import { Typography } from "heroui-native";
import { View } from "react-native";

import {
  familyBudget,
  getCategoryLabel,
  NO_CATEGORY_NAME,
} from "@budget/api/schemas";
import { Breakdown } from "~/components/breakdown";
import { BudgetGauge } from "~/components/budget-gauge";
import { TransactionList } from "~/components/transaction-list";
import { useCategoryColors } from "~/lib/category-color";
import { useOverview } from "~/lib/overview";

// A category's gauge, its sub-categories if any, then its transactions. Names
// are unique within a space, so a name alone finds a parent or a child.
export default function CategoryDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const parent = useOverview().data?.find(
    (candidate) =>
      candidate.name === name ||
      candidate.children?.some((child) => child.name === name),
  );
  const children = parent?.children ?? [];
  const childIndex = children.findIndex((child) => child.name === name);
  const child = children[childIndex];
  const { resolve, shade } = useCategoryColors();
  const parentColor = resolve(parent?.color ?? null);
  const label = getCategoryLabel(name);
  const value = (child ?? parent)?.totalAmount ?? 0;
  const budget =
    (child ? child.budgetAmount : parent && familyBudget(parent)) ?? null;

  return (
    <>
      <Stack.Screen
        options={{
          title: label,
          ...(child && {
            headerBackTitle: getCategoryLabel(parent?.name ?? null),
          }),
        }}
      />
      <TransactionList
        category={name === NO_CATEGORY_NAME ? "none" : name}
        header={
          <View className="gap-6 pb-4">
            {/* Inset like the list rows' content, so the column lines up. */}
            {parent && (
              <View className="px-4">
                <BudgetGauge
                  label={label}
                  iconName={parent.icon}
                  color={
                    child
                      ? shade(parentColor, childIndex, children.length)
                      : parentColor
                  }
                  value={value}
                  budget={budget}
                  max={Math.max(value, budget ?? 0)}
                />
              </View>
            )}
            {!child && children.length > 0 && (
              <Breakdown
                label={label}
                totalBudget={budget}
                rows={children.map((sub, index) => ({
                  label: sub.name,
                  iconName: parent?.icon ?? null,
                  color: shade(parentColor, index, children.length),
                  value: sub.totalAmount ?? 0,
                  budget: sub.budgetAmount,
                  onPress: () =>
                    router.push({
                      pathname: "/categorie/[name]",
                      params: { name: sub.name },
                    }),
                }))}
              />
            )}
            <Typography
              type="body-xs"
              color="muted"
              className="px-4 font-semibold tracking-wider uppercase"
            >
              Transactions
            </Typography>
          </View>
        }
      />
    </>
  );
}
