import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";

import { NO_CATEGORY_NAME } from "@budget/api/schemas";
import { CategoryList } from "~/components/category-list";
import { queryClient, trpc } from "~/lib/trpc";

export default function TransactionCategory() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { data: row } = useQuery(trpc.transactions.get.queryOptions({ id }));
  const { toast } = useToast();
  const { mutate } = useMutation({
    ...trpc.transactions.updateCategory.mutationOptions(),
    // The line moves between categories: every total and list may change.
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => toast.show({ variant: "danger", label: err.message }),
  });

  return (
    <CategoryList
      selected={row && (row.category ?? NO_CATEGORY_NAME)}
      onSelect={({ id: categoryId }) => mutate({ id, categoryId })}
    />
  );
}
