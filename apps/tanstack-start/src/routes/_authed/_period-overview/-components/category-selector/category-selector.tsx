import type { CategoryOverviewElementType } from "@budget/api/schemas";

import {
  Autocomplete,
  Header,
  ListBox,
  SearchField,
  useFilter,
} from "@heroui/react";
import { useLoaderData } from "@tanstack/react-router";

import { getCategoryLabel, NO_CATEGORY_NAME } from "@budget/api/schemas";
import { CategoryIcon } from "~/component/category-icon";

export type SelectedCategory = {
  parent: Pick<CategoryOverviewElementType, "id" | "name" | "color" | "icon">;
  child?: { id: number | null; name: string };
};

type CategorySelectorProps = {
  value?: SelectedCategory;
  onChange: (selectedCategory?: SelectedCategory) => void;
};

// Category names are unique within a space, so they double as list keys;
// the uncategorized row has no name and takes the API's sentinel.
const keyOf = (name: string | null) => name ?? NO_CATEGORY_NAME;

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  const { overview } = useLoaderData({ from: "/_authed/_period-overview" });
  const { contains } = useFilter({ sensitivity: "base" });

  const select = (key: unknown) => {
    for (const parent of overview) {
      if (keyOf(parent.name) === key) return onChange({ parent });
      const child = parent.children?.find(({ name }) => name === key);
      if (child) return onChange({ parent, child });
    }
  };

  return (
    <Autocomplete
      aria-label="Catégorie"
      placeholder="Choisir une catégorie"
      value={value && (value.child?.name ?? keyOf(value.parent.name))}
      onChange={select}
    >
      <Autocomplete.Trigger className="whitespace-nowrap">
        {/* A parent's own item reads « Toute la catégorie »; the trigger names the category. */}
        <Autocomplete.Value>
          {({ defaultChildren }) =>
            value
              ? (value.child?.name ?? getCategoryLabel(value.parent.name))
              : defaultChildren
          }
        </Autocomplete.Value>
        <Autocomplete.Indicator />
      </Autocomplete.Trigger>
      <Autocomplete.Popover>
        <Autocomplete.Filter filter={contains}>
          {/* The filter is what the popover opens for; typing must work at once. */}
          {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
          <SearchField autoFocus aria-label="Filtrer les catégories">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={`Filtrer parmi ${overview.length} catégories…`}
              />
            </SearchField.Group>
          </SearchField>
          <ListBox renderEmptyState={() => "Aucune catégorie ne correspond."}>
            {overview.map((parent) => (
              <ListBox.Section key={keyOf(parent.name)}>
                <Header className="flex items-center gap-1.5">
                  <CategoryIcon
                    name={parent.icon}
                    className="size-3"
                    color={parent.color}
                  />
                  {getCategoryLabel(parent.name)}
                </Header>
                <ListBox.Item
                  id={keyOf(parent.name)}
                  textValue={getCategoryLabel(parent.name)}
                >
                  Toute la catégorie
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {(parent.children ?? []).map((child) => (
                  <ListBox.Item
                    key={child.name}
                    id={child.name}
                    textValue={`${parent.name} ${child.name}`}
                  >
                    {child.name}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox.Section>
            ))}
          </ListBox>
        </Autocomplete.Filter>
      </Autocomplete.Popover>
    </Autocomplete>
  );
}
