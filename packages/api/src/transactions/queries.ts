import type { StatsInputSchema, TransactionsSearch } from "./schemas";
import type { SQL } from "@budget/db";

import { and, eq, exists, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, transactions } from "@budget/db/schema";

import {
  bankCountSchema,
  bankLabelSchema,
  budgetStatsSchema,
  earliestDateSchema,
  globalStatsSchema,
  PAGE_SIZE,
  totalSchema,
  transactionRowSchema,
} from "./schemas";

// The picker filters display labels, so accounts sharing a label form one group.
const bankLabel = sql`coalesce(ba.display_name, ba.bank_name)`;

export function filterTransactions(
  organizationId: string,
  query: Partial<TransactionsSearch>,
  // Aggregates omit excluded rows by default; the statement and its counts opt in.
  { includeExcluded = false } = {},
) {
  const { dateFrom, dateTo, direction, bank } = query;
  const banks = Array.isArray(bank) ? bank : bank ? [bank] : [];

  // Empty SQL fragments avoid interpolating undefined for missing filters.
  return sql`
    WITH filtered_transactions AS (
      SELECT t, c, p, ${bankLabel} AS bank_name
      FROM transactions t
      JOIN bank_accounts ba ON t.account_id = ba.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE ba.organization_id = ${organizationId}
        ${dateFrom && dateTo ? sql`AND t.booking_date BETWEEN ${dateFrom} AND ${dateTo}` : sql``}
        ${direction ? sql`AND t.direction = ${direction}` : sql``}
        ${includeExcluded ? sql`` : sql`AND t.excluded = false`}
        ${banks.length > 0 ? sql`AND ${bankLabel} IN ${banks}` : sql``}
    )
  `;
}

const parentBudget = sql`CASE
        WHEN COALESCE((p).budget_detailed, (c).budget_detailed)
          THEN (SELECT SUM(k.budget_amount) FROM categories k WHERE k.parent_id = COALESCE((p).id, (c).id))
        WHEN (p).name IS NULL THEN (c).budget_amount
        ELSE (p).budget_amount
      END`;

export async function budgetStats(
  organizationId: string,
  query: StatsInputSchema,
) {
  const result = await db.execute(sql`
      ${filterTransactions(organizationId, query)},
      budget_by_cat AS (
        SELECT COALESCE((p).name, (c).name) AS name, ${parentBudget} AS amount, SUM((t).amount) AS total
        FROM filtered_transactions
        WHERE ${parentBudget} IS NOT NULL
        GROUP BY 1, 2
      )
      SELECT SUM(b.amount) AS "totalBudget", SUM(b.total) AS "totalAmount"
      FROM budget_by_cat b
    `);
  return budgetStatsSchema.parse(result.rows[0]);
}

export async function globalStats(
  organizationId: string,
  query: StatsInputSchema,
) {
  const result = await db.execute(sql`
      ${filterTransactions(organizationId, query)}
      SELECT
        COALESCE(SUM((t).amount) FILTER (WHERE (t).direction = 'debit'), 0)::float8 AS debit,
        COALESCE(SUM((t).amount) FILTER (WHERE (t).direction = 'credit'), 0)::float8 AS credit
      FROM filtered_transactions
    `);
  return globalStatsSchema.parse(result.rows[0]);
}

// Apply content filters after the shared CTE so they do not narrow period aggregates.
function statementFilters({ status, category, q }: TransactionsSearch) {
  const statusCondition = status ? sql`AND (t).status = ${status}` : sql``;
  const categoryCondition =
    category === "none"
      ? sql`AND (t).category_id IS NULL`
      : category
        ? sql`AND ((c).name = ${category} OR (p).name = ${category})`
        : sql``;
  const qCondition = q
    ? sql`AND ((t).description ILIKE ${`%${q}%`} OR (t).counterparty ILIKE ${`%${q}%`})`
    : sql``;
  return sql`WHERE true ${statusCondition} ${categoryCondition} ${qCondition}`;
}

