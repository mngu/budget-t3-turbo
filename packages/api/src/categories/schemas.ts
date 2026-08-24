// Schéma de la ligne brute renvoyée par newCategoriesOverview (SQL exécuté
// via db.execute, hors Drizzle) — clés en snake_case, telles que Postgres les
// renvoie. `budget_amount` du parent reste une colonne numeric (string chez
// node-postgres) ; les montants castés ::float8 dans la requête (children,
// transaction_count, total_amount) arrivent en number.
import { z } from "zod/v4";

const newCategoryOverviewChildSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  budgetAmount: z.number().nullable(),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

const newCategoryOverviewElementSchema = z.object({
  id: z.number().int(),
  organization_id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  budgetAmount: z.coerce.number().nullable(),
  budgetDetailed: z.coerce.number(),
  children: z.array(newCategoryOverviewChildSchema).nullable().default([]),
  transactionCount: z.number(),
  totalAmount: z.number().nullable(),
});

export type NewCategoryOverviewElementType = z.infer<
  typeof newCategoryOverviewElementSchema
>;

export const newCategoryOverviewSchema = z.array(
  newCategoryOverviewElementSchema,
);

export interface NewCategoryOverviewType
  extends z.infer<typeof newCategoryOverviewSchema> {}
