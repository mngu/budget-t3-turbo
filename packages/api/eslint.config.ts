import { defineConfig } from "eslint/config";

import { baseConfig } from "@budget/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  {
    // Code porté iso-fonctionnel depuis budget-tracker (ebApi non typé) — ne pas
    // durcir sans refactor dédié. Cible les modules qui manipulent directement
    // les réponses brutes d'Enable Banking, pas tout `src/`.
    files: ["src/banking/**/*.ts", "src/transactions/*.ts"],
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
