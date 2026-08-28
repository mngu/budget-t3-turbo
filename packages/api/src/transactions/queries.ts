import type { BudgetStats, GlobalStats, TransactionsSearch } from "./schemas";
// Lectures et corrections manuelles sur la table des transactions.
import type { SQL } from "@budget/db";

import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";

import { budgetStatsSchema, globalStatsSchema, PAGE_SIZE } from "./schemas";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${bankAccounts.displayName}, ${bankAccounts.bankName})`;

// Utilisé pour matcher une transaction dont la sous-catégorie appartient
// au parent choisi dans le filtre (categories.tree, 2 niveaux).
const parentCategories = alias(categories, "parent_categories");

// Le filtre de comptes. Une liste vide vaut « pas de filtre », comme
// `undefined` : c'est la lecture que fait déjà `selectedBanks` côté client, et
// le panneau de comptes refuse de décocher le dernier — les deux doivent dire
// la même chose d'une URL bricolée à la main.
function bankCondition(
  bank: TransactionsSearch["bank"],
  label: SQL<string>,
): SQL | undefined {
  if (Array.isArray(bank))
    return bank.length > 0 ? inArray(label, bank) : undefined;
  return bank ? eq(label, bank) : undefined;
}

export interface TransactionRow {
  id: number;
  bookingDate: string;
  description: string;
  counterparty: string | null;
  bankName: string;
  raw: {
    debtor?: { name?: string };
  };
  amount: string;
  currency: string;
  direction: "debit" | "credit";
  status: "booked" | "pending";
  /** Catégorie feuille — c'est elle que `updateCategory` réécrit. */
  category: string | null;
  /**
   * Qui a posé la catégorie : `manual` = corrigée à la main, le seul état que
   * la table signale (pastille « modifiée »). `llm` / `auto` sont le régime
   * normal et n'ont rien à dire au lecteur ; `null` = aucune catégorie.
   */
  categorySource: string | null;
  categoryId: number | null;
  /** Chemin affiché : « Parent › Enfant », ou « Parent » seul. */
  categoryPath: string | null;
  /** Couleur de la catégorie *parente* : les lignes se lisent par famille. */
  categoryColor: string | null;
  categoryIcon: string | null;
  /** Exclue à la main des agrégats — elle reste dans ce relevé, et là seulement. */
  excluded: boolean;
}

// Le filtre de comptes, en SQL brut : `bankCondition` s'écrit sur les tables
// Drizzle non aliasées, il ne peut pas se corréler à l'alias `ba` des CTE
// ci-dessous. Le libellé reste celui du sélecteur de comptes
// (`coalesce(display_name, bank_name)`), jamais `account_id` : deux comptes
// partageant un libellé sont indissociables dans l'UI.
export function bankFilter(bank: TransactionsSearch["bank"]) {
  const banks = Array.isArray(bank) ? bank : bank ? [bank] : [];
  // Une liste vide vaut « tous les comptes », comme `undefined` — même lecture
  // que `selectedBanks` côté client.
  if (banks.length === 0) return sql``;
  const label = sql.raw("coalesce(ba.display_name, ba.bank_name)");
  return sql` AND ${inArray(label, banks)}`;
}

/**
 * Le périmètre des agrégats de la revue : la période, les comptes affichés, et
 * jamais les lignes exclues à la main.
 */
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
      ${bankFilter(query.bank)}
    )
  `;
}

// Une catégorie **racine** (sans parent) est son propre poste : c'est elle qui
// en porte le nom, l'icône, la couleur et le budget. Sans ce repli, un
// `GROUP BY (p).name` rassemble toutes les racines — et les transactions sans
// catégorie du tout — dans un seul seau `null`.
const parentName = sql`COALESCE((p).name, (c).name)`;
// …et son budget est le sien. Un `COALESCE((p).budget_amount,
// (c).budget_amount)` serait faux ici : sous une parente **sans** budget, il
// ferait passer celui d'une sous-catégorie pour le budget du poste.
//
// Sauf quand le poste est **détaillé** : ce sont alors ses sous-catégories qui
// portent les montants, et son budget est leur somme. Elle n'en stocke aucun à
// elle (CHECK `categories_detailed_no_amount`), il n'y a donc rien à préférer —
// la somme est la seule valeur qui existe.
const posteId = sql`COALESCE((p).id, (c).id)`;
const posteDetailed = sql`COALESCE((p).budget_detailed, (c).budget_detailed)`;
const parentBudget = sql`CASE
        WHEN ${posteDetailed}
          THEN (SELECT SUM(k.budget_amount) FROM categories k WHERE k.parent_id = ${posteId})
        WHEN (p).name IS NULL THEN (c).budget_amount
        ELSE (p).budget_amount
      END`;

