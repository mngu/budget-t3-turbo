// État du dernier run d'analyse. En mémoire process — pas de table dédiée pour
// ce MVP mono-utilisateur : l'état se perd au redémarrage du serveur, il suffit
// de relancer l'analyse.
import { count } from "@budget/db";
import { db } from "@budget/db/client";
import { transactions } from "@budget/db/schema";

import type { TxnForAnalysis } from "./analyze";
import type { CategorySuggestion } from "./schema";
import { listCategoryTree } from "../queries";
import { analyzeAndSuggest, sampleTransactions } from "./analyze";

export interface SuggestionsRun {
  generatedAt: Date;
  totalTransactionsAtRun: number;
  suggestions: CategorySuggestion[];
  // Échantillon analysé, conservé pour que l'UI résolve txnIds → transactions
  // (compteurs, drawer de prévisualisation) sans re-catégoriser au préalable.
  sample: TxnForAnalysis[];
}

let lastRun: SuggestionsRun | null = null;

async function transactionsTotal(): Promise<number> {
  const [row] = await db.select({ total: count() }).from(transactions);
  return row?.total ?? 0;
}

export async function generateSuggestions(): Promise<SuggestionsRun> {
  // L'arborescence réelle part avec l'échantillon : sans elle, le LLM invente
  // des variantes des noms existants (voir buildAnalysisPrompt).
  const [sample, tree] = await Promise.all([
    sampleTransactions(),
    listCategoryTree(),
  ]);
  const suggestions = await analyzeAndSuggest(sample, tree);
  const totalTransactionsAtRun = await transactionsTotal();
  lastRun = {
    generatedAt: new Date(),
    totalTransactionsAtRun,
    suggestions,
    sample,
  };
  return lastRun;
}

export interface SuggestionsStatus {
  exists: boolean;
  generatedAt: Date | null;
  newTransactionsCount: number;
  suggestions: CategorySuggestion[] | null;
  sample: TxnForAnalysis[] | null;
}

export async function getSuggestionsStatus(): Promise<SuggestionsStatus> {
  if (!lastRun) {
    return {
      exists: false,
      generatedAt: null,
      newTransactionsCount: 0,
      suggestions: null,
      sample: null,
    };
  }
  const total = await transactionsTotal();
  return {
    exists: true,
    generatedAt: lastRun.generatedAt,
    newTransactionsCount: Math.max(0, total - lastRun.totalTransactionsAtRun),
    suggestions: lastRun.suggestions,
    sample: lastRun.sample,
  };
}
