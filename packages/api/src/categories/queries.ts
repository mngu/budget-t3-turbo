// Lectures de l'arborescence de catégories.
import { eq, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { categories } from "@budget/db/schema";

import type { TransactionsSearch } from "../transactions/schemas";
import type {
  NewCategoryOverviewElementType,
  NewCategoryOverviewType,
} from "./schemas";
import { newCategoryOverviewSchema } from "./schemas";

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

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  color: categories.color,
  icon: categories.icon,
  parentId: categories.parentId,
};

// Reconstruit l'arborescence parents → enfants à partir d'une liste plate
// (les catégories n'ont que 2 niveaux).
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

export function filterTransactions(
  organizationId: string,
  query: TransactionsSearch,
) {
  return sql`
    WITH filtered_transactions AS (
      SELECT t, ba, c, p
      FROM transactions t
      LEFT JOIN bank_accounts ba ON t.account_id = ba.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE t.booking_date BETWEEN ${query.dateFrom} AND ${query.dateTo}
      AND t.excluded = 'false'
      AND ba.organization_id = ${organizationId}
    )
  `;
}

export async function newCategoriesOverview(
  organizationId: string,
  query: TransactionsSearch,
): Promise<NewCategoryOverviewType> {
  const result = await db.execute<NewCategoryOverviewElementType>(sql`
      ${filterTransactions(organizationId, query)}
      SELECT cat.*,
             cat.organization_id AS "organizationId",
             cat.budget_amount AS "budgetAmount",
             cat.budget_detailed AS "budgetDetailed",
         json_array(
           SELECT json_build_object(
             'id', c.id, 
             'name', c.name, 
             'budgetAmount', c.budget_amount::float8,
             'transactionCount',
             (SELECT COUNT(*)::float8 FROM filtered_transactions WHERE (t).category_id = c.id),
             'totalAmount',
             (SELECT SUM((t).amount) FROM filtered_transactions WHERE (t).category_id = c.id)
           )
           FROM categories c
           WHERE c.parent_id = cat.id
         ) as children,
        (
        SELECT COUNT(*)::float8
          FROM filtered_transactions
          LEFT JOIN categories pc ON (t).category_id = pc.id 
          WHERE (t).category_id = cat.id OR pc.parent_id = cat.id
        ) as "transactionCount",
        (
        SELECT SUM((t).amount)::float8
          FROM filtered_transactions
          LEFT JOIN categories pc ON (t).category_id = pc.id 
          WHERE (t).category_id = cat.id OR pc.parent_id = cat.id
        ) as "totalAmount"
      FROM categories cat
      WHERE cat.organization_id = ${organizationId} AND parent_id IS NULL
      ORDER BY "totalAmount" DESC NULLS LAST 
    `);

  return newCategoryOverviewSchema.parse(result.rows);
}
