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
import {
  FALLBACK_CATEGORY_COLOR,
  PAGE_SIZE,
  REVIEW_QUEUE_LIMIT,
} from "@budget/shared";

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
  /** Catégorie feuille — c'est elle que `updateCategory` réécrit. */
  category: string | null;
  /** Chemin affiché : « Parent › Enfant », ou « Parent » seul. */
  categoryPath: string | null;
  /** Couleur de la catégorie *parente* : les lignes se lisent par famille. */
  categoryColor: string | null;
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
  // « Non ventilé » : la transaction porte une catégorie *parente* qui a par
  // ailleurs des sous-catégories. C'est un prédicat de ligne, sans rapport avec
  // le drapeau `unallocated` de transactionsByCategory qui, lui, est un
  // agrégat. Ne pas confondre non plus avec `category: "none"` (aucune
  // catégorie du tout) : ici la transaction est classée, mais trop grossièrement.
  if (query.nvOnly)
    conditions.push(
      sql`${categories.parentId} is null and exists (
        select 1 from ${categories} as nv_children
        where nv_children.parent_id = ${categories.id}
      )`,
    );
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

// `limit` déroge à PAGE_SIZE pour les écrans qui ne paginent pas (ventilation,
// zoom catégorie) : ils affichent une tranche plus large d'un coup plutôt que de
// faire naviguer l'utilisateur. La pagination reste le cas par défaut.
export async function listTransactions(
  input: TransactionsSearch,
  limit = PAGE_SIZE,
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
        categoryPath: sql<
          string | null
        >`case when ${parentCategories.name} is null then ${categories.name}
               else ${parentCategories.name} || ' › ' || ${categories.name} end`,
        categoryColor: sql<
          string | null
        >`coalesce(${parentCategories.color}, ${categories.color})`,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(limit)
      .offset((input.page - 1) * limit),
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

// Motif pour lequel une transaction remonte dans la file « À revoir ».
// La base ne stocke aucun score de confiance : la file est construite sur des
// signaux réellement présents (catégorie absente, catégorie trop grossière,
// sens contraire à celui de la catégorie), jamais sur une probabilité inventée.
export type ReviewReason = "sans-categorie" | "non-ventile" | "sens-inhabituel";

export interface ReviewItem {
  id: number;
  bookingDate: string;
  description: string;
  bankName: string;
  amount: string;
  direction: "debit" | "credit";
  /** Catégorie feuille portée par la transaction. */
  category: string | null;
  /** Chemin affiché : « Parent › Enfant », ou « Parent » seul. */
  categoryPath: string | null;
  categoryColor: string | null;
  reason: ReviewReason;
}

// Part minimale d'un sens pour qu'il soit considéré comme *le* sens de la
// catégorie ; en dessous, la catégorie mélange les deux et une transaction à
// contre-sens n'a rien d'anormal.
const DIRECTION_DOMINANCE = 0.85;

// Nombre de transactions minimum avant de juger du sens d'une catégorie : sur
// deux ou trois lignes, 100 % de débits ne veut rien dire.
const DIRECTION_MIN_SAMPLE = 8;

// File de relecture : les transactions du périmètre affiché qu'il vaut la peine
// de reprendre à la main. Une correction manuelle (`category_source = 'manual'`)
// vaut confirmation et sort définitivement de la file.
export async function reviewQueue(
  input: TransactionsSearch,
  limit: number = REVIEW_QUEUE_LIMIT,
): Promise<ReviewItem[]> {
  const parentName = sql<
    string | null
  >`coalesce(${parentCategories.name}, ${categories.name})`;

  // Sens dominant par catégorie parente, sur toute l'historique et sans filtre :
  // c'est une statistique de la catégorie, pas du mois affiché.
  const stats = await db
    .select({
      category: parentName,
      debit: sql<string>`count(*) filter (where ${transactions.direction} = 'debit')`,
      credit: sql<string>`count(*) filter (where ${transactions.direction} = 'credit')`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .groupBy(parentName);

  const oddDirection = new Map<string, "debit" | "credit">();
  for (const row of stats) {
    if (row.category === null) continue;
    const debit = Number(row.debit);
    const credit = Number(row.credit);
    const total = debit + credit;
    if (total < DIRECTION_MIN_SAMPLE) continue;
    if (debit / total >= DIRECTION_DOMINANCE)
      oddDirection.set(row.category, "credit");
    else if (credit / total >= DIRECTION_DOMINANCE)
      oddDirection.set(row.category, "debit");
  }

  const base = transactionsFilterQuery(input);
  const oddPairs = [...oddDirection].map(([category, direction]) =>
    and(eq(parentName, category), eq(transactions.direction, direction)),
  );

  const suspect = or(
    isNull(transactions.categoryId),
    sql`${categories.parentId} is null and exists (
      select 1 from ${categories} as nv_children
      where nv_children.parent_id = ${categories.id}
    )`,
    ...oddPairs,
  );

  // Le non ventilé passe en dernier sous le plafond. Il domine le prédicat en
  // volume (toute transaction rattachée à un parent qui a des enfants) et, s'il
  // est trié au seul montant, il monopolise les `limit` lignes : les « sans
  // catégorie » et les sens inhabituels — les deux seuls motifs qui n'ont pas
  // d'autre écran — tombent alors sous la coupe et ne remontent nulle part.
  // Le non ventilé, lui, n'y perd rien : la page de ventilation le regroupe
  // depuis `listTransactions({ nvOnly: true })`, une requête distincte.
  const priority = sql`case when ${or(isNull(transactions.categoryId), ...oddPairs)} then 0 else 1 end`;

  const rows = await db
    .select({
      id: transactions.id,
      bookingDate: transactions.bookingDate,
      description: transactions.description,
      bankName: bankLabel,
      amount: transactions.amount,
      direction: transactions.direction,
      category: categories.name,
      parent: parentCategories.name,
      color: sql<
        string | null
      >`coalesce(${parentCategories.color}, ${categories.color})`,
      categoryId: transactions.categoryId,
      parentId: categories.parentId,
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(
      and(
        base,
        suspect,
        // Une catégorie corrigée à la main est confirmée : elle ne revient pas.
        or(
          isNull(transactions.categorySource),
          sql`${transactions.categorySource} <> 'manual'`,
        ),
      ),
    )
    .orderBy(priority, desc(transactions.amount))
    .limit(limit);

  return rows.map((row) => {
    const parentLabel = row.parent ?? row.category;
    const reason: ReviewReason =
      row.categoryId === null
        ? "sans-categorie"
        : parentLabel !== null &&
            oddDirection.get(parentLabel) === row.direction
          ? "sens-inhabituel"
          : "non-ventile";
    return {
      id: row.id,
      bookingDate: row.bookingDate,
      description: row.description,
      bankName: row.bankName,
      amount: row.amount,
      direction: row.direction,
      category: row.category,
      categoryPath:
        row.parent === null ? row.category : `${row.parent} › ${row.category}`,
      categoryColor: row.color,
      reason,
    };
  });
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

// Nombre de mois d'historique remontés. 12 : il en faut 6 pour la sparkline,
// 3 pour la moyenne de référence, et la série de mois négatifs peut être plus
// longue que ça.
const HISTORY_MONTHS = 12;

// Historique mensuel par catégorie parente, sur la fenêtre qui *précède et
// inclut* le mois affiché. Sert aux tuiles de la revue (comparaison à la moyenne
// 3 mois, sparkline, série de mois négatifs) et au tri « Écart vs moy. ».
//
// Les bornes de date de la recherche sont volontairement ignorées — elles sont
// remplacées par la fenêtre d'historique — mais tous les autres filtres
// s'appliquent, pour que les tuiles parlent bien du périmètre affiché.
//
// `direction` est la seule exception, et elle est neutralisée **ici** plutôt
// qu'à l'appel : la requête renvoie une colonne débit *et* une colonne crédit,
// un filtre de sens en mettrait une des deux à zéro sur tous les mois. La tuile
// Revenus se comparerait alors à des zéros et la série de mois négatifs
// compterait tout l'historique. L'oubli étant invisible à l'écran (les totaux
// du mois, eux, viennent de `byCategory` et restent justes), la garde ne doit
// pas dépendre de l'appelant.
export async function monthlyHistory(
  input: TransactionsSearch,
): Promise<MonthlyCategoryTotal[]> {
  const anchor = input.dateTo ?? input.dateFrom ?? new Date().toISOString();
  const end = new Date(anchor.slice(0, 10) + "T00:00:00Z");
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (HISTORY_MONTHS - 1), 1),
  );

  const where = transactionsFilterQuery({
    ...input,
    direction: undefined,
    dateFrom: start.toISOString().slice(0, 10),
    // Le mois affiché est inclus en entier, même si la borne haute de la
    // recherche tombe en cours de mois.
    dateTo: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0))
      .toISOString()
      .slice(0, 10),
  });

  const month = sql<string>`to_char(${transactions.bookingDate}, 'YYYY-MM')`;
  const parentName = sql<
    string | null
  >`coalesce(${parentCategories.name}, ${categories.name})`;

  const rows = await db
    .select({
      month,
      category: parentName,
      debit: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.direction} = 'debit'), 0)`,
      credit: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.direction} = 'credit'), 0)`,
      count: count(),
    })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(where)
    .groupBy(month, parentName);

  return rows.map((r) => ({
    month: r.month,
    category: r.category,
    debit: Number(r.debit),
    credit: Number(r.credit),
    count: r.count,
  }));
}

export async function listBankLabels(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ bankName: bankLabel })
    .from(accounts)
    .orderBy(asc(bankLabel));
  return rows.map((r) => r.bankName);
}

// Nombre de transactions par banque pour les pastilles de la barre de filtres.
// `bank` est retiré du filtre : sinon sélectionner une banque mettrait les
// autres à zéro et on ne saurait plus vers quoi basculer.
export async function bankCounts(
  input: TransactionsSearch,
): Promise<{ bank: string; count: number }[]> {
  const where = transactionsFilterQuery({ ...input, bank: undefined });
  const rows = await db
    .select({ bank: bankLabel, count: count() })
    .from(transactions)
    .innerJoin(accounts, eq(transactions.accountId, accounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(where)
    .groupBy(bankLabel)
    .orderBy(asc(bankLabel));
  return rows;
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
