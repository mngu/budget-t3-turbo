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
  not,
  or,
  sql,
} from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";

import type {
  Breakdown,
  BudgetStats,
  GlobalStats,
  TransactionsSearch,
} from "./schemas";
import {
  breakdownSchema,
  budgetStatsSchema,
  globalStatsSchema,
  PAGE_SIZE,
} from "./schemas";

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

// Le filtre de comptes, en SQL brut : `twinWithinScope` et `bankCondition`
// s'écrivent sur les tables Drizzle non aliasées, ils ne peuvent pas se corréler
// aux alias `t` / `ba` de la CTE ci-dessous. Le libellé reste celui du sélecteur
// de comptes (`coalesce(display_name, bank_name)`), jamais `account_id` : deux
// comptes partageant un libellé sont indissociables dans l'UI.
function bankFilter(bank: TransactionsSearch["bank"], table: "ba" | "twa") {
  const banks = Array.isArray(bank) ? bank : bank ? [bank] : [];
  // Une liste vide vaut « tous les comptes », comme `undefined` — même lecture
  // que `selectedBanks` côté client.
  if (banks.length === 0) return sql``;
  const label = sql.raw(`coalesce(${table}.display_name, ${table}.bank_name)`);
  return sql` AND ${inArray(label, banks)}`;
}

/**
 * Le périmètre des agrégats de la revue : la période, les comptes affichés, ni
 * les lignes exclues à la main, ni les virements internes.
 *
 * Ces derniers sortent **en dur**, sans consulter le param `internes` (qui ne
 * gouverne que le relevé), et selon la règle de `twinWithinScope` : une paire
 * n'est neutralisée que si ses **deux** jambes sont dans les comptes affichés —
 * la jumelle hors sélection, la ligne redevient une vraie sortie, parce qu'elle
 * en est vraiment une pour le périmètre regardé. Seul `bank` est ré-appliqué à
 * la jumelle : les paires vont jusqu'à 3 jours d'écart, donc à cheval sur deux
 * mois, et mettre les dates dans le périmètre déplacerait l'artefact sur la
 * frontière de mois au lieu de le supprimer.
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
      ${bankFilter(query.bank, "ba")}
      AND NOT EXISTS (
        SELECT 1 FROM transactions tw
        JOIN bank_accounts twa ON tw.account_id = twa.id
        WHERE tw.id = t.transfer_pair_id
        AND twa.organization_id = ${organizationId}
        ${bankFilter(query.bank, "twa")}
      )
    )
  `;
}

// Une catégorie **racine** (sans parent) est son propre poste : c'est elle qui
// en porte le nom, l'icône, la couleur et le budget. Sans ce repli, un
// `GROUP BY (p).name` rassemble toutes les racines — et les transactions sans
// catégorie du tout — dans un seul seau `null`.
const parentName = sql`COALESCE((p).name, (c).name)`;
const parentIcon = sql`COALESCE((p).icon, (c).icon)`;
const parentColor = sql`COALESCE((p).color, (c).color)`;
// …et son budget est le sien. Un `COALESCE((p).budget_amount,
// (c).budget_amount)` serait faux ici : sous une parente **sans** budget, il
// ferait passer celui d'une sous-catégorie pour le budget du poste.
const parentBudget = sql`CASE WHEN (p).name IS NULL THEN (c).budget_amount ELSE (p).budget_amount END`;

// Position d'une ligne dans l'arborescence, **établie** par Postgres plutôt que
// déduite d'une comparaison de noms. `COALESCE((p).name, (c).name)` rend quatre
// situations indiscernables — une sous-catégorie, le reliquat d'une parente qui
// a des enfants, une racine qui n'en a pas, et une transaction sans catégorie :
// les trois dernières produisent toutes une ligne dont les deux noms sont
// égaux. `parent_id` et l'existence d'enfants les séparent sans ambiguïté.
const nodeKind = sql`CASE
        WHEN (c).id IS NULL THEN 'none'
        WHEN (p).id IS NOT NULL THEN 'sub'
        WHEN EXISTS (SELECT 1 FROM categories child WHERE child.parent_id = (c).id)
          THEN 'unallocated'
        ELSE 'parent'
      END`;

/**
 * La répartition des sorties : l'arbre entier, groupé, trié et totalisé par
 * Postgres. **Seule** source du niveau affiché par la revue — l'anneau, la
 * colonne des postes, l'en-tête et le forage en sortent tous, et c'est ce qui
 * les empêche de se contredire.
 *
 * Le sens `debit` est forcé côté SQL, comme la maquette : sans lui un seul mois
 * de salaires écrase l'échelle et tous les postes de dépense s'affaissent à un
 * moignon indistinct (mesuré : `Revenus` à 4 000 € contre 99 € pour le plus
 * gros poste de sortie).
 *
 * Trois choses descendent ici et ne doivent pas remonter côté app :
 * — le **tri** des enfants, parce que `shadeCategoryColor` dérive la nuance
 *   d'un segment de son rang : le rang est donc de la donnée, pas de la mise en
 *   forme ;
 * — `expenses` et `postes`, que l'en-tête affiche et qu'il recompterait sinon —
 *   deux définitions du même chiffre finissent par diverger ;
 * — `kind`, voir `nodeKind` ci-dessus.
 *
 * Ce qui **reste** côté app : les libellés français, les sentinelles d'URL et
 * le choix du niveau ouvert (`-lib/breakdown.ts`).
 */
