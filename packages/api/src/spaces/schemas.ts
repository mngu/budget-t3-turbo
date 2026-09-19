import { z } from "zod/v4";

const spaceRoleSchema = z.enum(["owner", "member"]);
export type SpaceRole = z.infer<typeof spaceRoleSchema>;

const spaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: spaceRoleSchema,
  isMe: z.boolean(),
});
export type SpaceMember = z.infer<typeof spaceMemberSchema>;

const spaceInvitationSchema = z.object({ id: z.string(), email: z.string() });
export type SpaceInvitation = z.infer<typeof spaceInvitationSchema>;

const spaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isPersonal: z.boolean(),
  role: spaceRoleSchema,
  isActive: z.boolean(),
  members: z.array(spaceMemberSchema),
  invitations: z.array(spaceInvitationSchema),
});
export type Space = z.infer<typeof spaceSchema>;
export const spacesSchema = z.array(spaceSchema);

const incomingInvitationSchema = z.object({
  id: z.string(),
  spaceName: z.string(),
  invitedBy: z.string(),
  role: spaceRoleSchema,
});
export type IncomingInvitation = z.infer<typeof incomingInvitationSchema>;
export const incomingInvitationsSchema = z.array(incomingInvitationSchema);

// Expired is derived from expires_at; expired invitations remain pending in storage.
export const invitationDetailSchema = z.object({
  id: z.string(),
  email: z.string(),
  spaceName: z.string(),
  invitedBy: z.string(),
  status: z.enum(["pending", "accepted", "canceled", "expired"]),
});
export type InvitationDetail = z.infer<typeof invitationDetailSchema>;

export const membershipGuardsSchema = z.object({
  spaceCount: z.number().int(),
  isLastOwner: z.boolean(),
});
