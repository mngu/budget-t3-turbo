import type { CategoryOverviewElementType } from "@budget/api/schemas";

import {
  Autocomplete,
  Button,
  Header,
  ListBox,
  Modal,
  SearchField,
  useFilter,
} from "@heroui/react";
import { useLoaderData } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";

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
    <Modal>
      <Button variant="outline" size="sm" className="whitespace-nowrap">
        {/* A parent's own item reads « Toute la catégorie »; the trigger names the category. */}
        {value
          ? (value.child?.name ?? getCategoryLabel(value.parent.name))
          : "Choisir une catégorie"}
        <ChevronDownIcon />
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          {/* A fixed height keeps the filter in place while the list narrows. */}
          <Modal.Dialog aria-label="Catégorie" className="h-120">
            {({ close }) => (
              <Autocomplete.Filter filter={contains}>
                {/* Header and body split so the filter stays put while the list scrolls. */}
                <Modal.Header>
                  {/* The filter is what the dialog opens for; typing must work at once. */}
                  {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
                  <SearchField autoFocus aria-label="Filtrer les catégories">
                    <SearchField.Group>
                      <SearchField.SearchIcon />
                      <SearchField.Input
                        placeholder={`Filtrer parmi ${overview.length} catégories…`}
                      />
                    </SearchField.Group>
                  </SearchField>
                </Modal.Header>
                {/* Body mutes its text for prose; these are choices. */}
                <Modal.Body className="text-foreground">
                  <ListBox
                    aria-label="Catégories"
                    selectionMode="single"
                    selectedKeys={
                      value
                        ? [value.child?.name ?? keyOf(value.parent.name)]
                        : []
                    }
                    // Picking the current row again empties the selection: just close.
                    onSelectionChange={(keys) => {
                      if (keys !== "all") select([...keys][0]);
                      close();
                    }}
                    renderEmptyState={() => "Aucune catégorie ne correspond."}
                  >
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
                </Modal.Body>
              </Autocomplete.Filter>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
