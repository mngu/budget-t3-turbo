import { router } from "expo-router";
import { Button, SearchField, useThemeColor } from "heroui-native";
import { SlidersHorizontal } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { TransactionList } from "~/components/transaction-list";
import { activeFilterCount, useFilters } from "~/lib/filters";

const SEARCH_DELAY_MS = 300;

export default function Transactions() {
  const { filters, setFilters } = useFilters();
  const [text, setText] = useState(filters.q ?? "");
  const count = activeFilterCount(filters);
  const iconColor = useThemeColor(
    count > 0 ? "accent-foreground" : "foreground",
  );

  // One request per pause in typing, not per keystroke.
  useEffect(() => {
    const q = text.trim() || undefined;
    if (q === filters.q) return;
    const timer = setTimeout(() => setFilters({ q }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, filters.q, setFilters]);

  return (
    <View className="bg-background flex-1">
      <View className="flex-row items-center gap-2 px-4 pt-3">
        <SearchField value={text} onChange={setText} className="flex-1">
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input
              placeholder="Libellé ou tiers"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
        <Button
          isIconOnly={count === 0}
          variant={count > 0 ? "primary" : "secondary"}
          accessibilityLabel="Filtres et tri"
          onPress={() => router.push("/filtres")}
        >
          <SlidersHorizontal size={18} color={iconColor} />
          {count > 0 && <Button.Label>{count}</Button.Label>}
        </Button>
      </View>
      <TransactionList filters={filters} />
    </View>
  );
}
