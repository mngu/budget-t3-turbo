// Lectures de l'arborescence de catégories.
import { and, count, eq, isNull } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";

export interface CategoryOption {
  id: number;
  name: string;
  color: string | null;
  // Nom Lucide (voir CATEGORY_ICON_NAMES) — toujours null pour une
  // sous-catégorie, comme `color`.
  icon: string | null;
  parentId: number | null;
}

export interface CategoryTreeNode extends CategoryOption {
  children: CategoryOption[];
}

export interface CategoryOverviewNode extends CategoryOption {
  transactionCount: number;
  // Transactions portées par la catégorie elle-même, hors sous-catégories.
  // `transactionCount` est le total cumulé pour un parent : les deux chiffres
  // ne disent pas la même chose et la page /categories affiche le direct
  // (« le compteur d'une parente ne compte que ses transactions directes »).
  directTransactionCount: number;
  children: (CategoryOption & {
    transactionCount: number;
    directTransactionCount: number;
  })[];
}

export interface CategoriesOverview {
  tree: CategoryOverviewNode[];
  uncategorizedCount: number;
}

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  icon: categories.icon,
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
  organizationId: string,
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
    .where(and(eq(categories.organizationId, organizationId), where))
    .orderBy(categories.id);
}

// Arborescence complète : catégories parentes avec leurs sous-catégories.
export async function listCategoryTree(
  organizationId: string,
): Promise<CategoryTreeNode[]> {
  const rows = await db
    .select(categoryColumns)
    .from(categories)
    .where(eq(categories.organizationId, organizationId))
    .orderBy(categories.id);
  return buildCategoryTree(rows);
}

// Arborescence + nombre de transactions par catégorie (page /categories).
// Deux compteurs par nœud, à ne pas confondre : `transactionCount` est le
// total cumulé (elle-même + sous-catégories) pour un parent, `directTransactionCount`
// ne compte jamais que les transactions portées par la catégorie elle-même.
// Ils coïncident sur une sous-catégorie, qui n'a pas d'enfant.
// Part de `categories` (pas `transactions`, contrairement à
// `transactions.byCategory`) pour ne perdre aucune catégorie à 0 transaction.
export async function categoriesOverview(
  organizationId: string,
): Promise<CategoriesOverview> {
  const [rows, [uncategorized]] = await Promise.all([
    db
      .select({
        ...categoryColumns,
        transactionCount: count(transactions.id),
        // Même valeur que `transactionCount` à ce stade (le compte direct) ;
        // seul `transactionCount` devient cumulé au niveau du parent, plus bas.
        directTransactionCount: count(transactions.id),
      })
      .from(categories)
      .leftJoin(transactions, eq(transactions.categoryId, categories.id))
      .where(eq(categories.organizationId, organizationId))
      .groupBy(categories.id)
      .orderBy(categories.id),
    db
      .select({ total: count() })
      .from(transactions)
      // Compte des orphelines : elles n'ont aucune catégorie, l'espace ne peut
      // donc venir que de leur compte.
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          isNull(transactions.categoryId),
        ),
      ),
  ]);

  const tree = buildCategoryTree(rows).map((parent) => ({
    ...parent,
    // Seul `transactionCount` devient cumulé — `directTransactionCount` reste
    // le compte direct issu de la requête, ce que `removeCategory` utilise
    // pour avertir avant suppression et ce que la page /categories affiche.
    transactionCount:
      parent.transactionCount +
      parent.children.reduce((sum, c) => sum + c.transactionCount, 0),
  }));

  return { tree, uncategorizedCount: uncategorized?.total ?? 0 };
}
