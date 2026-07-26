import { defineConfig } from "eslint/config";

import { baseConfig } from "@budget/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  {
    // Code porté iso-fonctionnel depuis budget-tracker (ebApi non typé) — ne pas
    // durcir sans refactor dédié. Fichiers nommés un par un, jamais un glob de
    // dossier : l'exception ne doit couvrir que le code qui manipule les
    // réponses brutes d'Enable Banking, pas tout ce qui viendra s'ajouter à
    // côté (une requête Drizzle n'a aucune raison d'échapper aux règles).
    files: ["src/banking/**/*.ts", "src/transactions/import.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
);
