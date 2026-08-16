// Lectures et corrections manuelles sur la table des transactions.
import { z } from "zod/v4";

import type { SQL } from "@budget/db";
import type {
  BreakdownByCategories,
  BudgetStats,
  GlobalStats,
  TransactionsSearch,
} from "@budget/shared";
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
  not,
  or,
  sql,
} from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";
import {
  breakdownByCategoriesSchema,
  budgetStatsSchema,
  FALLBACK_CATEGORY_COLOR,
  globalStatsSchema,
  PAGE_SIZE,
  REVIEW_QUEUE_LIMIT,
} from "@budget/shared";

// Nom de banque affiché : display_name choisi par l'utilisateur, sinon nom ASPSP.
const bankLabel = sql<string>`coalesce(${bankAccounts.displayName}, ${bankAccounts.bankName})`;

// Utilisé pour matcher une transaction dont la sous-catégorie appartient
// au parent choisi dans le filtre (categories.tree, 2 niveaux).
const parentCategories = alias(categories, "parent_categories");

// L'autre jambe d'un virement interne, et son compte. Deux jeux d'alias : le
// premier vit dans le `EXISTS` corrélé des filtres, le second dans la jointure
// du relevé. Les confondre ferait déclarer deux fois le même alias dès qu'un
// écran filtre *et* affiche le compte de la jumelle — Postgres le refuse.
const twin = alias(transactions, "transfer_twin");
const twinAccount = alias(bankAccounts, "transfer_twin_account");
const twinBankLabel = sql<string>`coalesce(${twinAccount.displayName}, ${twinAccount.bankName})`;

const listTwin = alias(transactions, "list_transfer_twin");
const listTwinAccount = alias(bankAccounts, "list_transfer_twin_account");
const listTwinBankLabel = sql<string>`coalesce(${listTwinAccount.displayName}, ${listTwinAccount.bankName})`;

// Le filtre de comptes, appliqué à la transaction courante ou à sa jumelle.
// Une liste vide vaut « pas de filtre », comme `undefined` : c'est la lecture
// que fait déjà `selectedBanks` côté client, et le panneau de comptes refuse de
// décocher le dernier — les deux doivent dire la même chose d'une URL bricolée
// à la main.
function bankCondition(
  bank: TransactionsSearch["bank"],
  label: SQL<string>,
): SQL | undefined {
  if (Array.isArray(bank))
    return bank.length > 0 ? inArray(label, bank) : undefined;
  return bank ? eq(label, bank) : undefined;
}

/**
 * « La jumelle de cette transaction est elle aussi dans les comptes affichés. »
 *
 * C'est la règle du périmètre, et elle est le cœur du traitement des virements
 * internes : une paire n'est neutralisée que si ses **deux** jambes sont dans
 * la sélection. Le jumeau hors sélection, la ligne redevient une vraie entrée
 * ou une vraie sortie — parce qu'elle en est vraiment une pour le périmètre
 * regardé. C'est ce qui garantit, quelle que soit la sélection, que le solde
 * affiché égale la variation réelle des comptes affichés ; l'exclure toujours
 * ferait afficher à un compte isolé des sorties sans les entrées qui les ont
 * financées.
 *
 * Deux points à ne pas éroder :
 * — **seul `bank` est ré-appliqué à la jumelle**. Les dates surtout doivent
 *   rester dehors : les paires vont jusqu'à 3 jours d'écart, donc à cheval sur
 *   deux mois. Avec la période dans le périmètre, juillet afficherait −2 000 et
 *   août +2 000 — l'artefact qu'on supprime, déplacé sur la frontière de mois.
 * — la condition reprend le libellé du sélecteur de comptes
 *   (`coalesce(display_name, bank_name)`), pas `account_id` : deux comptes
 *   partageant un libellé sont indissociables dans l'UI, la condition doit dire
 *   la même chose que le filtre.
 */
function twinWithinScope(
  organizationId: string,
  query: TransactionsSearch,
): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(twin)
      .innerJoin(twinAccount, eq(twin.accountId, twinAccount.id))
      .where(
        and(
          eq(twin.id, transactions.transferPairId),
          // Redondant tant que la détection n'apparie que dans un espace, et
          // gardé pour ça : c'est la seule ligne qui rend le périmètre vrai
          // même si une paire inter-espaces apparaissait un jour en base.
          eq(twinAccount.organizationId, organizationId),
          bankCondition(query.bank, twinBankLabel),
        ),
      ),
  );
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
  /** Chemin affiché : « Parent › Enfant », ou « Parent » seul. */
  categoryPath: string | null;
  /** Couleur de la catégorie *parente* : les lignes se lisent par famille. */
  categoryColor: string | null;
  /**
   * Compte de l'autre jambe, quand la transaction est un virement entre deux
   * comptes suivis. `null` sinon.
   */
  transferTwinBank: string | null;
  /**
   * La jumelle est-elle dans les comptes affichés ? Seul ce cas est neutralisé
   * dans les totaux, d'où deux badges distincts : « ⇄ interne » (la ligne ne
   * compte pas) et « ⇄ vers <compte> » (elle compte, la jumelle étant hors
   * périmètre). Calculé ici plutôt que côté client pour que le badge et la
   * mention des tuiles ne puissent pas diverger.
   */
  transferInScope: boolean;
  /** Exclue à la main des agrégats — elle reste dans ce relevé, et là seulement. */
  excluded: boolean;
}

