import type { TxnForLlm } from "./prompt";
// Recherche de transactions déjà catégorisées similaires à une transaction donnée,
// pour enrichir le prompt de catégorisation par des exemples concrets (few-shot).
import type { Transaction } from "@budget/db/schema";

import { and, desc, eq, isNotNull, ne, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { bankAccounts, categories, transactions } from "@budget/db/schema";

export interface SimilarTxn {
  id: number;
  description: string;
  counterparty: string | null;
  amount: string;
  direction: Transaction["direction"];
  categoryName: string;
  categorySource: Transaction["categorySource"];
}

const SIMILAR_LIMIT = 5;
// Seuil pg_trgm en dessous duquel deux descriptions ne sont pas jugées similaires.
//
// Calibration : sur les données réelles, deux transactions au hasard partagent
// la même catégorie parente dans 14,9 % des cas. Les paires admises par un seuil
// à 0,30 font à peine mieux (19,1 % entre 0,30 et 0,40), parce que le format de
// libellé des banques est dominé par du boilerplate — « CB Spotify P435865 FACT
// 090626 » et « CB PAUL            FACT 280526 » atteignent 0,38 sur les seuls
// `CB `, ` FACT `, le padding et les chiffres de date. L'accord ne dépasse le
// hasard de façon nette qu'à partir de 0,5 (49,8 %), puis franchement au-delà de
// 0,6 (67 %+). Le tri décroissant + `limit` enterrait déjà ces paires bruitées
// la plupart du temps ; le seuil protège le cas où une transaction a trop peu de
// candidats pour que la queue reste invisible.
const TRIGRAM_THRESHOLD = 0.5;

// `bank_code` est un code de type d'opération propre à chaque banque, pas une
// nature de dépense : sa valeur d'indice varie énormément d'un code à l'autre.
// Mesuré sur les données réelles, `TOPUP` ou `06` désignent une seule catégorie
// parente, tandis que `CARD_PAYMENT` (171 transactions) en couvre 11 et `C2`
// (« virement reçu » chez SG) mélange remboursements, loyer et virements
// internes — c'est ce dernier qui poussait des virements entrants vers
// « Transferts personnels ». On ne s'en sert donc que pour les codes dont la
// pureté est vérifiée dans les données, jamais sur une liste codée en dur (les
// codes sont spécifiques à chaque banque et pourriraient au premier ajout).
//
// Calibration : « au moins 10 observations dont au plus une aberrante ». Une
// première tentative à 5 observations / 80 % laissait passer `C2` — 4 virements
// dans « Remboursements & Transferts » et 1 loyer, soit exactement 0,80 — qui
// continuait donc à montrer un exemple « Loyer » à un virement entrant. Sur un
// échantillon de 5, une proportion de 80 % ne veut rien dire ; il faut à la
// fois assez d'observations et une quasi-unanimité.
const BANK_CODE_MIN_SAMPLES = 10;
const BANK_CODE_MIN_DOMINANCE = 0.9;

export interface BankCodeParentCount {
  bankCode: string;
  parentId: number;
  count: number;
}

// Garde les codes dont la catégorie parente dominante représente au moins
// `minDominance` des transactions déjà catégorisées, sur au moins
// `minSamples` observations. Pur : testable sans base.
export function selectDiscriminativeBankCodes(
  rows: BankCodeParentCount[],
  minSamples = BANK_CODE_MIN_SAMPLES,
  minDominance = BANK_CODE_MIN_DOMINANCE,
): Set<string> {
  const totals = new Map<string, { total: number; top: number }>();
  for (const { bankCode, count } of rows) {
    const entry = totals.get(bankCode) ?? { total: 0, top: 0 };
    entry.total += count;
    entry.top = Math.max(entry.top, count);
    totals.set(bankCode, entry);
  }

  const kept = new Set<string>();
  for (const [bankCode, { total, top }] of totals) {
    if (total >= minSamples && top / total >= minDominance) kept.add(bankCode);
  }
  return kept;
}

// Une seule requête par run de catégorisation (et non par transaction) :
// la pureté ne dépend pas de la transaction qu'on cherche à classer.
export async function loadDiscriminativeBankCodes(
  organizationId: string,
): Promise<Set<string>> {
  const rows = await db
    .select({
      bankCode: transactions.bankCode,
      parentId: sql<number>`coalesce(${categories.parentId}, ${categories.id})`,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    // Le périmètre du few-shot est l'espace : un exemple venu d'un autre foyer
    // serait à la fois une fuite et un mauvais indice.
    .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        isNotNull(transactions.bankCode),
      ),
    )
    .groupBy(
      transactions.bankCode,
      sql`coalesce(${categories.parentId}, ${categories.id})`,
    );

  return selectDiscriminativeBankCodes(
    rows.filter((r): r is BankCodeParentCount => r.bankCode !== null),
  );
}

const similarColumns = {
  id: transactions.id,
  description: transactions.description,
  counterparty: transactions.counterparty,
  amount: transactions.amount,
  direction: transactions.direction,
  categoryName: categories.name,
  categorySource: transactions.categorySource,
};

// Priorité aux corrections manuelles au sein d'un même niveau de similarité.
// Les tiers contrepartie/MCC/bank_code n'ont pas de score : leurs candidats sont
// tous également similaires, la priorité manuelle y est donc le premier critère.
// Le tier trigramme, lui, est ordonné par bande de similarité d'abord (voir
// byDescriptionTrigram) — « au sein d'un même niveau » y a un sens littéral.
const manualFirst = desc(
  sql`case when ${transactions.categorySource} = 'manual' then 1 else 0 end`,
);

async function byCounterparty(
  organizationId: string,
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  if (!txn.counterparty) return [];
  return (
    db
      .select(similarColumns)
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      // Le périmètre du few-shot est l'espace : un exemple venu d'un autre foyer
      // serait à la fois une fuite et un mauvais indice.
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          eq(transactions.counterparty, txn.counterparty),
          isNotNull(transactions.categoryId),
          ne(transactions.id, txn.id),
        ),
      )
      .orderBy(manualFirst, desc(transactions.bookingDate))
      .limit(limit)
  );
}

