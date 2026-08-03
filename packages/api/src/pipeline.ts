import type { SyncOutcome } from "./banking/fetch-transactions";
import type { CategorizeResult } from "./categorization/run";
import { syncBanks } from "./banking/fetch-transactions";
import { categorizeUncategorized } from "./categorization/run";
import { withSingleFlight } from "./lib/single-flight";
import { importTransactions } from "./transactions/import";
import { detectInternalTransfers } from "./transactions/internal-transfers";

// Un seul verrou pour tout ce qui alimente `transactions` : un import ne doit
// pas s'intercaler dans une synchronisation en cours (et réciproquement).
const withSyncLock = <T>(run: () => Promise<T>) =>
  withSingleFlight("sync", "Une synchronisation est déjà en cours.", run);

// Import des data/*.json présents, appariement des virements internes, puis
// catégorisation. Les deux dernières étapes sont best-effort : leur échec ne
// doit jamais invalider un import réussi.
async function importAndCategorize(): Promise<CategorizeResult | null> {
  const hadImportError = await importTransactions();
  if (hadImportError) {
    throw new Error("Échec de l'import (voir les logs serveur).");
  }

  // Repasse sur *toute* la table, pas seulement sur les lignes importées à
  // l'instant : la moyenne de référence de la revue porte sur 12 mois, et
  // n'apparier que les nouveautés comparerait un mois propre à des mois passés
  // gonflés. Idempotente, elle ne coûte qu'une lecture de la table.
  try {
    const { pairs } = await detectInternalTransfers();
    console.log(`🔁 ${pairs} virement(s) interne(s) apparié(s).`);
  } catch (err) {
    console.error("⚠️  Détection des virements internes échouée :", err);
  }

  try {
    return await categorizeUncategorized();
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