export interface CategoryBreakdownDetail {
  category: string;
  total: number;
  color: string;
  // Vrai pour la seule ligne « À classer », qui n'est pas une catégorie mais
  // le reliquat porté par le parent lui-même. Le client s'en sert pour ne pas
  // poser `category=À classer` en filtre — aucune ligne ne matcherait.
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

function filterTransactions(organizationId: string, query: TransactionsSearch) {
  return sql`
    WITH filtered_transactions AS (
      SELECT t, ba, c, cbp, cbc, p
      FROM transactions t
      LEFT JOIN bank_accounts ba ON t.account_id = ba.id
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN category_budgets cbc ON cbc.category_id = c.id
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN category_budgets cbp ON cbp.category_id = p.id
      WHERE t.booking_date BETWEEN ${query.dateFrom} AND ${query.dateTo}
      AND t.excluded = 'false'
      AND ba.organization_id = ${organizationId}
    )
  `;
}

export async function breakdownByCategories(
  organizationId: string,
  query: TransactionsSearch,
) {
  const result = await db.execute<BreakdownByCategories>(sql`
      ${filterTransactions(organizationId, query)}
      SELECT (p).name AS "parentName", (c).name AS "categoryName", (p).icon AS "parentIcon", (p).color AS "parentColor", (cbc).amount::float8 AS "budgetCatAmount", (cbp).amount::float8 AS "budgetParentAmount", SUM((t).amount)::float8 AS total
      FROM filtered_transactions
      WHERE (t).direction = 'debit'
      GROUP BY (p).name, (c).name, (p).icon, (p).color, (cbc).amount, (cbp).amount
      ORDER BY SUM((t).amount) DESC
    `);
  return z.array(breakdownByCategoriesSchema).parse(result.rows);
}

export async function budgetStats(
  organizationId: string,
  query: TransactionsSearch,
) {
  const result = await db.execute<BudgetStats>(sql`
      ${filterTransactions(organizationId, query)},
      budget_by_cat AS (
        SELECT (p).name, (cbp).amount, SUM((t).amount) AS total
        FROM filtered_transactions
        WHERE (cbp).amount IS NOT NULL
        GROUP BY (p).name, (cbp).amount
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
  // Virements internes. `masquer` et `seulement` sont exactement complémentaires
  // — leur réunion est `toutes` — pour que l'écran d'audit montre ce que les
  // totaux ont écarté, ni plus ni moins.
  if (query.internes === "masquer")
    conditions.push(not(twinWithinScope(organizationId, query)));
  else if (query.internes === "seulement")
    conditions.push(twinWithinScope(organizationId, query));
  if (query.direction)
    conditions.push(eq(transactions.direction, query.direction));
  if (query.status) conditions.push(eq(transactions.status, query.status));
  // « À classer » : la transaction porte une catégorie *parente* qui a par
  // ailleurs des sous-catégories. C'est un prédicat de ligne, sans rapport avec
  // le drapeau `unallocated` de transactionsByCategory qui, lui, est un
  // agrégat. Ne pas confondre non plus avec `category: "none"` (aucune
  // catégorie du tout) : ici la transaction est classée, mais trop grossièrement.
  if (query.aClasser)
    conditions.push(
      sql`${categories.parentId} is null and exists (
        select 1 from ${categories} as a_classer_children
        where a_classer_children.parent_id = ${categories.id}
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

  // Même règle de périmètre que `twinWithinScope`, sur la jumelle jointe : la
  // jointure est déjà là pour afficher son compte, un `EXISTS` de plus serait
  // une seconde formulation de la même condition.
  const twinBankInScope = bankCondition(input.bank, listTwinBankLabel);
  const twinInListScope = sql<boolean>`${listTwin.id} is not null${
    twinBankInScope ? sql` and ${twinBankInScope}` : sql``
  }`;

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
        categoryPath: sql<
          string | null
        >`case when ${parentCategories.name} is null then ${categories.name}
               else ${parentCategories.name} || ' › ' || ${categories.name} end`,
        categoryColor: sql<
          string | null
        >`coalesce(${parentCategories.color}, ${categories.color})`,
        transferTwinBank: listTwinBankLabel,
        transferInScope: twinInListScope,
        excluded: transactions.excluded,
      })
      .from(transactions)
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
      .leftJoin(listTwin, eq(listTwin.id, transactions.transferPairId))
      .leftJoin(listTwinAccount, eq(listTwin.accountId, listTwinAccount.id))
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

// Part du graphique portant un montant rattaché directement à la catégorie
// parente plutôt qu'à l'une de ses sous-catégories.
const A_CLASSER_LABEL = "À classer";

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
  organizationId: string,
  input: TransactionsSearch,
): Promise<CategoryBreakdownItem[]> {
  // Les virements internes sont écartés ici comme dans tous les agrégats, sans
  // consulter le param : une jambe reste catégorisée (`Revenus › Apport …` sur
  // les données réelles) et pèserait sur sa part de l'anneau.
  const where = transactionsFilterQuery(organizationId, {
    ...input,
    internes: "masquer",
  });
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
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
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
  // devient une ligne « À classer » que si la catégorie a par ailleurs des
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
          category: A_CLASSER_LABEL,
          total: group.unallocated,
          color: group.color,
          unallocated: true,
        });
      }
      // Tri du plus gros au plus petit, « À classer » compris : le graphique
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
export type ReviewReason = "sans-categorie" | "a-classer" | "sens-inhabituel";

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
  organizationId: string,
  input: TransactionsSearch,
  limit: number = REVIEW_QUEUE_LIMIT,
): Promise<ReviewItem[]> {
  const parentName = sql<
    string | null
  >`coalesce(${parentCategories.name}, ${categories.name})`;

  // Sens dominant par catégorie parente, sur toute l'historique et sans filtre :
  // c'est une statistique de la catégorie, pas du mois affiché.
  //
  // Seule exception à l'absence de filtre : les jambes de virement interne en
  // sont retirées. Sans périmètre de comptes, ici — la requête n'en a aucun, et
  // une paire est interne quels que soient les comptes affichés. Les garder
  // ferait tenir « Revenus » pour crédit-dominant à cause des apports d'un
  // compte à l'autre, et le motif « sens inhabituel » désignerait alors les
  // mauvaises lignes.
  const stats = await db
    .select({
      category: parentName,
      debit: sql<string>`count(*) filter (where ${transactions.direction} = 'debit')`,
      credit: sql<string>`count(*) filter (where ${transactions.direction} = 'credit')`,
    })
    .from(transactions)
    // Seule statistique de l'écran à ne pas passer par
    // `transactionsFilterQuery` : elle ignore volontairement les filtres. La
    // jointure sur `bank_accounts` n'est donc là que pour l'espace — sans elle, le
    // sens dominant d'une catégorie serait calculé sur les transactions de tous
    // les foyers.
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(parentCategories, eq(categories.parentId, parentCategories.id))
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        isNull(transactions.transferPairId),
      ),
    )
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

  // Un virement interne n'a rien à faire dans une file de relecture : il n'est
  // ni mal classé ni à classer, il ne compte simplement pas.
  const base = transactionsFilterQuery(organizationId, {
    ...input,
    internes: "masquer",
  });
  const oddPairs = [...oddDirection].map(([category, direction]) =>
    and(eq(parentName, category), eq(transactions.direction, direction)),
  );

  const suspect = or(
    isNull(transactions.categoryId),
    sql`${categories.parentId} is null and exists (
      select 1 from ${categories} as a_classer_children
      where a_classer_children.parent_id = ${categories.id}
    )`,
    ...oddPairs,
  );

  // Le « à classer » passe en dernier sous le plafond. Il domine le prédicat en
  // volume (toute transaction rattachée à un parent qui a des enfants) et, s'il
  // est trié au seul montant, il monopolise les `limit` lignes : les « sans
  // catégorie » et les sens inhabituels — les deux seuls motifs qui n'ont pas
  // d'autre écran — tombent alors sous la coupe et ne remontent nulle part.
  // Le « à classer », lui, n'y perd rien : la page « À revoir » le regroupe
  // depuis `listTransactions({ aClasser: true })`, une requête distincte.
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
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
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
          : "a-classer";
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
  organizationId: string,
  input: TransactionsSearch,
): Promise<MonthlyCategoryTotal[]> {
  const anchor = input.dateTo ?? input.dateFrom ?? new Date().toISOString();
  const end = new Date(anchor.slice(0, 10) + "T00:00:00Z");
  const start = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (HISTORY_MONTHS - 1), 1),
  );

  const where = transactionsFilterQuery(organizationId, {
    ...input,
    direction: undefined,
    internes: "masquer",
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
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
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
  // Seul agrégat à *ne pas* écarter les virements internes, et c'est délibéré :
  // il compte des lignes, pas de l'argent, et il annonce ce que la table
  // affichera une fois le compte coché. Les écarter ici mentirait deux fois —
  // son périmètre est « tous les comptes » (`bank` neutralisé, voir ci-dessus)
  // alors que le clic restreindra la sélection, si bien que des paires
  // aujourd'hui neutralisées cesseront de l'être : la pastille annoncerait 2
  // pour une table qui en listerait 3.
  const where = transactionsFilterQuery(
    organizationId,
    { ...input, bank: undefined, internes: "toutes" },
    // Même raison que `internes: "toutes"` ci-dessus : la pastille annonce des
    // lignes, et la table affiche les exclues.
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
  categoryName: string,
): Promise<void> {
  const [match] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.organizationId, organizationId),
        eq(categories.name, categoryName),
      ),
    );
  if (!match) throw new Error(`Catégorie inconnue : ${categoryName}`);

  await db
    .update(transactions)
    .set({ categoryId: match.id, categorySource: "manual" })
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
