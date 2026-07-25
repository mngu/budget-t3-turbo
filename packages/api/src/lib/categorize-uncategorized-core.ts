// Lance la catégorisation LLM des transactions sans catégorie, en utilisant
// uniquement les catégories déjà existantes (pas de proposition de nouvelle
// arborescence — voir suggest-categories-core.ts pour ça). Garde de
// concurrence en mémoire, même pattern que performSync (sync-core.ts).
import type { CategorizeResult } from "../../scripts/categorize";
import { main as runCategorize } from "../../scripts/categorize";

let categorizeInProgress = false;

export async function categorizeUncategorizedCore(): Promise<CategorizeResult> {
  if (categorizeInProgress) {
    throw new Error("Une catégorisation est déjà en cours.");
  }
  categorizeInProgress = true;
  try {
    return await runCategorize();
  } finally {
    categorizeInProgress = false;
  }
}
