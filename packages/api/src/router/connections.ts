import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import {
  completeAuth,
  getConnectionAccounts,
  listConnections,
  listOrphanAccounts,
  revokeConnection,
  searchAspsps,
  startAuth,
  updateAccounts,
} from "../banking/connections";
import { protectedProcedure } from "../trpc";

export const connectionsRouter = {
  searchAspsps: protectedProcedure
    .input(z.object({ q: z.string().optional() }))
    .query(({ input }) => searchAspsps(input.q)),

  start: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country: z.string().length(2),
        connectionId: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ input }) => startAuth(input)),

  complete: protectedProcedure
    .input(z.object({ code: z.string().min(1), state: z.string().min(1) }))
    .mutation(({ input }) => completeAuth(input.code, input.state)),

  list: protectedProcedure.query(() => listConnections()),

  orphans: protectedProcedure.query(() => listOrphanAccounts()),

  accounts: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .query(({ input }) => getConnectionAccounts(input.connectionId)),

  updateAccounts: protectedProcedure
    .input(
      z.object({
        accounts: z.array(
          z.object({
            id: z.number().int().positive(),
            displayName: z.string().nullable(),
            enabled: z.boolean(),
          }),
        ),
      }),
    )
    .mutation(({ input }) => updateAccounts(input.accounts)),

  revoke: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .mutation(({ input }) => revokeConnection(input.connectionId)),
} satisfies TRPCRouterRecord;
