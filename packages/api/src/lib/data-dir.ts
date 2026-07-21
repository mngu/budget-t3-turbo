import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// data/ vit à la racine du monorepo (JSON Enable Banking + credentials EB),
// quel que soit le cwd (pnpm -F exécute depuis packages/api).
export const DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
  "data",
);
