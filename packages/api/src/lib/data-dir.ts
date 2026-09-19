import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve independently of cwd. Bundled deployments must set DATA_DIR because
// this module's location no longer reflects the monorepo layout.
const DATA_DIR =
  process.env.DATA_DIR ??
  resolve(dirname(fileURLToPath(import.meta.url)), "../../../..", "data");

// Imports read the entire directory, so files must be isolated by organization.
export function orgDataDir(organizationId: string): string {
  return resolve(DATA_DIR, organizationId);
}
