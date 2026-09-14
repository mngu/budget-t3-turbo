import type { TransactionsSearch } from "../transactions/schemas";
import type {
  CategoryOverviewElementType,
  CategoryOverviewType,
} from "./schemas";

// Lectures de l'arborescence de catégories.
import { sql } from "@budget/db";
import { db } from "@budget/db/client";

import { filterTransactions } from "../transactions/queries";
import { categoryOverviewSchema, NO_CATEGORY_NAME } from "./schemas";

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
             -- de l'enveloppe.
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