// La similarité est le critère principal, la priorité manuelle ne départage
// qu'à l'intérieur d'une bande (arrondi à 0,1). Mettre `manualFirst` en premier
// laissait une correction manuelle à 0,51 passer devant un quasi-doublon à
// 0,95 : mesuré sur les données réelles, le meilleur exemple injecté dans le
// prompt tombait à 69,5 % de bonne catégorie parente contre 91,4 % en triant
// par similarité. L'intention d'origine — préférer un exemple validé par un
// humain — est conservée, mais entre candidats comparablement similaires.
async function byDescriptionTrigram(
  organizationId: string,
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  const similarity = sql<number>`similarity(${transactions.description}, ${txn.description})`;
  return (
    db
      .select(similarColumns)
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      // Le périmètre du few-shot est l'espace : un exemple venu d'un autre foyer
      // serait à la fois une fuite et un mauvais indice.
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          isNotNull(transactions.categoryId),
          ne(transactions.id, txn.id),
          sql`${similarity} > ${TRIGRAM_THRESHOLD}`,
        ),
      )
      .orderBy(
        desc(sql`round(${similarity}::numeric, 1)`),
        manualFirst,
        desc(similarity),
      )
      .limit(limit)
  );
}

// Le MCC (merchant category code) est une nature de commerce, donc un indice
// sémantique fort — aucun filtre de pureté nécessaire. Attention : Enable
// Banking ne le renseigne pour aucune des trois banques du projet (la clé est
// présente dans `raw` mais toujours nulle), ce tier ne remonte donc jamais rien
// aujourd'hui. Conservé pour l'ajout éventuel d'un établissement qui l'expose.
async function byMcc(
  organizationId: string,
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  if (!txn.mcc) return [];
  return (
    db
      .select(similarColumns)
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      // Le périmètre du few-shot est l'espace : un exemple venu d'un autre foyer
      // serait à la fois une fuite et un mauvais indice.
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          isNotNull(transactions.categoryId),
          ne(transactions.id, txn.id),
          eq(transactions.mcc, txn.mcc),
        ),
      )
      .orderBy(manualFirst, desc(transactions.bookingDate))
      .limit(limit)
  );
}

// Dernier recours, et uniquement pour les codes dont la pureté a été vérifiée
// (voir selectDiscriminativeBankCodes) : sur un code fourre-tout, ce tier
// fabrique des exemples qui contredisent la transaction à classer.
async function byBankCode(
  organizationId: string,
  txn: TxnForLlm,
  limit: number,
  discriminativeBankCodes: Set<string>,
): Promise<SimilarTxn[]> {
  if (!txn.bankCode || !discriminativeBankCodes.has(txn.bankCode)) return [];
  return (
    db
      .select(similarColumns)
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      // Le périmètre du few-shot est l'espace : un exemple venu d'un autre foyer
      // serait à la fois une fuite et un mauvais indice.
      .innerJoin(bankAccounts, eq(transactions.accountId, bankAccounts.id))
      .where(
        and(
          eq(bankAccounts.organizationId, organizationId),
          isNotNull(transactions.categoryId),
          ne(transactions.id, txn.id),
          eq(transactions.bankCode, txn.bankCode),
        ),
      )
      .orderBy(manualFirst, desc(transactions.bookingDate))
      .limit(limit)
  );
}

// Fusionne les candidats des différents niveaux de similarité (contrepartie
// exacte > trigrammes sur la description > MCC > bank_code discriminant en
// dernier recours), dédoublonne par id (le niveau le plus prioritaire gagne)
// et plafonne à `limit`.
export function mergeSimilarCandidates(
  tiers: SimilarTxn[][],
  limit = SIMILAR_LIMIT,
): SimilarTxn[] {
  const seen = new Set<number>();
  const merged: SimilarTxn[] = [];
  for (const tier of tiers) {
    for (const candidate of tier) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      merged.push(candidate);
      if (merged.length >= limit) return merged;
    }
  }
  return merged;
}

// Transactions déjà catégorisées les plus proches de `txn` (hors elle-même),
// triées par pertinence décroissante. `discriminativeBankCodes` vient de
// loadDiscriminativeBankCodes(), calculé une fois par run : le passer
// explicitement évite une requête de pureté par transaction, et un appelant qui
// l'omettrait n'obtiendrait jamais d'exemples issus d'un code fourre-tout.
export async function findSimilar(
  organizationId: string,
  txn: TxnForLlm,
  discriminativeBankCodes = new Set<string>(),
  limit = SIMILAR_LIMIT,
): Promise<SimilarTxn[]> {
  const [exact, trigram, mcc, bankCode] = await Promise.all([
    byCounterparty(organizationId, txn, limit),
    byDescriptionTrigram(organizationId, txn, limit),
    byMcc(organizationId, txn, limit),
    byBankCode(organizationId, txn, limit, discriminativeBankCodes),
  ]);
  return mergeSimilarCandidates([exact, trigram, mcc, bankCode], limit);
}
