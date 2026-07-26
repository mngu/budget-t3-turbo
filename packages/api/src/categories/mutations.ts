// Écritures sur l'arborescence de catégories (hors application de suggestions,
// voir suggestions/apply.ts).
import { eq, inArray } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";
import { FALLBACK_CATEGORY_COLOR } from "@budget/validators";

// `categories.name` est unique en base ; on vérifie en amont pour renvoyer un
// message utilisable côté UI plutôt qu'une violation de contrainte brute.
async function assertNameAvailable(name: string, exceptId?: number) {
  const [conflict] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, name));
  if (conflict && conflict.id !== exceptId) {
    throw new Error(`Une catégorie nommée "${name}" existe déjà.`);
  }
}

// Crée une catégorie (parentId null) ou sous-catégorie (parentId d'un parent
// existant). Couleur par défaut FALLBACK_CATEGORY_COLOR pour un parent —
// jamais pour un enfant, qui hérite visuellement de son parent (voir
// transactions/queries.ts, byCategory).
export async function createCategory(
  name: string,
  parentId: number | null,
): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom ne peut pas être vide.");
  await assertNameAvailable(trimmed);

  await db.insert(categories).values({
    name: trimmed,
    parentId,
    color: parentId === null ? FALLBACK_CATEGORY_COLOR : null,
  });
}

export async function renameCategory(id: number, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom ne peut pas être vide.");
  await assertNameAvailable(trimmed, id);

  await db
    .update(categories)
    .set({ name: trimmed })
    .where(eq(categories.id, id));
}

// Change la couleur d'une catégorie PARENTE uniquement — une sous-catégorie
// n'a jamais de couleur propre, elle hérite toujours visuellement de son parent
// (voir transactions/queries.ts, byCategory, qui ne regarde même pas la couleur
// d'une sous-catégorie). La palette fermée est validée par le routeur.
export async function updateCategoryColor(
  id: number,
  color: string,
): Promise<void> {
  const [category] = await db
    .select({ parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.id, id));
  if (!category) throw new Error("Catégorie introuvable.");
  if (category.parentId !== null) {
    throw new Error("Seules les catégories parentes ont une couleur propre.");
  }

  await db.update(categories).set({ color }).where(eq(categories.id, id));
}

// Supprime une catégorie (et, pour un parent, ses sous-catégories en cascade)
// même si des transactions y sont rattachées : elles deviennent
// non-catégorisées (category_id/category_source à NULL) plutôt que de bloquer
// la suppression — l'avertissement en amont (UI) se base sur
// `categoriesOverview` pour prévenir l'utilisateur avant confirmation.
export async function removeCategory(id: number): Promise<void> {
  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, id));
  const idsToDelete = [id, ...children.map((c) => c.id)];

  await db
    .update(transactions)
    .set({ categoryId: null, categorySource: null })
    .where(inArray(transactions.categoryId, idsToDelete));

  // Les enfants référencent le parent via parent_id : les supprimer avant le
  // parent pour ne pas violer la contrainte de clé étrangère.
  if (children.length > 0) {
    await db.delete(categories).where(eq(categories.parentId, id));
  }
  await db.delete(categories).where(eq(categories.id, id));
}
