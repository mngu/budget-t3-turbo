import type { TRPCRouterRecord } from "@trpc/server";

import { performImport, performSync } from "../lib/sync-core";
import { protectedProcedure } from "../trpc";

export const syncRouter = {
  // Rejoue l'import des data/*.json déjà présents puis la catégorisation, sans
  // aucun appel bancaire (donc sans SCA ni consommation du quota PSD2).
  import: protectedProcedure.mutation(() => performImport()),

  run: protectedProcedure.mutation(({ ctx }) => {
    // Sync déclenché depuis l'app = utilisateur présent : relayer son IP et son
    // user-agent (PSU headers) classe l'accès « PSU présent » côté banque, ce qui
    // l'exempte du plafond PSD2 des accès non-assistés (~4/jour).
    const psuHeaders: Record<string, string> = {};
    const ip = ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = ctx.headers.get("user-agent");
    if (ip) psuHeaders["Psu-Ip-Address"] = ip;
    if (userAgent) psuHeaders["Psu-User-Agent"] = userAgent;

    return performSync(psuHeaders);
  }),
} satisfies TRPCRouterRecord;
