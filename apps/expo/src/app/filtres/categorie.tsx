import { router } from "expo-router";

import { CategoryList } from "~/components/category-list";
import { useFilters } from "~/lib/filters";

export default function FilterCategory() {
  const { filters, setFilters } = useFilters();
  return (
    <CategoryList
      selected={filters.category}
      onSelect={({ name }) => {
        setFilters({ category: name });
        router.back();
      }}
    />
  );
}
