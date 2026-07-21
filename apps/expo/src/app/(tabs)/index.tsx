import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LegendList } from "@legendapp/list";
import { useInfiniteQuery } from "@tanstack/react-query";

import { TransactionListItem } from "~/components/transaction-list-item";
import { trpcClient } from "~/utils/api";

export function getNextTransactionsPageParam(
  pages: { rows: unknown[]; total: number }[],
): number | undefined {
  const loaded = pages.reduce((acc, p) => acc + p.rows.length, 0);
  const total = pages.at(-1)?.total ?? 0;
  return loaded < total ? pages.length + 1 : undefined;
}

export default function TransactionsScreen() {
  const { data, isPending, isError, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["transactions.list.infinite"],
      queryFn: ({ pageParam }) =>
        trpcClient.transactions.list.query({
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
      {rows.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-muted-foreground">Aucune transaction.</Text>
        </View>
      ) : (
        <LegendList
          data={rows}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => (
            <TransactionListItem transaction={item} onPress={() => undefined} />
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
    </SafeAreaView>
  );
}
