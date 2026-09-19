import type { SyncOutcome } from "./banking/fetch-transactions";
import type { CategorizeResult } from "./categorization";

import { syncBanks } from "./banking/fetch-transactions";
import { categorizeUncategorized } from "./categorization";
import { withSingleFlight } from "./lib/single-flight";
import { importTransactions } from "./transactions/import";

// Sync and import share a per-space lock because they write the same transactions.
const withSyncLock = <T>(organizationId: string, run: () => Promise<T>) =>
  withSingleFlight(
    `sync:${organizationId}`,
    "Une synchronisation est déjà en cours.",
    run,
  );

// Categorization is best-effort: its failure must not invalidate a successful import.
async function importAndCategorize(
  organizationId: string,
): Promise<CategorizeResult | null> {
  const hadImportError = await importTransactions(organizationId);
  if (hadImportError) {
    throw new Error("Échec de l'import (voir les logs serveur).");
  }

  try {
    return await categorizeUncategorized(organizationId);
  } catch (err) {
    console.error("⚠️  Catégorisation échouée après l'import :", err);
    return null;
  }
}

export async function performSync(
  organizationId: string,
  psuHeaders: Record<string, string> = {},
): Promise<SyncOutcome> {
  return withSyncLock(organizationId, async () => {
    const outcome = await syncBanks(organizationId, psuHeaders);
    await importAndCategorize(organizationId);
    return outcome;
  });
}

// Replay stored files without bank calls or strong authentication.
export async function performImport(
  organizationId: string,
): Promise<CategorizeResult | null> {
  return withSyncLock(organizationId, () =>
    importAndCategorize(organizationId),
  );
}
