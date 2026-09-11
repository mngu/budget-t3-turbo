import type { TransactionsSearch } from "../transactions/schemas";
import type {
  CategoryOverviewElementType,
  CategoryOverviewType,
} from "./schemas";

// Lectures de l'arborescence de catégories.
import { eq, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { categories } from "@budget/db/schema";

import { bankFilter } from "../transactions/queries";
import { NO_CATEGORY_NAME } from "./schemas";
import { categoryOverviewSchema } from "./schemas";

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

/**
 * Le périmètre commun à toutes les lectures de transactions — et **le point de
 * passage du cloisonnement** : `ba.organization_id` y est posé avant tout
 * filtre venu de l'URL. La période, le sens, les comptes affichés, et par
 * défaut jamais les lignes écartées à la main.
 *
 * Le **filtre de comptes** est ce qui a manqué à la première écriture, et rien
 * à l'écran ne le réclame — sans lui la revue décrit tous les comptes sous une
 * sélection, donc affiche des chiffres, juste faux.
 *
 * Il expose `filtered_transactions`, un CTE de composites (`(t).amount`,
 * `(ba).bank_name`, `(c).name`, `(p).name`) : la requête qui suit en lit les
 * champs entre parenthèses.
 */
export function filterTransactions(
  organizationId: string,
  query: TransactionsSearch,
  // Le défaut doit être sûr : un agrégat écrit demain écarte les exclues sans
  // y penser. Seuls le relevé et les pastilles de comptes (qui annoncent ce
  // que le relevé affichera) les redemandent — c'est le seul endroit d'où les
  // reprendre.
  { includeExcluded = false } = {},
) {
  const { dateFrom, dateTo, direction } = query;
  const dateCondition =
    dateFrom && dateTo
      ? sql`AND t.booking_date BETWEEN ${dateFrom} AND ${dateTo}`
      : sql``;

  // Ternaire explicite : `direction && sql\`…\`` glisse `undefined` dans le
  // gabarit quand le sens n'est pas précisé.
  const directionCondition = direction
    ? sql`AND t.direction = ${direction}`
    : sql``;

  return sql`
    WITH filtered_transactions AS (
      SELECT t, ba, c, p
      FROM transactions t
      LEFT JOIN bank_accounts ba ON t.account_id = ba.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE true
        ${dateCondition}
        ${directionCondition}
      ${includeExcluded ? sql`` : sql`AND t.excluded = false`}
      AND ba.organization_id = ${organizationId}
      ${bankFilter(query.bank)}
    )
  `;
}

export async function categoriesOverview(
  organizationId: string,
  query: TransactionsSearch,
): Promise<CategoryOverviewType> {
  const result = await db.execute<CategoryOverviewElementType>(sql`
      ${filterTransactions(organizationId, query)}
      SELECT cat.id,
             cat.organization_id,
             cat.name,
             cat.color,
             cat.icon,
             cat.budget_amount AS "budgetAmount",
             cat.budget_detailed AS "budgetDetailed",
         json_array(
           SELECT json_build_object(
             'id', c.id, 
             'name', c.name, 
             -- Sous une parente **globale**, les montants des enfants sont
             -- dormants : conservés pour qu'un aller-retour ne les perde pas,
             -- comptés dans aucune enveloppe (CHECK
             -- categories_detailed_no_amount, et budgetSlots côté app). Les
             -- lire peindrait dans la revue une jauge contre un chiffre absent
             -- de l'enveloppe. Ce masque venait de child_budget
             -- (transactions/queries.ts), supprimé avec breakdownByCategories.
             'budgetAmount',
             CASE WHEN cat.budget_detailed THEN c.budget_amount::float8 END,
             'transactionCount',
             agg.transaction_count,
             'totalAmount',
             agg.total_amount
           )
           FROM categories c
           CROSS JOIN LATERAL (
             SELECT COUNT(*)::float8 AS transaction_count,
                    SUM((t).amount)::float8 AS total_amount
             FROM filtered_transactions
             WHERE (t).category_id = c.id
           ) agg
           WHERE c.parent_id = cat.id
           ORDER BY agg.total_amount DESC NULLS LAST
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

      UNION ALL

      -- Le poste des transactions qu'aucune catégorie ne range. Il n'a pas de
      -- ligne dans categories, et rien ne permet de le déduire des autres
      -- postes : sans cette branche l'anneau prétend partitionner un total
      -- dont il ignore une part, et la sentinelle d'URL none — seul signal
      -- restant des transactions non classées — perd son unique producteur.
      -- name reste NULL : ce sont les replis de breakdown.ts qui posent le
      -- libellé et la sentinelle, aucun texte d'interface ne descend en SQL.
      SELECT -1,
             ${organizationId}::text,
             ${NO_CATEGORY_NAME},
             NULL::text,
             NULL::text,
             NULL::numeric,
             false,
             json_array(),
             (
               SELECT COUNT(*)::float8
               FROM filtered_transactions
               WHERE (t).category_id IS NULL
             ),
             (
               SELECT SUM((t).amount)::float8
               FROM filtered_transactions
               WHERE (t).category_id IS NULL
             )
      -- Pas de ligne quand tout est rangé : un poste vide se lirait comme un
      -- reste à classer qui n'existe pas.
      WHERE EXISTS (
        SELECT 1 FROM filtered_transactions WHERE (t).category_id IS NULL
      )

      ORDER BY "totalAmount" DESC NULLS LAST
    `);

  return categoryOverviewSchema.parse(result.rows);
}
