import { and, eq, inArray, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

// Client-supplied IDs must be checked against the current organization.
function inOrg(organizationId: string, id: number) {
  return and(
    eq(categories.organizationId, organizationId),
    eq(categories.id, id),
  );
}

// Report a readable conflict before the per-organization unique constraint fails.
async function assertNameAvailable(
  organizationId: string,
  name: string,
  exceptId?: number,
) {
  const [conflict] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, organizationId),
        eq(categories.name, name),
      ),
    );
  if (conflict && conflict.id !== exceptId) {
    throw new Error(`Une catégorie nommée "${name}" existe déjà.`);
  }
}

export async function createCategory(
  organizationId: string,
  name: string,
  parentId: number | null,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom ne peut pas être vide.");
  await assertNameAvailable(organizationId, trimmed);
  if (parentId !== null) await assertOwned(organizationId, parentId);

  await db.insert(categories).values({
    organizationId,
    name: trimmed,
    parentId,
    color: parentId === null ? FALLBACK_CATEGORY_COLOR : null,
  });
}

async function assertOwned(organizationId: string, id: number): Promise<void> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(inOrg(organizationId, id));
  if (!row) throw new Error("Catégorie introuvable.");
}

export async function renameCategory(
  organizationId: string,
  id: number,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom ne peut pas être vide.");
  await assertNameAvailable(organizationId, trimmed, id);
  // A scoped UPDATE can affect zero rows without error; do not report false success.
  await assertOwned(organizationId, id);

  await db
    .update(categories)
    .set({ name: trimmed })
    .where(inOrg(organizationId, id));
}

// Only parents own colors and icons; children inherit their visual identity.
export async function updateCategoryIdentity(
  organizationId: string,
  id: number,
  identity: { color: string } | { icon: string | null },
): Promise<void> {
  const updated = await db
    .update(categories)
    .set(identity)
    .where(and(inOrg(organizationId, id), isNull(categories.parentId)))
    .returning({ id: categories.id });
  if (updated.length === 0) throw new Error("Catégorie parente introuvable.");
}

export async function removeCategory(
  organizationId: string,
  id: number,
): Promise<void> {
  // Child IDs and transaction detachment inherit scope from this ownership check.
  await assertOwned(organizationId, id);

  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, organizationId),
        eq(categories.parentId, id),
      ),
    );
  const idsToDelete = [id, ...children.map((c) => c.id)];

  await db
    .update(transactions)
    .set({ categoryId: null, categorySource: null })
    .where(inArray(transactions.categoryId, idsToDelete));

  // Delete children first to satisfy the parent_id foreign key.
  if (children.length > 0) {
    await db
      .delete(categories)
      .where(inArray(categories.id, idsToDelete.slice(1)));
  }
  await db.delete(categories).where(inOrg(organizationId, id));
}
