import type { TransactionRow } from "@budget/api";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ListGroup, Spinner, Typography } from "heroui-native";
import { FlatList, View } from "react-native";

import { trpc, trpcClient } from "~/lib/trpc";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  signDisplay: "exceptZero",
});
const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});
const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ponytail: calendar month only; the web's custom month start day lives in its localStorage.
const now = new Date();
const search = {
  dateFrom: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
  dateTo: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  sort: "date",
  order: "desc",
} as const;

export default function Transactions() {
  const { data, fetchNextPage, hasNextPage, isPending } = useInfiniteQuery({
    queryKey: trpc.transactions.list.queryKey(search),
    queryFn: ({ pageParam }) =>
      trpcClient.transactions.list.query({ ...search, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) =>
      pages.flatMap((p) => p.rows).length < last.total
        ? pages.length + 1
        : undefined,
  });

  if (isPending) {
    return (
      <View className="bg-background flex-1 items-center justify-center">
        <Spinner />
      </View>
    );
  }

  return (
    <FlatList
      className="bg-background flex-1"
      contentContainerClassName="p-4"
      contentInsetAdjustmentBehavior="automatic"
      data={data?.pages.flatMap((p) => p.rows)}
      keyExtractor={(row) => String(row.id)}
      ListHeaderComponent={
        <Typography color="muted" className="mb-2 capitalize">
          {monthYear.format(now)}
        </Typography>
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
        <Typography className={amount > 0 ? "text-success" : undefined}>
          {euro.format(amount)}
        </Typography>
      </ListGroup.ItemSuffix>
    </ListGroup.Item>
  );
}
