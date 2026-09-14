// Écritures sur l'arborescence de catégories.
import { and, eq, inArray, isNull } from "@budget/db";
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

// Couleur par défaut pour un parent seulement : une sous-catégorie hérite
// visuellement de son parent et n'a jamais de couleur propre.
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

// Couleur et icône sont l'identité d'une catégorie PARENTE : une sous-catégorie
// hérite visuellement de son parent et n'en a jamais en propre, d'où le
// `isNull(parentId)` dans le `WHERE`. Un `UPDATE` à zéro ligne ne lève pas,
// d'où le `returning`. Palette et jeu d'icônes sont validés par le routeur ;
// `icon: null` remet la pastille creuse (la couleur travaille seule).
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

// Supprime une catégorie (et, pour un parent, ses sous-catégories en cascade)
// même si des transactions y sont rattachées : elles deviennent
// non-catégorisées (category_id/category_source à NULL) plutôt que de bloquer
// la suppression — l'avertissement en amont (UI) se base sur les compteurs de
// `categoriesOverview` pour prévenir l'utilisateur avant confirmation.
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
