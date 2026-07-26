import type { CategorizeResult } from "../../scripts/categorize";
import type { SyncOutcome } from "./eb-sync";
import { main as runCategorize } from "../../scripts/categorize";
import { main as runImport } from "../../scripts/import";
import { syncBanks } from "./eb-sync";

// Un seul verrou pour tout ce qui écrit dans `transactions` : un import ne doit
// pas s'intercaler dans une synchronisation en cours (et réciproquement).
let syncInProgress = false;

async function withSyncLock<T>(run: () => Promise<T>): Promise<T> {
  if (syncInProgress) {
    throw new Error("Une synchronisation est déjà en cours.");
  }
  syncInProgress = true;
  try {
    return await run();
  } finally {
    syncInProgress = false;
  }
}

// Import des data/*.json présents, puis catégorisation. La catégorisation est
// best-effort : son échec ne doit jamais invalider un import réussi.
async function importAndCategorize(): Promise<CategorizeResult | null> {
  const hadImportError = await runImport();
  if (hadImportError) {
    throw new Error("Échec de l'import (voir les logs serveur).");
  }

  try {
    return await runCategorize();
  } catch (err) {
    console.error("⚠️  Catégorisation échouée après l'import :", err);
    return null;
  }
}

export async function performSync(
  psuHeaders: Record<string, string> = {},
): Promise<SyncOutcome> {
  return withSyncLock(async () => {
    const outcome = await syncBanks(psuHeaders);
    await importAndCategorize();
    return outcome;
  });
}

// Rejoue l'import des data/*.json déjà présents sans toucher aux sessions
// bancaires — donc sans déclencher de SCA. Remplace l'ancien `pnpm run import`.
// Retourne null si la catégorisation a échoué (l'import, lui, a réussi).
export async function performImport(): Promise<CategorizeResult | null> {
  return withSyncLock(importAndCategorize);
}
