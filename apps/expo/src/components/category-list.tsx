import { ScrollView } from "react-native";

import {
  getCategoryLabel,
  isManagedCategory,
  NO_CATEGORY_NAME,
} from "@budget/api/schemas";
import { useCategoryColors } from "~/lib/category-color";
import { useOverview } from "~/lib/overview";

import { CategoryIcon } from "./category-icon";
import { CheckItem, SettingsGroup } from "./settings-group";

export interface PickedCategory {
  // Null for « Sans catégorie », which has no record.
  id: number | null;
  name: string;
}

// Every category of the space, a parent's own row first, then its children.
// Names are unique within a space, so the selection is a name.
export function CategoryList({
  selected,
  onSelect,
}: {
  selected: string | undefined;
  onSelect: (category: PickedCategory) => void;
}) {
  const categories = (useOverview().data ?? []).filter(isManagedCategory);
  const { resolve } = useCategoryColors();
  const item = (category: PickedCategory, label: string) => (
    <CheckItem
      key={category.name}
      label={label}
      selected={selected === category.name}
      onPress={() => onSelect(category)}
    />
  );

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      {categories.map((parent) => (
        <SettingsGroup
          key={parent.id}
          title={parent.name}
          icon={
            <CategoryIcon
              name={parent.icon}
              color={resolve(parent.color)}
              size={14}
            />
          }
        >
          {item(parent, "Toute la catégorie")}
          {(parent.children ?? []).map((child) => item(child, child.name))}
        </SettingsGroup>
      ))}
      <SettingsGroup>
        {item(
          { id: null, name: NO_CATEGORY_NAME },
          getCategoryLabel(NO_CATEGORY_NAME),
        )}
      </SettingsGroup>
    </ScrollView>
  );
}
