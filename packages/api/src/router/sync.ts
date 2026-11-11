import type { TRPCRouterRecord } from "@trpc/server";

import { psuHeaders } from "../banking/client";
import { performImport, performSync } from "../pipeline";
import { orgProcedure } from "../trpc";

export const syncRouter = {
  import: orgProcedure.mutation(({ ctx }) => performImport(ctx.organizationId)),

  run: orgProcedure.mutation(({ ctx }) =>
    performSync(ctx.organizationId, psuHeaders(ctx.headers)),
  ),
} satisfies TRPCRouterRecord;
