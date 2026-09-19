import type { TRPCRouterRecord } from "@trpc/server";

import { performImport, performSync } from "../pipeline";
import { orgProcedure } from "../trpc";

export const syncRouter = {
  import: orgProcedure.mutation(({ ctx }) => performImport(ctx.organizationId)),

  run: orgProcedure.mutation(({ ctx }) => {
    // Forward PSU headers to identify user-present access to the bank.
    const psuHeaders: Record<string, string> = {};
    const ip = ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userAgent = ctx.headers.get("user-agent");
    if (ip) psuHeaders["Psu-Ip-Address"] = ip;
    if (userAgent) psuHeaders["Psu-User-Agent"] = userAgent;

    return performSync(ctx.organizationId, psuHeaders);
  }),
} satisfies TRPCRouterRecord;
