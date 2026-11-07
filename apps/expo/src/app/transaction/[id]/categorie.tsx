import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";

import { NO_CATEGORY_NAME } from "@budget/api/schemas";
import { CategoryList } from "~/components/category-list";
import { trpc } from "~/lib/trpc";

export default function TransactionCategory() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: row } = useQuery(trpc.transactions.get.queryOptions({ id }));
  const { mutate } = useMutation({
    ...trpc.transactions.updateCategory.mutationOptions(),
    onSuccess: () => router.back(),
  });

  return (
    <CategoryList
      selected={row && (row.category ?? NO_CATEGORY_NAME)}
      onSelect={({ id: categoryId }) => mutate({ id, categoryId })}
    />
  );
}
