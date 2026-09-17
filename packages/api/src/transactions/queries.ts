import type {
  BudgetStats,
  GlobalStats,
  StatsInputSchema,
  TransactionRow,
  TransactionsSearch,
} from "./schemas";
// Lectures et corrections manuelles sur la table des transactions.
import type { SQL } from "@budget/db";

import { and, asc, eq, exists, inArray, or, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, transactions } from "@budget/db/schema";

import {
  budgetStatsSchema,
  globalStatsSchema,
  PAGE_SIZE,
  transactionRowSchema,
} from "./schemas";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${bankAccounts.displayName}, ${bankAccounts.bankName})`;

// Le même libellé, lu hors du CTE de `filterTransactions` où `ba` est un
// composite.
const filteredBankLabel = sql.raw(
  "coalesce((ba).display_name, (ba).bank_name)",
);

// Le filtre de comptes, en SQL brut : `bankCondition` s'écrit sur les tables
// Drizzle non aliasées, il ne peut pas se corréler à l'alias `ba` des CTE
// ci-dessous. Le libellé reste celui du sélecteur de comptes
// (`coalesce(display_name, bank_name)`), jamais `account_id` : deux comptes
// partageant un libellé sont indissociables dans l'UI.
function bankFilter(bank: TransactionsSearch["bank"]) {
  const banks = Array.isArray(bank) ? bank : bank ? [bank] : [];
  // Une liste vide vaut « tous les comptes », comme `undefined` — même lecture
  // que `selectedBanks` côté client.
  if (banks.length === 0) return sql``;
  return sql` AND ${inArray(filteredBankLabel, banks)}`;
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
  query: Partial<TransactionsSearch>,
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

// Une catégorie **racine** (sans parent) est son propre poste : c'est elle qui
// en porte le nom, l'icône, la couleur et le budget. Sans ce repli, un
// `GROUP BY (p).name` rassemble toutes les racines — et les transactions sans
// catégorie du tout — dans un seul seau `null`.
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
  const result = await db.execute<BudgetStats>(sql`
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
  const result = await db.execute<GlobalStats>(sql`
      ${filterTransactions(organizationId, query)}
      SELECT
        COALESCE(SUM((t).amount) FILTER (WHERE (t).direction = 'debit'), 0)::float8 AS debit,
        COALESCE(SUM((t).amount) FILTER (WHERE (t).direction = 'credit'), 0)::float8 AS credit
      FROM filtered_transactions
    `);
  return globalStatsSchema.parse(result.rows[0]);
}

// Les filtres propres au relevé, posés **après** le CTE et non dedans :
// `category` y partitionnerait l'overview, qui agrège justement *par*
// catégorie. Un parent choisi inclut ses sous-catégories (2 niveaux).
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

// `limit` déroge à PAGE_SIZE pour les écrans qui ne paginent pas (« À revoir »,
// zoom catégorie) : ils affichent une tranche plus large d'un coup plutôt que de
// faire naviguer l'utilisateur. La pagination reste le cas par défaut.
export async function listTransactions(
  organizationId: string,
  input: TransactionsSearch,
  limit = PAGE_SIZE,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const scope = filterTransactions(organizationId, input, {
    includeExcluded: true,
  });
  const filters = statementFilters(input);

  // Tri par montant **signé** : les plus gros débits en tête en `desc`. Le
  // départage sur `(t).id` rend la pagination stable à date égale. `order` est
  // un enum validé par zod, `sql.raw` ne reçoit jamais une valeur libre.
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
             ${filteredBankLabel} AS "bankName",
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
    db.execute<{ total: number }>(sql`
      ${scope}
      SELECT count(*)::int AS total FROM filtered_transactions ${filters}
    `),
  ]);

  return {
    rows: transactionRowSchema.array().parse(list.rows),
    total: counted.rows[0]?.total ?? 0,
  };
}

export async function listBankLabels(
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ bankName: bankLabel })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        // Un compte décoché au wizard n'est jamais importé : le nommer ici
        // ajouterait au panneau une ligne à 0 qui ne peut rien filtrer.
        // Mais s'il a déjà des transactions (décoché *après* un import), son
        // libellé doit rester : ses lignes pèsent dans les agrégats tant que
        // `bank` est indéfini, et sans case à cocher elles disparaîtraient au
        // premier décochage sans que rien ne l'explique.
        or(
          eq(bankAccounts.enabled, true),
          exists(
            db
              .select({ one: sql`1` })
              .from(transactions)
              .where(eq(transactions.accountId, bankAccounts.id)),
          ),
        ),
      ),
    )
    .orderBy(asc(bankLabel));
  return rows.map((r) => r.bankName);
}

/**
 * Date de la transaction la plus ancienne de l'espace, ou `null` s'il n'y en a
 * aucune — borne basse du sélecteur de période.
 *
 * **Sans aucun filtre, `bank` compris**, alors que la search en porte un : la
 * borne d'un calendrier ne peut pas dépendre des comptes cochés, sinon décocher
 * un compte rendrait illégale une période déjà choisie, sur un clic qui ne
 * parlait pas de dates. Le périmètre est l'espace, via `bank_accounts` —
 * `transactions` ne porte pas d'`organization_id`.
 */
export async function earliestTransactionDate(
  organizationId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ date: sql<string | null>`min(${transactions.bookingDate})` })
    .from(transactions)
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
    .where(eq(bankAccounts.organizationId, organizationId));
  return row?.date ?? null;
}

// Nombre de transactions par banque pour les pastilles de la barre de filtres.
// `bank` est retiré du filtre : sinon sélectionner une banque mettrait les
// autres à zéro et on ne saurait plus vers quoi basculer.
export async function bankCounts(
  organizationId: string,
  input: TransactionsSearch,
): Promise<{ bank: string; count: number }[]> {
  // La pastille annonce des lignes, pas de l'argent : elle compte ce que le
  // relevé affichera une fois le compte coché, exclusions comprises.
  const scope = filterTransactions(
    organizationId,
    { ...input, bank: undefined },
    { includeExcluded: true },
  );
  const result = await db.execute<{ bank: string; count: number }>(sql`
    ${scope}
    SELECT ${filteredBankLabel} AS bank, count(*)::int AS count
    FROM filtered_transactions
    ${statementFilters(input)}
    GROUP BY 1
    ORDER BY 1
  `);
  return result.rows;
}

// Une correction manuelle écrase la valeur précédente (LLM ou manuelle) ; le
// garde IS NULL de categorization.ts empêche le LLM d'y retoucher ensuite.
//
// Les **deux** côtés portent l'espace, et c'est le point à ne pas alléger : la
// catégorie parce que son nom n'est unique que dans l'espace, la transaction
// parce que son id vient du client — sans le `EXISTS`, l'id d'une ligne d'un
// autre foyer serait recatégorisé sans un mot.
export async function setTransactionCategory(
  organizationId: string,
  id: number,
  categoryId: number | null,
): Promise<void> {
  await db
    .update(transactions)
    .set({ categoryId: categoryId, categorySource: "manual" })
    .where(and(eq(transactions.id, id), ownedByOrganization(organizationId)));
}

// Exclusion manuelle : la ligne sort de tous les agrégats (revue, budgets,
// historique, suggestions) et reste dans le relevé, seul endroit d'où la
// reprendre. Aucun traitement ne la pose ni ne la retire — voir le commentaire
// de la colonne.
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

/**
 * « Cette transaction est bien dans l'espace. » À poser sur toute écriture
 * ciblée par un id venu du client — l'`UPDATE` n'a pas de `FROM bank_accounts` où
 * accrocher la condition, d'où le `EXISTS` corrélé.
 */
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
