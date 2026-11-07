import type { StatementFilters } from "~/lib/filters";

import { router } from "expo-router";
import { ListGroup } from "heroui-native";
import { ScrollView } from "react-native";

import { getCategoryLabel } from "@budget/api/schemas";
import {
  ActionItem,
  CheckItem,
  SettingsGroup,
} from "~/components/settings-group";
import { activeFilterCount, DEFAULT_FILTERS, useFilters } from "~/lib/filters";

const DIRECTIONS: { value: StatementFilters["direction"]; label: string }[] = [
  { value: undefined, label: "Tous" },
  { value: "debit", label: "Débits" },
  { value: "credit", label: "Crédits" },
];

const SORTS: (Pick<StatementFilters, "sort" | "order"> & { label: string })[] =
  [
    { sort: "date", order: "desc", label: "Plus récentes d'abord" },
    { sort: "date", order: "asc", label: "Plus anciennes d'abord" },
    { sort: "amount", order: "desc", label: "Montant décroissant" },
    { sort: "amount", order: "asc", label: "Montant croissant" },
  ];

export default function Filters() {
  const { filters, setFilters } = useFilters();

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-6 p-4"
      contentInsetAdjustmentBehavior="automatic"
    >
      <SettingsGroup title="Sens">
        {DIRECTIONS.map(({ value, label }) => (
          <CheckItem
            key={label}
            label={label}
            selected={filters.direction === value}
            onPress={() => setFilters({ direction: value })}
          />
        ))}
      </SettingsGroup>

      <SettingsGroup title="Catégorie">
        <ListGroup.Item onPress={() => router.push("/filtres/categorie")}>
          <ListGroup.ItemContent>
            <ListGroup.ItemTitle>
              {filters.category
                ? getCategoryLabel(filters.category)
                : "Toutes les catégories"}
            </ListGroup.ItemTitle>
          </ListGroup.ItemContent>
          <ListGroup.ItemSuffix />
        </ListGroup.Item>
        {filters.category ? (
          <ActionItem
            label="Toutes les catégories"
            tone="accent"
            onPress={() => setFilters({ category: undefined })}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="Trier par">
        {SORTS.map(({ sort, order, label }) => (
          <CheckItem
            key={label}
            label={label}
            selected={filters.sort === sort && filters.order === order}
            onPress={() => setFilters({ sort, order })}
          />
        ))}
      </SettingsGroup>

      {activeFilterCount(filters) > 0 ? (
        <SettingsGroup>
          <ActionItem
            label="Réinitialiser"
            tone="danger"
            onPress={() =>
              setFilters({
                ...DEFAULT_FILTERS,
                direction: undefined,
                category: undefined,
              })
            }
          />
        </SettingsGroup>
      ) : null}
    </ScrollView>
  );
}
