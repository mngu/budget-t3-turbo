// Schémas des lignes renvoyées par les lectures de `spaces/queries.ts` (SQL
// exécuté via db.execute) ; les types de l'écran « Espaces » en dérivent.
import { z } from "zod/v4";

/** Rôles retenus. Le plugin en connaît un troisième (`admin`), inutilisé ici. */
const spaceRoleSchema = z.enum(["owner", "member"]);
export type SpaceRole = z.infer<typeof spaceRoleSchema>;

const spaceMemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: spaceRoleSchema,
  /** C'est l'utilisateur courant — sa ligne ne porte pas « Retirer ». */
  isMe: z.boolean(),
});
export type SpaceMember = z.infer<typeof spaceMemberSchema>;

const spaceInvitationSchema = z.object({ id: z.string(), email: z.string() });
export type SpaceInvitation = z.infer<typeof spaceInvitationSchema>;

const spaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  isPersonal: z.boolean(),
  /** Rôle de l'utilisateur courant dans cet espace. */
  role: spaceRoleSchema,
  isActive: z.boolean(),
  members: z.array(spaceMemberSchema),
  /** Invitations encore acceptables : en attente et non périmées. */
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

/**
 * Le statut affiché d'une invitation. `expired` **n'est pas** un statut
 * stocké : la table ne connaît que pending/accepted/canceled/rejected et une
 * invitation périmée y reste « pending » ; `getInvitation` le dérive de
 * `expires_at`.
 */
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
