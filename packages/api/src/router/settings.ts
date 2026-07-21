import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { getSetupStatusCore, saveSettingsCore } from "../lib/settings-core";
import { protectedProcedure } from "../trpc";

export const settingsRouter = {
  status: protectedProcedure.query(() => getSetupStatusCore()),

  save: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().min(1, "application_id requis"),
        privateKeyPem: z.string().min(1, "Clé privée requise"),
        redirectUrl: z.url("URL de redirection invalide"),
      }),
    )
    .mutation(({ input }) => saveSettingsCore(input)),
} satisfies TRPCRouterRecord;
