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
  {
    // TanStack Router's `redirect()`/`notFound()` return a `Response`-based
    // value (not an `Error`) that routes are expected to `throw`.
    files: ["src/routes/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/only-throw-error": [
        "error",
        {
          allow: [
            {
              from: "package",
              package: "@tanstack/router-core",
              name: "Redirect",
            },
          ],
        },
      ],
    },
  },
);
