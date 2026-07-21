import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { SlidersHorizontalIcon } from "lucide-react-native";

import type { TransactionFilters } from "~/components/transaction-filters-sheet";
import { CategoryBreakdownChart } from "~/components/category-breakdown-chart";
import { CategoryPickerSheet } from "~/components/category-picker-sheet";
import { TransactionFiltersSheet } from "~/components/transaction-filters-sheet";
import { TransactionListItem } from "~/components/transaction-list-item";
import { trpc, trpcClient } from "~/utils/api";

export function getNextTransactionsPageParam(
  pages: { rows: unknown[]; total: number }[],
): number | undefined {
  const loaded = pages.reduce((acc, p) => acc + p.rows.length, 0);
  const total = pages.at(-1)?.total ?? 0;
  return loaded < total ? pages.length + 1 : undefined;
}

export default function TransactionsScreen() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const { data: categories = [] } = useQuery(
    trpc.categories.list.queryOptions(),
  );

  const { data: expensesByCategory = [] } = useQuery({
    queryKey: ["transactions.byCategory", filters, "debit"],
    queryFn: () =>
      trpcClient.transactions.byCategory.query({
        ...filters,
        direction: "debit",
        // byCategory agrège sans pagination — champs requis par le schéma partagé.
        page: 1,
        sort: "date",
        order: "desc",
      }),
  });
  const { data: revenuesByCategory = [] } = useQuery({
    queryKey: ["transactions.byCategory", filters, "credit"],
    queryFn: () =>
      trpcClient.transactions.byCategory.query({
        ...filters,
        direction: "credit",
        page: 1,
        sort: "date",
        order: "desc",
      }),
  });

  const { data, isPending, isError, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["transactions.list.infinite", filters],
      queryFn: ({ pageParam }) =>
        trpcClient.transactions.list.query({
          ...filters,
          page: pageParam,
          sort: "date",
          order: "desc",
        }),
      initialPageParam: 1,
      getNextPageParam: (_lastPage, pages) =>
        getNextTransactionsPageParam(pages),
    });

  const rows = data?.pages.flatMap((p) => p.rows) ?? [];

  if (isPending) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="bg-background flex-1 items-center justify-center px-4">
        <Text className="text-destructive text-center">
          Impossible de charger les transactions.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-foreground text-lg font-bold">Transactions</Text>
        <Pressable onPress={() => setFiltersOpen(true)}>
          <SlidersHorizontalIcon className="text-foreground" />
        </Pressable>
      </View>
      <View className="flex-row gap-4">
        <CategoryBreakdownChart
          title="Dépenses par catégorie"
          items={expensesByCategory}
        />
        <CategoryBreakdownChart
          title="Revenus par catégorie"
          items={revenuesByCategory}
        />
      </View>
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Aucune transaction.</Text>
        </View>
      ) : (
        <LegendList
          data={rows}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item}
              onPress={() => setSelectedId(item.id)}
            />
          )}
          estimatedItemSize={72}
          recycleItems
          onEndReached={() => {
            if (!isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? <ActivityIndicator className="my-4" /> : null
          }
        />
      )}
      <CategoryPickerSheet
        transactionId={selectedId}
        categories={categories}
        onClose={() => setSelectedId(null)}
      />
      <TransactionFiltersSheet
        isOpen={filtersOpen}
        value={filters}
        categories={categories}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
      />
    </SafeAreaView>
  );
}
