// Lectures de l'arborescence de catégories.
import { count, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";

export interface CategoryOption {
  id: number;
  name: string;
  color: string | null;
  parentId: number | null;
}

export interface CategoryTreeNode extends CategoryOption {
  children: CategoryOption[];
}

export interface CategoryOverviewNode extends CategoryOption {
  transactionCount: number;
  children: (CategoryOption & { transactionCount: number })[];
}

export interface CategoriesOverview {
  tree: CategoryOverviewNode[];
  uncategorizedCount: number;
}

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  parentId: categories.parentId,
};

// Reconstruit l'arborescence parents → enfants à partir d'une liste plate
// (les catégories n'ont que 2 niveaux) — générique pour être réutilisé par
// `listTree` (CategoryOption) et `overview` (CategoryOption & transactionCount).
function buildCategoryTree<T extends CategoryOption>(
  rows: T[],
): (T & { children: T[] })[] {
  const roots: (T & { children: T[] })[] = [];
  const nodeById = new Map<number, T & { children: T[] }>();
  for (const row of rows) {
    if (row.parentId !== null) continue;
    const node = { ...row, children: [] as T[] };
    nodeById.set(row.id, node);
    roots.push(node);
  }
  for (const row of rows) {
    if (row.parentId === null) continue;
    const parent = nodeById.get(row.parentId);
    parent?.children.push(row);
  }
  return roots;
}

// `parentId` omis : liste plate complète. `parentId: null` : catégories
// racines. `parentId: n` : sous-catégories de n.
export async function listCategories(
  parentId?: number | null,
): Promise<CategoryOption[]> {
  const where =
    parentId === undefined
      ? undefined
      : parentId === null
        ? isNull(categories.parentId)
        : eq(categories.parentId, parentId);
  return db
    .select(categoryColumns)
    .from(categories)
    .where(where)
    .orderBy(categories.id);
}

// Arborescence complète : catégories parentes avec leurs sous-catégories.
export async function listCategoryTree(): Promise<CategoryTreeNode[]> {
  const rows = await db
    .select(categoryColumns)
    .from(categories)
    .orderBy(categories.id);
  return buildCategoryTree(rows);
}

// Arborescence + nombre de transactions par catégorie (page /categories) :
// total cumulé (elle-même + sous-catégories) pour un parent, compte direct
// pour une sous-catégorie. Part de `categories` (pas `transactions`, contrairement
// à `transactions.byCategory`) pour ne perdre aucune catégorie à 0 transaction.
export async function categoriesOverview(): Promise<CategoriesOverview> {
  const [rows, [uncategorized]] = await Promise.all([
    db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        parentId: categories.parentId,
        transactionCount: count(transactions.id),
      })
      .from(categories)
      .leftJoin(transactions, eq(transactions.categoryId, categories.id))
      .groupBy(categories.id)
      .orderBy(categories.id),
    db
      .select({ total: count() })
      .from(transactions)
      .where(isNull(transactions.categoryId)),
  ]);

  const tree = buildCategoryTree(rows).map((parent) => ({
    ...parent,
    // Total cumulé pour l'affichage du parent ; le compte direct (calculé
    // ci-dessus, avant ce map) reste ce que `removeCategory` utilise pour
    // avertir avant suppression.
    transactionCount:
      parent.transactionCount +
      parent.children.reduce((sum, c) => sum + c.transactionCount, 0),
  }));

  return { tree, uncategorizedCount: uncategorized?.total ?? 0 };
}
