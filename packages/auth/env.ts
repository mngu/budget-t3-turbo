import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
      // Optional for local development; email.ts rejects missing credentials in production.
      RESEND_API_KEY: z.string().min(1).optional(),
      EMAIL_FROM: z.string().min(1).optional(),
      // Shared by auth emails and the app so public URLs cannot diverge.
      SITE_URL: z.url().optional(),
    },
    runtimeEnv: process.env,
    // Empty .env assignments should behave like absent optional values.
    emptyStringAsUndefined: true,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
