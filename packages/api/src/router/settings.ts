import type { TRPCRouterRecord } from "@trpc/server";

import { z } from "zod/v4";

import { getSetupStatus, saveSettings } from "../banking/settings";
import { adminProcedure, protectedProcedure } from "../trpc";

export const settingsRouter = {
  status: protectedProcedure.query(() => getSetupStatus()),

  // La configuration Enable Banking est celle de l'installation : la lire est
  // ouvert (la page /banques en dépend), l'écraser est réservé à l'admin.
  save: adminProcedure
    .input(
      z.object({
        applicationId: z.string().min(1, "application_id requis"),
        privateKeyPem: z.string().min(1, "Clé privée requise"),
        redirectUrl: z.url("URL de redirection invalide"),
      }),
    )
    .mutation(({ input }) => saveSettings(input)),
} satisfies TRPCRouterRecord;
