import type { SyncOutcome } from "./banking/fetch-transactions";
import type { CategorizeResult } from "./categorization/run";
import { syncBanks } from "./banking/fetch-transactions";
import { categorizeUncategorized } from "./categorization/run";
import { withSingleFlight } from "./lib/single-flight";
import { importTransactions } from "./transactions/import";
import { detectInternalTransfers } from "./transactions/internal-transfers";

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

// Import des data/*.json présents, appariement des virements internes, puis
// catégorisation. Les deux dernières étapes sont best-effort : leur échec ne
// doit jamais invalider un import réussi.
async function importAndCategorize(
  organizationId: string,
): Promise<CategorizeResult | null> {
  const hadImportError = await importTransactions(organizationId);
  if (hadImportError) {
    throw new Error("Échec de l'import (voir les logs serveur).");
  }

  // Repasse sur *toute* la table, pas seulement sur les lignes importées à
  // l'instant : la moyenne de référence de la revue porte sur 12 mois, et
  // n'apparier que les nouveautés comparerait un mois propre à des mois passés
  // gonflés. Idempotente, elle ne coûte qu'une lecture de la table.
  try {
    const { pairs } = await detectInternalTransfers(organizationId);
    console.log(`🔁 ${pairs} virement(s) interne(s) apparié(s).`);
  } catch (err) {
    console.error("⚠️  Détection des virements internes échouée :", err);
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
