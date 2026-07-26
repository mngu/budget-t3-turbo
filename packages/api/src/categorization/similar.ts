// Recherche de transactions déjà catégorisées similaires à une transaction donnée,
// pour enrichir le prompt de catégorisation par des exemples concrets (few-shot).
import type { Transaction } from "@budget/db/schema";
import { and, desc, eq, isNotNull, ne, or, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { categories, transactions } from "@budget/db/schema";

import type { TxnForLlm } from "./prompt";

export interface SimilarTxn {
  id: number;
  description: string;
  counterparty: string | null;
  amount: string;
  direction: Transaction["direction"];
  categoryName: string;
  categorySource: Transaction["categorySource"];
}

export const SIMILAR_LIMIT = 5;
// Seuil pg_trgm en dessous duquel deux descriptions ne sont pas jugées similaires.
const TRIGRAM_THRESHOLD = 0.3;

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
const manualFirst = desc(
  sql`case when ${transactions.categorySource} = 'manual' then 1 else 0 end`,
);

async function byCounterparty(
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  if (!txn.counterparty) return [];
  return db
    .select(similarColumns)
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.counterparty, txn.counterparty),
        isNotNull(transactions.categoryId),
        ne(transactions.id, txn.id),
      ),
    )
    .orderBy(manualFirst, desc(transactions.bookingDate))
    .limit(limit);
}

async function byDescriptionTrigram(
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  const similarity = sql<number>`similarity(${transactions.description}, ${txn.description})`;
  return db
    .select(similarColumns)
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        isNotNull(transactions.categoryId),
        ne(transactions.id, txn.id),
        sql`${similarity} > ${TRIGRAM_THRESHOLD}`,
      ),
    )
    .orderBy(manualFirst, desc(similarity))
    .limit(limit);
}

async function byBankCodeOrMcc(
  txn: TxnForLlm,
  limit: number,
): Promise<SimilarTxn[]> {
  if (!txn.bankCode && !txn.mcc) return [];
  return db
    .select(similarColumns)
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        isNotNull(transactions.categoryId),
        ne(transactions.id, txn.id),
        or(
          txn.bankCode ? eq(transactions.bankCode, txn.bankCode) : undefined,
          txn.mcc ? eq(transactions.mcc, txn.mcc) : undefined,
        ),
      ),
    )
    .orderBy(manualFirst, desc(transactions.bookingDate))
    .limit(limit);
}

// Fusionne les candidats des différents niveaux de similarité (contrepartie exacte
// > trigrammes sur la description > bank_code/MCC en dernier recours), dédoublonne
// par id (le niveau le plus prioritaire gagne) et plafonne à `limit`.
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
// triées par pertinence décroissante.
export async function findSimilar(
  txn: TxnForLlm,
  limit = SIMILAR_LIMIT,
): Promise<SimilarTxn[]> {
  const [exact, trigram, fallback] = await Promise.all([
    byCounterparty(txn, limit),
    byDescriptionTrigram(txn, limit),
    byBankCodeOrMcc(txn, limit),
  ]);
  return mergeSimilarCandidates([exact, trigram, fallback], limit);
}
