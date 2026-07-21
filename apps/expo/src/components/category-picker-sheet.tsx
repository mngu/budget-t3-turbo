import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { CategoryOption } from "@budget/api";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from "~/components/ui/actionsheet";
import { trpcClient } from "~/utils/api";

export function CategoryPickerSheet({
  transactionId,
  categories,
  onClose,
}: {
  transactionId: number | null;
  categories: CategoryOption[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const updateCategory = useMutation({
    mutationFn: (category: string) => {
      if (transactionId === null)
        throw new Error("Aucune transaction sélectionnée");
      return trpcClient.transactions.updateCategory.mutate({
        id: transactionId,
        category,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["transactions.list.infinite"],
      });
      onClose();
    },
  });

  return (
    <Actionsheet isOpen={transactionId !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        {categories.map((c) => (
          <ActionsheetItem
            key={c.id}
            isDisabled={updateCategory.isPending}
            onPress={() => updateCategory.mutate(c.name)}
          >
            <ActionsheetItemText>{c.name}</ActionsheetItemText>
          </ActionsheetItem>
        ))}
      </ActionsheetContent>
    </Actionsheet>
  );
}
