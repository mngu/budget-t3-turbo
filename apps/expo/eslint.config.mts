import { defineConfig } from "eslint/config";

import { baseConfig } from "@budget/eslint-config/base";
import { reactConfig } from "@budget/eslint-config/react";

export default defineConfig(
  {
    ignores: [
      ".expo/**",
      "expo-plugins/**",
      // Fichiers web générés par le CLI gluestack-ui, exclus du tsconfig (pas de lib DOM).
      "src/**/*.web.tsx",
      "src/components/ui/gluestack-ui-provider/script.ts",
    ],
  },
  baseConfig,
  reactConfig,
  {
    // Code généré par le CLI gluestack-ui (composants copiés) — ne pas durcir sans refactor dédié.
    files: ["src/components/ui/**"],
    rules: {
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
);
