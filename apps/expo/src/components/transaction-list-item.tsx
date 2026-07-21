import { Pressable, Text, View } from "react-native";

import type { TransactionRow } from "@budget/api";

import { Badge, BadgeText } from "~/components/ui/badge";

const euro = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function TransactionListItem({
  transaction,
  onPress,
}: {
  transaction: TransactionRow;
  onPress: () => void;
}) {
  const signed =
    (transaction.direction === "debit" ? -1 : 1) * Number(transaction.amount);

  return (
    <Pressable
      onPress={onPress}
      className="border-border flex-row items-center justify-between gap-2 border-b px-4 py-3"
    >
      <View className="flex-1 gap-1">
        <Text className="text-foreground font-medium" numberOfLines={1}>
          {transaction.description}
        </Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-muted-foreground text-xs">
            {dateFr.format(new Date(transaction.bookingDate))} ·{" "}
            {transaction.bankName}
          </Text>
          {transaction.category && (
            <Badge variant="outline">
              <BadgeText>{transaction.category}</BadgeText>
            </Badge>
          )}
        </View>
      </View>
      <Text
        className={
          transaction.direction === "debit"
            ? "text-destructive font-semibold"
            : "font-semibold text-green-600"
        }
      >
        {euro.format(signed)}
      </Text>
    </Pressable>
  );
}
