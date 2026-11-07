import type { TransactionRow } from "@budget/api";
import type { TransactionsSearch } from "@budget/api/schemas";
import type { ReactElement } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ListGroup, Spinner, Typography } from "heroui-native";
import { FlatList, RefreshControl } from "react-native";

import { signedAmount } from "@budget/api/schemas";
import { DEFAULT_FILTERS } from "~/lib/filters";
import { signedEuro } from "~/lib/format";
import { usePeriod } from "~/lib/period";
import { trpc, trpcClient } from "~/lib/trpc";

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

// The period's transactions, loaded page by page as the list scrolls.
export function TransactionList({
  filters,
  header,
}: {
  filters?: Partial<TransactionsSearch>;
  header?: ReactElement;
}) {
  const { scope, label } = usePeriod();
  const search = { ...DEFAULT_FILTERS, ...scope, ...filters };
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isPending,
    isRefetching,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: trpc.transactions.list.queryKey(search),
    queryFn: ({ pageParam }) =>
      trpcClient.transactions.list.query({ ...search, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.rows).length < last.total
        ? pages.length + 1
        : undefined,
    placeholderData: keepPreviousData,
  });
  const filtered = !!(search.q ?? search.direction ?? search.category);

  return (
    <FlatList
      className="bg-background flex-1"
      contentContainerClassName="p-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      data={data?.pages.flatMap((p) => p.rows)}
      keyExtractor={(row) => String(row.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isPending ? (
          <Spinner className="self-center" />
        ) : (
          <Typography color="muted" className="text-center">
            {filtered
              ? "Aucune transaction ne correspond à ces filtres."
              : `Aucune transaction en ${label}.`}
          </Typography>
        )
      }
      renderItem={({ item }) => <Row row={item} />}
      onEndReached={() => hasNextPage && void fetchNextPage()}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching && !isFetchingNextPage}
          onRefresh={() => void refetch()}
        />
      }
    />
  );
}

function Row({ row }: { row: TransactionRow }) {
  const amount = signedAmount(row);
  return (
    <ListGroup.Item
      className={row.excluded ? "opacity-50" : undefined}
      onPress={() =>
        router.push({
          pathname: "/transaction/[id]",
          params: { id: row.id },
        })
      }
    >
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle numberOfLines={1}>
          {row.counterparty ?? row.description}
        </ListGroup.ItemTitle>
        <ListGroup.ItemDescription numberOfLines={1}>
          {dayMonth.format(new Date(row.bookingDate))} ·{" "}
          {row.excluded ? "Exclue" : (row.categoryPath ?? "Sans catégorie")}
        </ListGroup.ItemDescription>
      </ListGroup.ItemContent>
      <ListGroup.ItemSuffix>
        <Typography
          className={`tabular-nums ${amount > 0 ? "text-success" : ""}`}
        >
          {signedEuro(amount)}
        </Typography>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}
