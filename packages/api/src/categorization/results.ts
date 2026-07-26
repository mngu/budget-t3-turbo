// Exploitation de la réponse du LLM — pur, testable sans DB ni API.

import { z } from "zod/v4";

import type { SimilarTxn } from "./similar";

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
export function resolveShortcut(similars: SimilarTxn[]): string | null {
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
