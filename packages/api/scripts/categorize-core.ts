// Logique pure de catégorisation — testable sans DB ni API.

import { z } from "zod/v4";

import type { SimilarTxn } from "../src/lib/similar-transactions";

export interface TxnForLlm {
  id: number;
  description: string;
  counterparty: string | null;
  direction: "debit" | "credit";
  amount: string;
  currency: string;
  bankName: string;
  bankCode: string | null;
  mcc: string | null;
}

export const BATCH_SIZE = 50;
// Lot plus petit pour la catégorisation few-shot : chaque transaction embarque
// ses propres exemples similaires, le prompt est donc bien plus volumineux par lot.
export const FEW_SHOT_BATCH_SIZE = 10;

export function chunkTransactions<T>(items: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Le prompt ne s'appuie QUE sur les catégories réellement présentes en base :
// aucun nom de catégorie codé en dur ici (une règle citant une catégorie
// absente de la liste faisait répondre le LLM hors liste, et la transaction
// n'était jamais catégorisée). Combler les trous de l'arborescence est le rôle
// du process de suggestion (suggest-categories-core.ts) — attention, son
// échantillon est celui des transactions récentes, catégorisées ou non
// (sampleTransactions ne filtre que sur bookingDate) : les transactions
// laissées sans catégorie y figurent sans être priorisées.
export function buildSystemPrompt(categoryNames: string[]): string {
  return `Tu catégorises des transactions bancaires personnelles pour le budget d'un ménage français.
Les comptes appartiennent à Alex Martin et Camille Durand (banques : Société Générale, Caisse d'Épargne Île-de-France, Revolut).

Pour chaque transaction, choisis une catégorie parmi cette liste, et uniquement parmi celle-ci :
${categoryNames.map((c) => `- ${c}`).join("\n")}

Règles :
- N'invente jamais de catégorie : toute réponse hors de cette liste est ignorée.
- Les transactions similaires fournies sont des indices, pas une autorité. Ne classe par analogie que si la transaction est réellement de même nature (même contrepartie, même type d'opération) : des libellés qui se ressemblent ne suffisent pas.
- Une catégorie « à peu près » n'est pas une bonne réponse. Si la transaction relève d'un type de dépense ou de revenu absent de la liste, réponds null.
- La liste est incomplète par construction : répondre null est un résultat normal et utile. Ces transactions sont reprises par l'analyse qui propose de nouvelles catégories.

Réponds pour chaque transaction avec son id et sa catégorie (ou null).`;
}

export function buildUserMessage(batch: TxnForLlm[]): string {
  return JSON.stringify(batch);
}

function formatSimilarTxn(s: SimilarTxn): string {
  const signe = s.direction === "debit" ? "-" : "+";
  const contrepartie = s.counterparty ? ` (${s.counterparty})` : "";
  return `- "${s.description}"${contrepartie}, ${signe}${s.amount} → ${s.categoryName}`;
}

// Prompt par transaction pour la catégorisation few-shot : injecte les
// transactions similaires déjà catégorisées comme exemples, ou retombe
// silencieusement sur le prompt générique si aucune n'a été trouvée.
export function buildFewShotPrompt(
  transaction: TxnForLlm,
  similars: SimilarTxn[],
): string {
  const similarSection =
    similars.length > 0
      ? `Transactions similaires déjà catégorisées :\n${similars.map(formatSimilarTxn).join("\n")}\n\n`
      : "";
  return `${similarSection}Nouvelle transaction à catégoriser :\n${JSON.stringify(transaction)}`;
}

// Message utilisateur pour un micro-lot few-shot : un bloc par transaction,
// chacun avec ses propres exemples similaires.
export function buildFewShotUserMessage(
  batch: TxnForLlm[],
  similarsByTxnId: Map<number, SimilarTxn[]>,
): string {
  return batch
    .map((txn) => buildFewShotPrompt(txn, similarsByTxnId.get(txn.id) ?? []))
    .join("\n\n---\n\n");
}

// Ne valide que la forme (id + categorie) : un z.enum(categoryNames) ferait
// planter le parsing structured-output de tout le lot dès qu'une réponse cite
// une catégorie hors liste, au lieu d'ignorer juste cette transaction.
// Le tri réel se fait dans partitionResults, après un parsing qui ne peut plus
// échouer pour cette raison. `categorie: null` est la réponse légitime quand
// aucune catégorie existante ne convient — sans cette échappatoire, le LLM est
// contraint d'inventer un nom, qui serait rejeté silencieusement.
export function buildCategorizationOutputSchema() {
  return z.object({
    resultats: z.array(
      z.object({
        id: z.number().int(),
        categorie: z.string().nullable(),
      }),
    ),
  });
}

// Court-circuit déterministe : si au moins 2 transactions similaires partagent
// la même contrepartie ET la même catégorie, on peut appliquer directement
// sans appeler le LLM. Retourne le nom de la catégorie ou null.
export function resolveShortcut(
  similars: SimilarTxn[],
): string | null {
  const byCounterparty = new Map<string, Map<string, number>>();
  for (const s of similars) {
    if (!s.counterparty) continue;
    let catCounts = byCounterparty.get(s.counterparty);
    if (!catCounts) {
      catCounts = new Map();
      byCounterparty.set(s.counterparty, catCounts);
    }
    catCounts.set(s.categoryName, (catCounts.get(s.categoryName) ?? 0) + 1);
  }
  for (const [, catCounts] of byCounterparty) {
    for (const [catName, count] of catCounts) {
      if (count >= 2) return catName;
    }
  }
  return null;
}

export interface ResultsPartition {
  // Catégorisations applicables telles quelles.
  valid: { id: number; categorie: string }[];
  // Refus assumés (`categorie: null`) : aucune catégorie existante ne convient.
  // Attendu, pas une anomalie — ces transactions restent sans catégorie et
  // alimentent le process de suggestion.
  declined: number[];
  // Réponses aberrantes : id hors lot ou catégorie inconnue en base. Signal de
  // bug (prompt désaligné, hallucination) — à remonter, pas à avaler en silence.
  rejected: { id: number; categorie: string | null }[];
}

// Défense en profondeur derrière les structured outputs : rien qui ne soit pas
// une catégorie connue du lot courant n'atteint la base. Les deux raisons de ne
// pas catégoriser sont séparées — les confondre est précisément ce qui rendait
// le désalignement prompt/base invisible.
export function partitionResults(
  resultats: { id: number; categorie: string | null }[],
  batchIds: Set<number>,
  categoryNames: string[],
): ResultsPartition {
  const partition: ResultsPartition = {
    valid: [],
    declined: [],
    rejected: [],
  };
  for (const r of resultats) {
    if (!batchIds.has(r.id)) {
      partition.rejected.push(r);
    } else if (r.categorie === null) {
      partition.declined.push(r.id);
    } else if (categoryNames.includes(r.categorie)) {
      partition.valid.push({ id: r.id, categorie: r.categorie });
    } else {
      partition.rejected.push(r);
    }
  }
  return partition;
}
