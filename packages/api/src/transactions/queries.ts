// Lectures et corrections manuelles sur la table des transactions.
import type { SQL } from "@budget/db";
import type { TransactionsSearch } from "@budget/shared";
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
import { FALLBACK_CATEGORY_COLOR, PAGE_SIZE } from "@budget/shared";

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

export interface CategoryBreakdownDetail {
  category: string;
  total: number;
  color: string;
  // Vrai pour la seule ligne « Non ventilé », qui n'est pas une catégorie mais
  // le reliquat porté par le parent lui-même. Le client s'en sert pour ne pas
  // poser `category=Non ventilé` en filtre — aucune ligne ne matcherait.
  unallocated: boolean;
}

export interface CategoryBreakdownItem {
  category: string;
  total: number;
  color: string;
  // Détail par sous-catégorie, trié comme le parent (total décroissant).
  // Vide si la catégorie n'a pas d'enfant : le graphique retombe alors sur une
  // barre d'un seul tenant.
  breakdown: CategoryBreakdownDetail[];
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

// Part du graphique portant un montant rattaché directement à la catégorie
// parente plutôt qu'à l'une de ses sous-catégories.
const UNALLOCATED_LABEL = "Non ventilé";

// Regroupe toujours au niveau de la catégorie parente : une sous-catégorie
// remonte dans le total de son parent, une catégorie déjà racine reste
// inchangée (parentCategories vide dans ce cas). Une barre du graphique vaut
// donc toujours une catégorie parente, et `breakdown` porte ses segments.
//
// L'agrégat SQL descend jusqu'à la catégorie feuille ; le repli sur le parent
// se fait en TypeScript. Conséquence : l'`order by` SQL porterait sur les
// feuilles, donc l'ordre des barres comme celui des segments est refait ici
// sur le total replié.
export async function transactionsByCategory(
  input: TransactionsSearch,
): Promise<CategoryBreakdownItem[]> {
  const where = transactionsFilterQuery(input);
  const rows = await db
    .select({
      parentId: parentCategories.id,
      parentName: parentCategories.name,
      parentColor: parentCategories.color,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      total: sql<string>`sum(${transactions.amount})`,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(where)
    .groupBy(
      parentCategories.id,
      parentCategories.name,
      parentCategories.color,
      categories.id,
      categories.name,
      categories.color,
    );

  // `unallocated` = montant porté par la catégorie parente elle-même. Il ne
  // devient une ligne « Non ventilé » que si la catégorie a par ailleurs des
  // sous-catégories ; sinon c'est simplement une catégorie racine sans enfant.
  interface Group {
    category: string;
    color: string;
    unallocated: number;
    breakdown: CategoryBreakdownDetail[];
  }
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const isChild = row.parentId !== null;
    // Le leftJoin laisse passer les transactions sans catégorie (tout est null) :
    // elles restent une part unique, sans détail, comme avant.
    const groupId = row.parentId ?? row.categoryId;
    const key = groupId === null ? "none" : String(groupId);
    const total = Number(row.total);

    let group = groups.get(key);
    if (!group) {
      // Une part croisée d'abord par ses enfants tient libellé et couleur du
      // parent joint, sinon de la ligne elle-même. Seule la part « sans
      // catégorie » n'a aucun des deux et retombe sur le libellé vide.
      group = {
        category: (isChild ? row.parentName : row.categoryName) ?? "",
        color:
          (isChild ? row.parentColor : row.categoryColor) ??
          FALLBACK_CATEGORY_COLOR,
        unallocated: 0,
        breakdown: [],
      };
      groups.set(key, group);
    }

    if (isChild) {
      group.breakdown.push({
        category: row.categoryName ?? "",
        total,
        color: row.categoryColor ?? FALLBACK_CATEGORY_COLOR,
        unallocated: false,
      });
    } else {
      group.unallocated += total;
    }
  }

  return [...groups.values()]
    .map((group) => {
      const breakdown = [...group.breakdown];
      const total =
        group.unallocated + breakdown.reduce((acc, c) => acc + c.total, 0);
      // Le montant porté par la catégorie parente elle-même ne devient un
      // segment qu'en présence de vraies sous-catégories.
      if (breakdown.length > 0 && group.unallocated !== 0) {
        breakdown.push({
          category: UNALLOCATED_LABEL,
          total: group.unallocated,
          color: group.color,
          unallocated: true,
        });
      }
      // Tri du plus gros au plus petit, « Non ventilé » compris : le graphique
      // dérive la nuance de chaque segment de son rang, un reliquat épinglé en
      // dernier donnerait la teinte la plus pâle au plus gros des segments.
      breakdown.sort((a, b) => b.total - a.total);
      return { category: group.category, color: group.color, total, breakdown };
    })
    .sort((a, b) => b.total - a.total);
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
