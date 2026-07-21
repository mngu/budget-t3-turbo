import { syncBanks, type SyncOutcome } from "./eb-sync";
import { main as runImport } from "../../scripts/import";
import { main as runCategorize } from "../../scripts/categorize";

let syncInProgress = false;

export async function performSync(psuHeaders: Record<string, string> = {}): Promise<SyncOutcome> {
  if (syncInProgress) {
    throw new Error("Une synchronisation est déjà en cours.");
  }
  syncInProgress = true;
  try {
    const outcome = await syncBanks(psuHeaders);

    const hadImportError = await runImport();
    if (hadImportError) {
      throw new Error("Échec de l'import (voir les logs serveur).");
    }

    try {
      await runCategorize();
    } catch (err) {
      console.error("⚠️  Catégorisation échouée après la synchronisation :", err);
    }

    return outcome;
  } finally {
    syncInProgress = false;
  }
}
