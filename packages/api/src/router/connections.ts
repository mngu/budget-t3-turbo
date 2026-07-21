import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import {
  completeAuthCore,
  getConnectionAccountsCore,
  listConnectionsCore,
  revokeConnectionCore,
  searchAspspsCore,
  startAuthCore,
  updateAccountsCore,
} from "../lib/connections-core";
import { protectedProcedure } from "../trpc";

export const connectionsRouter = {
  searchAspsps: protectedProcedure
    .input(z.object({ q: z.string().optional() }))
    .query(({ input }) => searchAspspsCore(input.q)),

  start: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country: z.string().length(2),
        connectionId: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ input }) => startAuthCore(input)),

  complete: protectedProcedure
    .input(z.object({ code: z.string().min(1), state: z.string().min(1) }))
    .mutation(({ input }) => completeAuthCore(input.code, input.state)),

  list: protectedProcedure.query(() => listConnectionsCore()),

  accounts: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .query(({ input }) => getConnectionAccountsCore(input.connectionId)),

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
    .mutation(({ input }) => updateAccountsCore(input.accounts)),

  revoke: protectedProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .mutation(({ input }) => revokeConnectionCore(input.connectionId)),
} satisfies TRPCRouterRecord;
