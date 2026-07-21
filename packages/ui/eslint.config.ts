import { defineConfig } from "eslint/config";

import { baseConfig } from "@budget/eslint-config/base";
import { reactConfig } from "@budget/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
