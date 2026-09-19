import type {
  IncomingInvitation,
  InvitationDetail,
  Space,
  SpaceRole,
} from "./schemas";

import { sql } from "@budget/db";
import { db } from "@budget/db/client";

import {
  incomingInvitationsSchema,
  invitationDetailSchema,
  membershipGuardsSchema,
  spacesSchema,
} from "./schemas";

// Magic-link signup may omit a name; match the signup hook's email-prefix fallback.
const displayName = sql`coalesce(nullif(u.name, ''), split_part(u.email, '@', 1))`;

export async function listSpaces(
  userId: string,
  activeOrganizationId: string | null,
): Promise<Space[]> {
  const result = await db.execute(sql`
    SELECT o.id,
           o.name,
           coalesce(o.is_personal, false) AS "isPersonal",
           CASE WHEN me.role = 'owner' THEN 'owner' ELSE 'member' END AS role,
           o.id IS NOT DISTINCT FROM ${activeOrganizationId} AS "isActive",
           (SELECT coalesce(json_agg(json_build_object(
                     'userId', u.id,
                     'name', ${displayName},
                     'email', u.email,
                     'role', CASE WHEN m.role = 'owner' THEN 'owner' ELSE 'member' END,
                     'isMe', u.id = ${userId}
                   ) ORDER BY m.created_at), '[]'::json)
              FROM member m
              JOIN "user" u ON u.id = m.user_id
             WHERE m.organization_id = o.id) AS members,
           (SELECT coalesce(json_agg(json_build_object('id', i.id, 'email', i.email)
                                     ORDER BY i.created_at), '[]'::json)
              FROM invitation i
             WHERE i.organization_id = o.id
               AND i.status = 'pending'
               AND i.expires_at > now()) AS invitations
      FROM member me
      JOIN organization o ON o.id = me.organization_id
     WHERE me.user_id = ${userId}
     ORDER BY o.created_at
  `);
  return spacesSchema.parse(result.rows);
}

export async function listIncomingInvitations(
  email: string,
): Promise<IncomingInvitation[]> {
  const result = await db.execute(sql`
    SELECT i.id,
           o.name AS "spaceName",
           ${displayName} AS "invitedBy",
           CASE WHEN i.role = 'owner' THEN 'owner' ELSE 'member' END AS role
      FROM invitation i
      JOIN organization o ON o.id = i.organization_id
      JOIN "user" u ON u.id = i.inviter_id
     WHERE i.email = ${email.toLowerCase()}
       AND i.status = 'pending'
       AND i.expires_at > now()
     ORDER BY i.created_at
  `);
  return incomingInvitationsSchema.parse(result.rows);
}

// Public lookup: expose only invitation details, never space members or transactions.
export async function getInvitation(
  invitationId: string,
): Promise<InvitationDetail | null> {
  const result = await db.execute(sql`
    SELECT i.id,
           i.email,
           o.name AS "spaceName",
           ${displayName} AS "invitedBy",
           CASE WHEN i.status = 'accepted' THEN 'accepted'
                WHEN i.status IN ('canceled', 'rejected') THEN 'canceled'
                WHEN i.expires_at <= now() THEN 'expired'
                ELSE 'pending' END AS status
      FROM invitation i
      JOIN organization o ON o.id = i.organization_id
      JOIN "user" u ON u.id = i.inviter_id
     WHERE i.id = ${invitationId}
  `);
  const [row] = result.rows;
  return row ? invitationDetailSchema.parse(row) : null;
}

export async function membershipGuards(userId: string, organizationId: string) {
  const result = await db.execute(sql`
    SELECT (SELECT count(*)::int FROM member WHERE user_id = ${userId}) AS "spaceCount",
           (SELECT coalesce(bool_and(user_id = ${userId}), false)
              FROM member
             WHERE organization_id = ${organizationId} AND role = 'owner') AS "isLastOwner"
  `);
  return membershipGuardsSchema.parse(result.rows[0]);
}

export async function hasRole(
  userId: string,
  organizationId: string,
  role?: SpaceRole,
): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1
      FROM member
     WHERE organization_id = ${organizationId}
       AND user_id = ${userId}
       ${role ? sql`AND role = ${role}` : sql``}
  `);
  return result.rows.length > 0;
}
