import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// data/ vit à la racine du monorepo (JSON Enable Banking + credentials EB),
// quel que soit le cwd (pnpm -F exécute depuis packages/api).
//
// La remontée est relative à l'emplacement de CE fichier : hors du monorepo
// (bundle nitro dans une image Docker) elle ne désigne plus la racine mais un
// répertoire quelconque du bundle. Un déploiement pose donc DATA_DIR.
const DATA_DIR =
  process.env.DATA_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", "data");

/**
 * Les JSON d'un espace, dans un sous-répertoire à lui.
 *
 * Cloisonnement de l'import, et pas seulement rangement : `importTransactions`
 * lit *tout* ce qu'il trouve dans le répertoire qu'on lui donne. À plat, un
 * import déclenché par un espace avalerait les fichiers fraîchement
 * synchronisés d'un autre — et le verrou par espace, qui promet que deux
 * espaces ne se marchent pas dessus, deviendrait un mensonge.
 */
export function orgDataDir(organizationId: string): string {
  return resolve(DATA_DIR, organizationId);
}
