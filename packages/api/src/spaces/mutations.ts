import type { SpaceRole } from "./schemas";

// Write organization tables directly: putting Better Auth's API in the tRPC
// context exceeds TypeScript's declaration serialization limit.
import { randomUUID } from "node:crypto";

import { sendInvitationEmail, slugify } from "@budget/auth";
import { and, eq, gt, ne, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { invitation, member, organization, user } from "@budget/db/schema";

import { hasRole, membershipGuards } from "./queries";

// Keep the lifetime aligned with the invitation UI.
const INVITATION_DAYS = 7;

const expiry = () => new Date(Date.now() + INVITATION_DAYS * 24 * 3600 * 1000);

async function assertOwner(userId: string, organizationId: string) {
  if (!(await hasRole(userId, organizationId, "owner"))) {
    throw new Error("Réservé au propriétaire de l'espace.");
  }
}

async function assertMember(userId: string, organizationId: string) {
  if (!(await hasRole(userId, organizationId))) {
    throw new Error("Espace introuvable.");
  }
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom ne peut pas être vide.");
  return trimmed;
}

export async function createSpace(
  userId: string,
  name: string,
): Promise<{ id: string }> {
  const label = cleanName(name);
  const id = randomUUID();
  await db.insert(organization).values({
    id,
    name: label,
    slug: slugify(label),
    isPersonal: false,
    createdAt: new Date(),
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: id,
    userId,
    role: "owner",
    createdAt: new Date(),
  });
  return { id };
}

// Share the existing space to preserve its data; accounts cannot move between spaces.
// This is irreversible: the signup hook does not recreate personal spaces.
export async function shareSpace(
  userId: string,
  organizationId: string,
  name: string,
): Promise<void> {
  await assertOwner(userId, organizationId);
  const label = cleanName(name);
  await db
    .update(organization)
    .set({ name: label, isPersonal: false })
    .where(eq(organization.id, organizationId));
}

export async function renameSpace(
  userId: string,
  organizationId: string,
  name: string,
): Promise<void> {
  await assertOwner(userId, organizationId);
  await db
    .update(organization)
    .set({ name: cleanName(name) })
    .where(eq(organization.id, organizationId));
}

export async function deleteSpace(
  userId: string,
  organizationId: string,
): Promise<void> {
  await assertOwner(userId, organizationId);
  const [org] = await db
    .select({ isPersonal: organization.isPersonal })
    .from(organization)
    .where(eq(organization.id, organizationId));
  if (!org) throw new Error("Espace introuvable.");
  if (org.isPersonal) {
    throw new Error("L'espace personnel ne peut pas être supprimé.");
  }
  await db.delete(organization).where(eq(organization.id, organizationId));
}

export async function inviteMember(
  userId: string,
  organizationId: string,
  email: string,
  role: SpaceRole,
): Promise<void> {
  await assertOwner(userId, organizationId);
  const address = email.trim().toLowerCase();

  const [already] = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(user.email, address)),
    );
  if (already) throw new Error("Cette personne est déjà membre de l'espace.");

  // Reuse pending invitations instead of issuing multiple valid links.
  const [pending] = await db
    .select({ id: invitation.id })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.email, address),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, sql`now()`),
      ),
    );
  if (pending)
    throw new Error("Une invitation est déjà en attente pour cette adresse.");

  const id = randomUUID();
  await db.insert(invitation).values({
    id,
    organizationId,
    email: address,
    role,
    status: "pending",
    expiresAt: expiry(),
    createdAt: new Date(),
    inviterId: userId,
  });
  await notify(id);
}

export async function resendInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  const [row] = await db
    .select({ organizationId: invitation.organizationId })
    .from(invitation)
    .where(eq(invitation.id, invitationId));
  if (!row) throw new Error("Invitation introuvable.");
  await assertOwner(userId, row.organizationId);

  await db
    .update(invitation)
    .set({ status: "pending", expiresAt: expiry() })
    .where(eq(invitation.id, invitationId));
  await notify(invitationId);
}

export async function cancelInvitation(
  userId: string,
  invitationId: string,
): Promise<void> {
  const [row] = await db
    .select({ organizationId: invitation.organizationId })
    .from(invitation)
    .where(eq(invitation.id, invitationId));
  if (!row) throw new Error("Invitation introuvable.");
  await assertOwner(userId, row.organizationId);

  await db
    .update(invitation)
    .set({ status: "canceled" })
    .where(eq(invitation.id, invitationId));
}

// Removing membership preserves space data; orgProcedure checks access on every request.
export async function removeMember(
  userId: string,
  organizationId: string,
  memberUserId: string,
): Promise<void> {
  await assertOwner(userId, organizationId);
  if (memberUserId === userId) {
    throw new Error("Utilisez « Quitter » pour sortir de l'espace.");
  }
  await db
    .delete(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, memberUserId),
      ),
    );
}

// Keep an owner in every space and at least one accessible space per user.
export async function leaveSpace(
  userId: string,
  organizationId: string,
): Promise<void> {
  await assertMember(userId, organizationId);
  const { spaceCount, isLastOwner } = await membershipGuards(
    userId,
    organizationId,
  );
  if (isLastOwner) {
    throw new Error(
      "Vous êtes le dernier propriétaire : nommez quelqu'un d'autre avant de partir.",
    );
  }
  if (spaceCount <= 1) {
    throw new Error(
      "C'est votre seul espace : vous ne pourriez plus accéder à l'application.",
    );
  }
  await db
    .delete(member)
    .where(
      and(eq(member.organizationId, organizationId), eq(member.userId, userId)),
    );
}

// Match the authenticated email: possession of a forwarded invitation is not authorization.
export async function acceptInvitation(
  userId: string,
  userEmail: string,
  invitationId: string,
): Promise<{ organizationId: string }> {
  const [row] = await db
    .select({
      organizationId: invitation.organizationId,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(eq(invitation.id, invitationId));
  if (!row) throw new Error("Invitation introuvable.");
  if (row.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error("Cette invitation vise une autre adresse email.");
  }
  if (row.status !== "pending") {
    throw new Error("Cette invitation a déjà été traitée.");
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new Error("Cette invitation a expiré.");
  }

  const [already] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, row.organizationId),
        eq(member.userId, userId),
      ),
    );
  if (!already) {
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: row.organizationId,
      userId,
      role: row.role ?? "member",
      createdAt: new Date(),
    });
  }
  await db
    .update(invitation)
    .set({ status: "accepted" })
    .where(eq(invitation.id, invitationId));

  return { organizationId: row.organizationId };
}

export async function declineInvitation(
  userEmail: string,
  invitationId: string,
): Promise<void> {
  await db
    .update(invitation)
    .set({ status: "rejected" })
    .where(
      and(
        eq(invitation.id, invitationId),
        eq(invitation.email, userEmail.toLowerCase()),
        ne(invitation.status, "accepted"),
      ),
    );
}

// Preserve invitations if delivery fails; the owner can resend them.
async function notify(invitationId: string): Promise<void> {
  const [row] = await db
    .select({
      email: invitation.email,
      spaceName: organization.name,
      invitedBy: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, invitationId));
  if (!row) return;
  try {
    await sendInvitationEmail({
      to: row.email,
      invitationId,
      spaceName: row.spaceName,
      invitedBy: row.invitedBy,
    });
  } catch (err) {
    console.error("⚠️  Envoi de l'invitation échoué :", err);
  }
}
