import { NO_CATEGORY_NAME } from "@budget/api/schemas";
export const NO_CATEGORY_LABEL = "Sans catégorie";

export function getCategoryLabel(name: string | null) {
  return name && name !== NO_CATEGORY_NAME ? name : NO_CATEGORY_LABEL;
}
