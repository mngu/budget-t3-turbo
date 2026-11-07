import { useMutation } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { SearchField, Typography, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";

import { isManagedCategory } from "@budget/api/schemas";
import { searchCategoryIcons } from "@budget/shared";
import { CategoryIcon } from "~/components/category-icon";
import { ActionItem, SettingsGroup } from "~/components/settings-group";
import { useCategoryColors } from "~/lib/category-color";
import { useSpaceCategories } from "~/lib/overview";
import { trpc } from "~/lib/trpc";

export default function IconPicker() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const category = useSpaceCategories()
    .data?.filter(isManagedCategory)
    .find((candidate) => candidate.id === id);
  const [query, setQuery] = useState("");
  const { resolve } = useCategoryColors();
  const muted = useThemeColor("muted");
  const { mutate } = useMutation({
    ...trpc.categories.updateIcon.mutationOptions(),
    onSuccess: () => router.back(),
  });
  const groups = searchCategoryIcons(query);
  const color = resolve(category?.color ?? null);

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <SearchField value={query} onChange={setQuery}>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input
            placeholder="Courses, loyer, essence, impôts…"
            autoCorrect={false}
          />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      {groups.map((group) => (
        <View key={group.label} className="gap-2">
          <Typography
            type="body-xs"
            color="muted"
            className="px-4 font-semibold tracking-wider uppercase"
          >
            {group.label}
          </Typography>
          <View className="bg-surface flex-row flex-wrap gap-1 rounded-3xl p-3">
            {group.icons.map((icon) => {
              const selected = category?.icon === icon.name;
              return (
                <Pressable
                  key={icon.name}
                  accessibilityLabel={icon.keywords.split(" ")[0]}
                  accessibilityState={{ selected }}
                  onPress={() => mutate({ id, icon: icon.name })}
                  className={`size-12 items-center justify-center rounded-xl ${selected ? "bg-accent-soft" : ""}`}
                >
                  <CategoryIcon
                    name={icon.name}
                    color={selected ? color : muted}
                    size={22}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {groups.length === 0 && (
        <Typography color="muted" className="px-4">
          Aucune icône pour « {query} ».
        </Typography>
      )}

      <SettingsGroup footer="La couleur travaille seule.">
        <ActionItem
          label="Sans icône"
          tone="accent"
          onPress={() => mutate({ id, icon: null })}
        />
      </SettingsGroup>
    </ScrollView>
  );
}
