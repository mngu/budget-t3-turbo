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
import { orgProcedure, protectedProcedure } from "../trpc";

export const connectionsRouter = {
  searchAspsps: orgProcedure
    .input(z.object({ q: z.string().optional() }))
    .query(({ input }) => searchAspsps(input.q)),

  start: orgProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country: z.string().length(2),
        connectionId: z.number().int().positive().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      startAuth(ctx.organizationId, ctx.session.user.id, input),
    ),

  // Pas d'`orgProcedure` : l'espace de destination vient de la demande
  // d'autorisation (`auth_requests`), consommée par `completeAuth`. L'espace
  // actif de la session peut avoir changé pendant le détour par la banque.
  complete: protectedProcedure
    .input(z.object({ code: z.string().min(1), state: z.string().min(1) }))
    .mutation(({ input }) => completeAuth(input.code, input.state)),

  list: orgProcedure.query(({ ctx }) => listConnections(ctx.organizationId)),

  orphans: orgProcedure.query(({ ctx }) =>
    listOrphanAccounts(ctx.organizationId),
  ),

  accounts: orgProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      getConnectionAccounts(ctx.organizationId, input.connectionId),
    ),

  updateAccounts: orgProcedure
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
    .mutation(({ ctx, input }) =>
      updateAccounts(ctx.organizationId, input.accounts),
    ),

  revoke: orgProcedure
    .input(z.object({ connectionId: z.number().int().positive() }))
    .mutation(({ ctx, input }) =>
      revokeConnection(ctx.organizationId, input.connectionId),
    ),
} satisfies TRPCRouterRecord;
