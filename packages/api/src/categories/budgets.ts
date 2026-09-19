// Budgets are recurring monthly amounts, not per-month records.
import { and, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { categories } from "@budget/db/schema";

// Detailed mode clears the parent's amount to enforce a budget derived from children.
// Switching back preserves child amounts, but does not restore the old parent amount.
export async function setCategoryDetailed(
  organizationId: string,
  categoryId: number,
  detailed: boolean,
): Promise<void> {
  const updated = await db
    .update(categories)
    .set({ budgetDetailed: detailed, ...(detailed && { budgetAmount: null }) })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
        isNull(categories.parentId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie parente introuvable.");
}

export async function setCategoryBudget(
  organizationId: string,
  categoryId: number,
  amount: number | null,
): Promise<void> {
  const value = amount === null ? null : amount.toFixed(2);
  const updated = await db
    .update(categories)
    .set({
      budgetAmount: value,
      // A parent with all children deleted may still be detailed; clear the flag
      // when setting an amount so the database constraint accepts it.
      ...(value !== null && { budgetDetailed: false }),
    })
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.organizationId, organizationId),
      ),
    )
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie introuvable.");
}
