// Schéma de la ligne brute renvoyée par categoriesOverview (SQL exécuté
// via db.execute, hors Drizzle) — clés en snake_case, telles que Postgres les
// renvoie. `budget_amount` du parent reste une colonne numeric (string chez
// node-postgres) ; les montants castés ::float8 dans la requête (children,
// transaction_count, total_amount) arrivent en number.
import { z } from "zod/v4";

export const NO_CATEGORY_NAME = "None";

const categoryOverviewChildSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  budgetAmount: z.number().nullable(),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

export type CategoryOverviewChild = z.infer<typeof categoryOverviewChildSchema>;

const categoryOverviewElementSchema = z.object({
  id: z.number().int(),
  organization_id: z.string(),
  // `NO_CATEGORY_NAME` sur le poste des transactions sans catégorie, qui n'a
  // pas de ligne dans `categories` : le libellé est posé côté app
  // (`breakdown.ts`).
  name: z.string().nullable(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  budgetAmount: z.coerce.number().nullable(),
  budgetDetailed: z.boolean(),
  children: z.array(categoryOverviewChildSchema).nullable().default([]),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

export type CategoryOverviewElementType = z.infer<
  typeof categoryOverviewElementSchema
>;

export const categoryOverviewSchema = z.array(categoryOverviewElementSchema);

/**
 * Une catégorie **gérable** : tout l'overview sauf le poste des transactions
 * sans catégorie, seule ligne dont `name` vaut `NO_CATEGORY_NAME`.
 *
 * Ce poste est une part de la revue — il faut bien nommer la dépense qu'aucune
 * catégorie ne range — mais ce n'est pas une catégorie : rien ne peut le
 * renommer, le budgéter ni lui donner une icône. Les écrans de réglages
 * l'écartent par ce prédicat et n'ont plus à connaître le cas.
 */
export type ManagedCategory = CategoryOverviewElementType & { name: string };

export const isManagedCategory = (
  category: CategoryOverviewElementType,
): category is ManagedCategory =>
  category.name !== null && category.name !== NO_CATEGORY_NAME;

export type CategoryOverviewType = z.infer<typeof categoryOverviewSchema>;
