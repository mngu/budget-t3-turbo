import { createEnv } from "@t3-oss/env-core";
import { vercel } from "@t3-oss/env-core/presets-zod";
import { z } from "zod/v4";

import { authEnv } from "@budget/auth/env";

export const env = createEnv({
  clientPrefix: "VITE_",
  extends: [authEnv(), vercel()],
  shared: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
  },
  server: {
    POSTGRES_URL: z.url(),
    // `SITE_URL` vient d'`authEnv()` : les emails envoyés depuis @budget/auth
    // en ont besoin, et deux déclarations pourraient diverger.
  },
  client: {},
  runtimeEnv: process.env,
  // Voir `authEnv()` : une clé présente mais vide vaut absente.
  emptyStringAsUndefined: true,
  skipValidation:
    !!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
