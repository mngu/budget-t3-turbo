// Lectures et corrections manuelles sur la table des transactions.
import type { SQL } from "@budget/db";
import type { TransactionsSearch } from "@budget/validators";
import {
  alias,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lte,
  or,
  sql,
} from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, categories, transactions } from "@budget/db/schema";
import { FALLBACK_CATEGORY_COLOR, PAGE_SIZE } from "@budget/validators";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${accounts.displayName}, ${accounts.bankName})`;

// Utilisé pour matcher une transaction dont la sous-catégorie appartient
// au parent choisi dans le filtre (categories.tree, 2 niveaux).
const parentCategories = alias(categories, "parent_categories");

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
  category: string | null;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  color: string;
}

function transactionsFilterQuery(
  query: TransactionsSearch,
): SQL<unknown> | undefined {
  const conditions: SQL[] = [];
  if (query.bank) conditions.push(eq(bankLabel, query.bank));
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
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listTransactions(
  input: TransactionsSearch,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const where = transactionsFilterQuery(input);

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
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(PAGE_SIZE)
      .offset((input.page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .where(where),
  ]);

  // La colonne jsonb `raw` se type trop largement pour être inférée.
  return { rows: rows as TransactionRow[], total: countRow?.total ?? 0 };
}

// Regroupe toujours au niveau de la catégorie parente : une sous-catégorie
// remonte dans la part de son parent (coalesce vers parentCategories), une
// catégorie déjà racine reste inchangée (parentCategories vide dans ce cas).
// Le graphique n'affiche ainsi jamais de sous-catégorie comme part à part
// entière.
export async function transactionsByCategory(
  input: TransactionsSearch,
): Promise<CategoryBreakdownItem[]> {
  const where = transactionsFilterQuery(input);
  const categoryLabel = sql<string>`coalesce(${parentCategories.name}, ${categories.name})`;
  const categoryColor = sql<
    string | null
  >`coalesce(${parentCategories.color}, ${categories.color})`;
  const categoryGroupId = sql`coalesce(${parentCategories.id}, ${categories.id})`;
  const rows = await db
    .select({
      category: categoryLabel,
      total: sql<string>`sum(${transactions.amount})`,
      color: categoryColor,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(where)
    .groupBy(categoryGroupId, categoryLabel, categoryColor)
    .orderBy(desc(sql`sum(${transactions.amount})`));

  return rows.map((r) => ({
    category: r.category,
    total: Number(r.total),
    color: r.color ?? FALLBACK_CATEGORY_COLOR,
  }));
}

export async function listBankLabels(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ bankName: bankLabel })
    .from(accounts)
    .orderBy(asc(bankLabel));
  return rows.map((r) => r.bankName);
}

// Une correction manuelle écrase la valeur précédente (LLM ou manuelle) ; le
// garde IS NULL de categorization/run.ts empêche le LLM d'y retoucher ensuite.
export async function setTransactionCategory(
  id: number,
  categoryName: string,
): Promise<void> {
  const [match] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.name, categoryName));
  if (!match) throw new Error(`Catégorie inconnue : ${categoryName}`);

  await db
    .update(transactions)
    .set({ categoryId: match.id, categorySource: "manual" })
    .where(eq(transactions.id, id));
}