export async function breakdownByCategories(
  organizationId: string,
  query: TransactionsSearch,
): Promise<Breakdown> {
  const result = await db.execute(sql`
      ${filterTransactions(organizationId, query)},
      leaves AS (
        SELECT
          COALESCE((p).id, (c).id) AS poste_id,
          ${parentName} AS poste_name,
          ${parentIcon} AS poste_icon,
          ${parentColor} AS poste_color,
          ${parentBudget} AS poste_budget,
          (c).name AS child_name,
          (c).budget_amount AS child_budget,
          ${nodeKind} AS child_kind,
          SUM((t).amount) AS total
        FROM filtered_transactions
        WHERE (t).direction = 'debit'
        -- Par ordinaux : les colonnes 1 à 8 sont des expressions, les répéter
        -- ici laisserait deux définitions du même poste diverger.
        GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
      ),
      postes AS (
        SELECT
          poste_name AS name,
          CASE WHEN poste_id IS NULL THEN 'none' ELSE 'parent' END AS kind,
          poste_icon AS icon,
          poste_color AS color,
          poste_budget::float8 AS budget,
          SUM(total)::float8 AS total,
          -- Une racine sans sous-catégorie ne produit que des lignes 'parent' :
          -- le FILTER lui laisse un tableau vide, et c'est ce vide qui dit à
          -- l'app qu'elle n'ouvre aucun niveau. Le reliquat, lui, est un enfant
          -- comme un autre — il a cessé d'être une alerte, il reste une part,
          -- sans quoi la somme du niveau ouvert n'égalerait plus son poste.
          COALESCE(
            json_agg(
              json_build_object(
                'name', child_name,
                'kind', child_kind,
                'total', total::float8,
                'budget', child_budget::float8
              ) ORDER BY total DESC
            ) FILTER (WHERE child_kind IN ('sub', 'unallocated')),
            '[]'::json
          ) AS children
        FROM leaves
        GROUP BY poste_id, poste_name, poste_icon, poste_color, poste_budget
      )
      SELECT
        COALESCE(SUM(total), 0)::float8 AS expenses,
        COUNT(*)::int AS postes,
        COALESCE(json_agg(to_jsonb(postes) ORDER BY total DESC), '[]'::json)
          AS parents
      FROM postes
    `);
  // Le SELECT final n'est qu'agrégats, sans GROUP BY : il rend toujours une
  // ligne, y compris sur une période vide.
  return breakdownSchema.parse(result.rows[0]);
}

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