export async function budgetStats(
  organizationId: string,
  query: TransactionsSearch,
) {
  const result = await db.execute<BudgetStats>(sql`
      ${filterTransactions(organizationId, query)},
      budget_by_cat AS (
        SELECT ${parentName} AS name, ${parentBudget} AS amount, SUM((t).amount) AS total
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
  query: TransactionsSearch,
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

/**
 * Le filtre commun à toutes les lectures de transactions — et **le point de
 * passage du cloisonnement** : `organization_id` y est une condition non
 * négociable, posée avant tout filtre venu de l'URL, et non un critère de plus.
 *
 * Il porte sur `bank_accounts` : les transactions n'ont pas de colonne d'espace,
 * elles tiennent le leur de leur compte. Toute requête qui utilise ce filtre
 * doit donc joindre `bank_accounts` (`innerJoin`), sans quoi Postgres refuse.
 */
export function transactionsFilterQuery(
  organizationId: string,
  query: TransactionsSearch,
  // Les transactions exclues à la main sortent par défaut, sans param d'URL :
  // le défaut doit être sûr, un agrégat écrit demain les écarte sans y penser.
  // Seuls les deux appelants qui décrivent le **relevé** (la table et les
  // pastilles de comptes, qui annoncent ce que la table affichera) les gardent.
  { includeExcluded = false } = {},
): SQL<unknown> | undefined {
  const conditions: SQL[] = [eq(bankAccounts.organizationId, organizationId)];
  if (!includeExcluded) conditions.push(eq(transactions.excluded, false));
  // `bank` accepte une banque ou une liste (voir @budget/shared).
  const bank = bankCondition(query.bank, bankLabel);
  if (bank) conditions.push(bank);

  if (query.direction)
    conditions.push(eq(transactions.direction, query.direction));
  if (query.status) conditions.push(eq(transactions.status, query.status));
  if (query.category === "none")
    conditions.push(isNull(transactions.categoryId));
  else if (query.category) {
    const categoryFilter = or(
      eq(categories.name, query.category),
      eq(parentCategories.name, query.category),
    );
    if (categoryFilter) conditions.push(categoryFilter);
  }
  if (query.dateFrom)
    conditions.push(gte(transactions.bookingDate, query.dateFrom));
  if (query.dateTo)
    conditions.push(lte(transactions.bookingDate, query.dateTo));
  if (query.q) {
    const qFilter = or(
      ilike(transactions.description, `%${query.q}%`),
      ilike(transactions.counterparty, `%${query.q}%`),
    );
    if (qFilter) {
      conditions.push(qFilter);
    }
  }
  return and(...conditions);
}

// `limit` déroge à PAGE_SIZE pour les écrans qui ne paginent pas (« À revoir »,
// zoom catégorie) : ils affichent une tranche plus large d'un coup plutôt que de
// faire naviguer l'utilisateur. La pagination reste le cas par défaut.
export async function listTransactions(
  organizationId: string,
  input: TransactionsSearch,
  limit = PAGE_SIZE,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const where = transactionsFilterQuery(organizationId, input, {
    includeExcluded: true,
  });

  const signedAmount = sql`case when ${transactions.direction} = 'debit' then -${transactions.amount} else ${transactions.amount} end`;
  const sortColumn =
    input.sort === "amount" ? signedAmount : transactions.bookingDate;
  const orderBy =
    input.order === "asc"
      ? [asc(sortColumn), asc(transactions.id)]
      : [desc(sortColumn), desc(transactions.id)];

  const [rows, [countRow]] = await Promise.all([
    db
      .select({
        id: transactions.id,
        bookingDate: transactions.bookingDate,
        description: transactions.description,
        counterparty: transactions.counterparty,
        bankName: bankLabel,
        raw: transactions.raw,
        amount: transactions.amount,
        currency: transactions.currency,
        direction: transactions.direction,
        status: transactions.status,
        category: categories.name,
        categorySource: transactions.categorySource,
        categoryIcon: sql<
          string | null
        >`coalesce(${parentCategories.icon}, ${categories.icon})`,
        categoryId: sql<
          string | null
        >`coalesce(${categories.id}, ${parentCategories.id})`,
        categoryPath: sql<
          string | null
        >`case when ${parentCategories.name} is null then ${categories.name}
               else ${parentCategories.name} || ' › ' || ${categories.name} end`,
        categoryColor: sql<
          string | null
        >`coalesce(${parentCategories.color}, ${categories.color})`,
        excluded: transactions.excluded,
      })
      .from(transactions)
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset((input.page - 1) * limit),
    db
      .select({ total: count() })
      .from(transactions)
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .where(where),
  ]);

  // La colonne jsonb `raw` se type trop largement pour être inférée.
  return { rows: rows as TransactionRow[], total: countRow?.total ?? 0 };
}

export interface MonthlyCategoryTotal {
  /** Mois au format `YYYY-MM`. */
  month: string;
  /** Catégorie parente ; `null` = transactions sans catégorie. */
  category: string | null;
  debit: number;
  credit: number;
  // Sert à repérer un mois partiel : le premier mois importé ne couvre qu'une
  // fraction du calendrier et fausserait toute moyenne de référence. Un volume
  // de transactions écroulé le trahit là où un montant ne le trahit pas.
  count: number;
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
  const where = transactionsFilterQuery(
    organizationId,
    { ...input, bank: undefined },
    // La pastille annonce des lignes, pas de l'argent : elle doit compter ce que
    // la table affichera une fois le compte coché, exclusions comprises.
    { includeExcluded: true },
  );
  const rows = await db
    .select({ bank: bankLabel, count: count() })
    .from(transactions)
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(where)
    .groupBy(bankLabel)
    .orderBy(asc(bankLabel));
  return rows;
}

// Une correction manuelle écrase la valeur précédente (LLM ou manuelle) ; le
// garde IS NULL de categorization/run.ts empêche le LLM d'y retoucher ensuite.
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
export function ownedByOrganization(organizationId: string): SQL {
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
