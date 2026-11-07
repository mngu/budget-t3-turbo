import type { TRPCRouterRecord } from "@trpc/server";

import { z } from "zod/v4";

import {
  acceptInvitation,
  cancelInvitation,
  createSpace,
  declineInvitation,
  deleteSpace,
  inviteMember,
  leaveSpace,
  removeMember,
  renameSpace,
  resendInvitation,
  setMonthStartDay,
  shareSpace,
} from "../spaces/mutations";
import {
  getInvitation,
  getMonthStartDay,
  listIncomingInvitations,
  listSpaces,
} from "../spaces/queries";
import { monthStartDaySchema } from "../spaces/schemas";
import { orgProcedure, protectedProcedure, publicProcedure } from "../trpc";

const spaceId = z.string().min(1);
const invitationId = z.string().min(1);
const spaceName = z.string().min(1).max(80);
const role = z.enum(["owner", "member"]);

// Authorize each target space separately; orgProcedure only covers the active space.
export const spacesRouter = {
  list: protectedProcedure.query(({ ctx }) =>
    listSpaces(
      ctx.session.user.id,
      ctx.session.session.activeOrganizationId ?? null,
    ),
  ),

  // The active space's budget month, shared by its members on web and mobile.
  monthStartDay: orgProcedure.query(({ ctx }) =>
    getMonthStartDay(ctx.organizationId),
  ),

  setMonthStartDay: orgProcedure
    .input(monthStartDaySchema)
    .mutation(({ ctx, input }) => setMonthStartDay(ctx.organizationId, input)),

  incoming: protectedProcedure.query(({ ctx }) =>
    listIncomingInvitations(ctx.session.user.email),
  ),

  create: protectedProcedure
    .input(z.object({ name: spaceName }))
    .mutation(({ ctx, input }) => createSpace(ctx.session.user.id, input.name)),

  share: protectedProcedure
    .input(z.object({ id: spaceId, name: spaceName }))
    .mutation(({ ctx, input }) =>
      shareSpace(ctx.session.user.id, input.id, input.name),
    ),

  rename: protectedProcedure
    .input(z.object({ id: spaceId, name: spaceName }))
    .mutation(({ ctx, input }) =>
      renameSpace(ctx.session.user.id, input.id, input.name),
    ),

  remove: protectedProcedure
    .input(z.object({ id: spaceId }))
    .mutation(({ ctx, input }) => deleteSpace(ctx.session.user.id, input.id)),

  leave: protectedProcedure
    .input(z.object({ id: spaceId }))
    .mutation(({ ctx, input }) => leaveSpace(ctx.session.user.id, input.id)),

  removeMember: protectedProcedure
    .input(z.object({ id: spaceId, userId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      removeMember(ctx.session.user.id, input.id, input.userId),
    ),

  invite: protectedProcedure
    .input(
      z.object({
        id: spaceId,
        email: z.email({ error: "Adresse email invalide." }),
        role,
      }),
    )
    .mutation(({ ctx, input }) =>
      inviteMember(ctx.session.user.id, input.id, input.email, input.role),
    ),

  resendInvitation: protectedProcedure
    .input(z.object({ invitationId }))
    .mutation(({ ctx, input }) =>
      resendInvitation(ctx.session.user.id, input.invitationId),
    ),

  cancelInvitation: protectedProcedure
    .input(z.object({ invitationId }))
    .mutation(({ ctx, input }) =>
      cancelInvitation(ctx.session.user.id, input.invitationId),
    ),

  // Invitees may not have an account yet; getInvitation limits the public payload.
  invitation: publicProcedure
    .input(z.object({ invitationId }))
    .query(({ input }) => getInvitation(input.invitationId)),

  acceptInvitation: protectedProcedure
    .input(z.object({ invitationId }))
    .mutation(({ ctx, input }) =>
      acceptInvitation(
        ctx.session.user.id,
        ctx.session.user.email,
        input.invitationId,
      ),
    ),

  declineInvitation: protectedProcedure
    .input(z.object({ invitationId }))
    .mutation(({ ctx, input }) =>
      declineInvitation(ctx.session.user.email, input.invitationId),
    ),
} satisfies TRPCRouterRecord;
