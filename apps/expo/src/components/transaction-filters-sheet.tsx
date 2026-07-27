import { useState } from "react";

import type { CategoryOption } from "@budget/api";
import type { TransactionsSearch } from "@budget/shared";

import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from "~/components/ui/actionsheet";
import { Button, ButtonText } from "~/components/ui/button";
import { Input, InputField } from "~/components/ui/input";

export type TransactionFilters = Pick<
  TransactionsSearch,
  "bank" | "category" | "dateFrom" | "dateTo" | "q"
>;

export function TransactionFiltersSheet({
  isOpen,
  value,
  // Prop conservée pour une évolution ultérieure (sélecteur de catégorie).
  categories: _categories,
  onClose,
  onApply,
}: {
  isOpen: boolean;
  value: TransactionFilters;
  categories: CategoryOption[];
  onClose: () => void;
  onApply: (next: TransactionFilters) => void;
}) {
  const [draft, setDraft] = useState<TransactionFilters>(value);

  return (
    <Actionsheet
      isOpen={isOpen}
      onClose={() => {
        setDraft(value);
        onClose();
      }}
    >
      <ActionsheetBackdrop />
      <ActionsheetContent className="gap-3 px-4 pb-6">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <Input>
          <InputField
            placeholder="Rechercher (libellé, contrepartie)"
            value={draft.q ?? ""}
            onChangeText={(q) => setDraft((d) => ({ ...d, q: q || undefined }))}
          />
        </Input>
        <Input>
          <InputField
            placeholder="Catégorie (nom exact)"
            value={draft.category ?? ""}
            onChangeText={(category) =>
              setDraft((d) => ({ ...d, category: category || undefined }))
            }
          />
        </Input>
        <Button
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        >
          <ButtonText>Appliquer</ButtonText>
        </Button>
        <Button
          variant="outline"
          onPress={() => {
            setDraft({});
            onApply({});
            onClose();
          }}
        >
          <ButtonText>Réinitialiser</ButtonText>
        </Button>
      </ActionsheetContent>
    </Actionsheet>
  );
}
