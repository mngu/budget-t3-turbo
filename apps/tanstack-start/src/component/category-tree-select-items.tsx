import type { CategoryTreeNode } from "@budget/api";
import { SelectItem } from "@budget/ui/select";

export function CategoryTreeSelectItems({
  categories,
}: {
  categories: CategoryTreeNode[];
}) {
  return (
    <>
      {categories.map((root) => (
        <>
          <SelectItem key={root.id} value={root.name}>
            {root.name}
          </SelectItem>
          {root.children.map((child) => (
            <SelectItem key={child.id} value={child.name} className="pl-6">
              {child.name}
            </SelectItem>
          ))}
        </>
      ))}
    </>
  );
}
