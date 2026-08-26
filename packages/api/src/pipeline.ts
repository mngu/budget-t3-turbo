import type { SyncOutcome } from "./banking/fetch-transactions";
import type { CategorizeResult } from "./categorization/run";

import { syncBanks } from "./banking/fetch-transactions";
import { categorizeUncategorized } from "./categorization/run";
import { withSingleFlight } from "./lib/single-flight";
import { importTransactions } from "./transactions/import";

// Un seul verrou pour tout ce qui alimente `transactions` : un import ne doit
// pas s'intercaler dans une synchronisation en cours (et réciproquement).
//
// Par espace : deux foyers écrivent dans des lignes disjointes, un verrou global
// ferait attendre l'un pour l'autre avec un message qu'il n'a pas provoqué.
// Ce que la clé promet n'est vrai que parce que tout ce qu'elle protège est lui
// aussi scopé — `importTransactions` lit le seul répertoire de l'espace.
const withSyncLock = <T>(organizationId: string, run: () => Promise<T>) =>
  withSingleFlight(
    `sync:${organizationId}`,
    "Une synchronisation est déjà en cours.",
    run,
  );

// Import des data/*.json présents, puis catégorisation. La catégorisation est
// best-effort : son échec ne doit jamais invalider un import réussi.
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

// Rejoue l'import des data/*.json déjà présents sans toucher aux sessions
// bancaires — donc sans déclencher de SCA. Remplace l'ancien `pnpm run import`.
// Retourne null si la catégorisation a échoué (l'import, lui, a réussi).
export async function performImport(
  organizationId: string,
): Promise<CategorizeResult | null> {
  return withSyncLock(organizationId, () =>
    importAndCategorize(organizationId),
  );
}
