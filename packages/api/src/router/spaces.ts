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
  shareSpace,
} from "../spaces/mutations";
import {
  getInvitation,
  listIncomingInvitations,
  listSpaces,
} from "../spaces/queries";
import { protectedProcedure, publicProcedure } from "../trpc";

const spaceId = z.string().min(1);
const invitationId = z.string().min(1);
const spaceName = z.string().min(1).max(80);
const role = z.enum(["owner", "member"]);

/**
 * Espaces — **pas d'`orgProcedure` ici**, et c'est la particularité de ce
 * routeur : il parle *des* espaces au lieu de travailler *dans* un espace.
 * Chaque procédure porte donc sa propre autorisation (appartenance, rôle
 * propriétaire), au cas par cas, sur l'espace que l'input désigne.
 */
export const spacesRouter = {
  list: protectedProcedure.query(({ ctx }) =>
    listSpaces(
      ctx.session.user.id,
      ctx.session.session.activeOrganizationId ?? null,
    ),
  ),

  // Les invitations qui m'attendent. Scopée par l'email de la session et non
  // par un input : c'est le même critère que celui qu'`acceptInvitation`
  // revérifie de son côté.
  incoming: protectedProcedure.query(({ ctx }) =>
    listIncomingInvitations(ctx.session.user.email),
  ),

  create: protectedProcedure
    .input(z.object({ name: spaceName }))
    .mutation(({ ctx, input }) => createSpace(ctx.session.user.id, input.name)),

  // Ouvre l'espace personnel au partage : il garde tout son contenu et change
  // seulement de nom et de nature. Voir `shareSpace` — sans retour arrière.
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
    .input(z.object({ id: spaceId, email: z.email(), role }))
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

  // **Publique**, et c'est nécessaire : l'écran d'acceptation doit s'afficher
  // pour quelqu'un qui n'a pas encore de compte. Elle ne renvoie que ce qu'on
  // peut montrer à qui détient le lien — nom de l'espace, qui invite,
  // volumétrie — jamais les membres ni la moindre transaction (voir
  // `getInvitation`). L'identifiant est un UUID, il ne se devine pas.
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
