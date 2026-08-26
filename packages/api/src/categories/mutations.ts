// Écritures sur l'arborescence de catégories (hors application de suggestions,
// voir suggestions/apply.ts).
import { and, eq, inArray } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";
import { FALLBACK_CATEGORY_COLOR } from "@budget/shared";

/**
 * « Cette catégorie, dans cet espace ». Tous les ids manipulés ici viennent du
 * client : sans l'espace dans le `WHERE`, renommer ou supprimer une catégorie
 * d'un autre foyer ne demanderait qu'un id deviné.
 */
function inOrg(organizationId: string, id: number) {
  return and(
    eq(categories.organizationId, organizationId),
    eq(categories.id, id),
  );
}

// `categories.name` est unique **par espace** ; on vérifie en amont pour
// renvoyer un message utilisable côté UI plutôt qu'une violation de contrainte
// brute.
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

// Crée une catégorie (parentId null) ou sous-catégorie (parentId d'un parent
// existant). Couleur par défaut FALLBACK_CATEGORY_COLOR pour un parent —
// jamais pour un enfant, qui hérite visuellement de son parent (voir
// transactions/queries.ts, breakdownByCategories).
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

// Le parent désigné doit être dans l'espace : greffer une sous-catégorie sous
// la parente d'un autre foyer ferait entrer une ligne à cheval sur deux espaces,
// que plus aucune requête ne saurait attribuer.
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
  // Le `WHERE` ci-dessous suffit à ne rien écrire hors de l'espace, mais un
  // `UPDATE` sans ligne touchée est un succès silencieux : la vérification
  // explicite est ce qui fait répondre « introuvable » plutôt que « c'est fait ».
  await assertOwned(organizationId, id);

  await db
    .update(categories)
    .set({ name: trimmed })
    .where(inOrg(organizationId, id));
}

// Change la couleur d'une catégorie PARENTE uniquement — une sous-catégorie
// n'a jamais de couleur propre, elle hérite toujours visuellement de son parent
// (voir transactions/queries.ts, breakdownByCategories, qui ne regarde même pas la couleur
// d'une sous-catégorie). La palette fermée est validée par le routeur.
export async function updateCategoryColor(
  organizationId: string,
  id: number,
  color: string,
): Promise<void> {
  const [category] = await db
    .select({ parentId: categories.parentId })
    .from(categories)
    .where(inOrg(organizationId, id));
  if (!category) throw new Error("Catégorie introuvable.");
  if (category.parentId !== null) {
    throw new Error("Seules les catégories parentes ont une couleur propre.");
  }

  await db.update(categories).set({ color }).where(inOrg(organizationId, id));
}

// Même règle que updateCategoryColor : l'icône fait partie de l'identité d'une
// catégorie PARENTE, une sous-catégorie n'en a jamais. `null` remet la
// catégorie dans l'état « sans icône » (pastille creuse, la couleur travaille
// seule). Le jeu fermé est validé par le routeur.
export async function updateCategoryIcon(
  organizationId: string,
  id: number,
  icon: string | null,
): Promise<void> {
  const [category] = await db
    .select({ parentId: categories.parentId })
    .from(categories)
    .where(inOrg(organizationId, id));
  if (!category) throw new Error("Catégorie introuvable.");
  if (category.parentId !== null) {
    throw new Error("Seules les catégories parentes ont une icône propre.");
  }

  await db.update(categories).set({ icon }).where(inOrg(organizationId, id));
}

// Supprime une catégorie (et, pour un parent, ses sous-catégories en cascade)
// même si des transactions y sont rattachées : elles deviennent
// non-catégorisées (category_id/category_source à NULL) plutôt que de bloquer
// la suppression — l'avertissement en amont (UI) se base sur les compteurs de
// `newCategoriesOverview` pour prévenir l'utilisateur avant confirmation.
export async function removeCategory(
  organizationId: string,
  id: number,
): Promise<void> {
  // La vérification vaut pour tout ce qui suit : les ids des enfants sortent
  // ensuite d'un `SELECT` déjà scopé, et le détachement des transactions se
  // fait par `category_id`, donc dans le périmètre des catégories vérifiées.
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

  // Les enfants référencent le parent via parent_id : les supprimer avant le
  // parent pour ne pas violer la contrainte de clé étrangère.
  if (children.length > 0) {
    await db
      .delete(categories)
      .where(inArray(categories.id, idsToDelete.slice(1)));
  }
  await db.delete(categories).where(inOrg(organizationId, id));
}
