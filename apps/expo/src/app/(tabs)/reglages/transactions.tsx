import { Stack, useLocalSearchParams } from "expo-router";

import { TransactionList } from "~/components/transaction-list";

// A category's transactions across the whole space, as the web's preview:
// settings speak of the category, not of the month on screen.
export default function CategoryTransactions() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return (
    <>
      {/* The back button names the category already. */}
      <Stack.Screen options={{ title: "Transactions" }} />
      <TransactionList
        filters={{
          category,
          dateFrom: undefined,
          dateTo: undefined,
          bank: undefined,
        }}
      />
    </>
  );
}
