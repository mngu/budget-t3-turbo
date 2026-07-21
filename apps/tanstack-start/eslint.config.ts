import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@budget/eslint-config/base";
import { reactConfig } from "@budget/eslint-config/react";

export default defineConfig(
  {
    ignores: [".nitro/**", ".output/**", ".tanstack/**"],
  },
  baseConfig,
  reactConfig,
  restrictEnvAccess,
);
