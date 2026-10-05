import type { TransactionRow } from "@budget/api";
import type { ReactElement } from "react";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { ListGroup, Spinner, Typography } from "heroui-native";
import { FlatList } from "react-native";

import { signedEuro } from "~/lib/format";
import { usePeriod } from "~/lib/period";
import { trpc, trpcClient } from "~/lib/trpc";

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

// The period's transactions, newest first, loaded page by page as the list scrolls.
export function TransactionList({
  category,
  header,
}: {
  category?: string;
  header?: ReactElement;
}) {
  const { scope, label } = usePeriod();
  const search = { ...scope, category, sort: "date", order: "desc" } as const;
  const { data, fetchNextPage, hasNextPage, isPending } = useInfiniteQuery({
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

  return (
    <FlatList
      className="bg-background flex-1"
      contentContainerClassName="p-4"
      contentInsetAdjustmentBehavior="automatic"
      data={data?.pages.flatMap((p) => p.rows)}
      keyExtractor={(row) => String(row.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={
        isPending ? (
          <Spinner className="self-center" />
        ) : (
          <Typography color="muted" className="text-center">
            Aucune transaction en {label}.
          </Typography>
        )
      }
      renderItem={({ item }) => <Row row={item} />}
      onEndReached={() => hasNextPage && void fetchNextPage()}
    />
  );
}

function Row({ row }: { row: TransactionRow }) {
  const amount = (row.direction === "debit" ? -1 : 1) * Number(row.amount);
  return (
    <ListGroup.Item>
      <ListGroup.ItemContent>
        <ListGroup.ItemTitle numberOfLines={1}>
          {row.counterparty ?? row.description}
        </ListGroup.ItemTitle>
        <ListGroup.ItemDescription>
          {dayMonth.format(new Date(row.bookingDate))} ·{" "}
          {row.categoryPath ?? "Sans catégorie"}
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