export async function listTransactions(
  organizationId: string,
  input: TransactionsSearch,
  limit = PAGE_SIZE,
) {
  const scope = filterTransactions(organizationId, input, {
    includeExcluded: true,
  });
  const filters = statementFilters(input);

  // Break ties by ID for stable pagination; sql.raw receives only fixed direction literals.
  const sortColumn =
    input.sort === "amount"
      ? sql`CASE WHEN (t).direction = 'debit' THEN -(t).amount ELSE (t).amount END`
      : sql`(t).booking_date`;
  const order = sql.raw(input.order === "asc" ? "ASC" : "DESC");
  const orderBy = sql`${sortColumn} ${order}, (t).id ${order}`;

  const [list, counted] = await Promise.all([
    db.execute(sql`
      ${scope}
      SELECT (t).id,
             (t).booking_date::text AS "bookingDate",
             (t).description,
             (t).counterparty,
             bank_name AS "bankName",
             (t).raw,
             (t).amount,
             (t).currency,
             (t).direction,
             (t).status,
             (c).name AS category,
             (t).category_source AS "categorySource",
             (t).category_id AS "categoryId",
             CASE WHEN (p).name IS NULL THEN (c).name
                  ELSE (p).name || ' › ' || (c).name END AS "categoryPath",
             coalesce((p).color, (c).color) AS "categoryColor",
             coalesce((p).icon, (c).icon) AS "categoryIcon",
             (t).excluded
      FROM filtered_transactions
      ${filters}
      ORDER BY ${orderBy}
      LIMIT ${limit} OFFSET ${(input.page - 1) * limit}
    `),
    db.execute(sql`
      ${scope}
      SELECT count(*)::int AS total FROM filtered_transactions ${filters}
    `),
  ]);

  return {
    rows: transactionRowSchema.array().parse(list.rows),
    total: totalSchema.parse(counted.rows[0]).total,
  };
}

export async function listBankLabels(organizationId: string) {
  const result = await db.execute(sql`
    SELECT DISTINCT ${bankLabel} AS "bankName"
    FROM bank_accounts ba
    WHERE ba.organization_id = ${organizationId}
      -- Disabled accounts with imported transactions must remain selectable.
      AND (ba.enabled OR EXISTS (SELECT 1 FROM transactions t WHERE t.account_id = ba.id))
    ORDER BY 1
  `);
  return bankLabelSchema
    .array()
    .parse(result.rows)
    .map((r) => r.bankName);
}

// Account filters must not change calendar bounds and invalidate a selected period.
export async function earliestTransactionDate(organizationId: string) {
  const result = await db.execute(sql`
    SELECT min(t.booking_date)::text AS date
    FROM transactions t
    JOIN bank_accounts ba ON t.account_id = ba.id
    WHERE ba.organization_id = ${organizationId}
  `);
  return earliestDateSchema.parse(result.rows[0]).date;
}

// Ignore the selected bank so other accounts retain meaningful picker counts.
export async function bankCounts(
  organizationId: string,
  input: TransactionsSearch,
) {
  const scope = filterTransactions(
    organizationId,
    { ...input, bank: undefined },
    { includeExcluded: true },
  );
  const result = await db.execute(sql`
    ${scope}
    SELECT bank_name AS bank, count(*)::int AS count
    FROM filtered_transactions
    ${statementFilters(input)}
    GROUP BY 1
    ORDER BY 1
  `);
  return bankCountSchema.array().parse(result.rows);
}

// Check both transaction and category ownership to prevent cross-space assignment.
export async function setTransactionCategory(
  organizationId: string,
  id: number,
  categoryId: number | null,
): Promise<void> {
  await db
    .update(transactions)
    .set({ categoryId, categorySource: "manual" })
    .where(and(eq(transactions.id, id), ownedByOrganization(organizationId)));
}

export async function setTransactionExcluded(
  organizationId: string,
  id: number,
  excluded: boolean,
): Promise<void> {
  await db
    .update(transactions)
    .set({ excluded })
    .where(and(eq(transactions.id, id), ownedByOrganization(organizationId)));
}

// Writes by client-supplied ID inherit organization scope through the bank account.
function ownedByOrganization(organizationId: string): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(bankAccounts)
      .where(
        and(
          eq(bankAccounts.id, transactions.accountId),
          eq(bankAccounts.organizationId, organizationId),
        ),
      ),
  );
}
