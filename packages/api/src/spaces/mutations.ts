// Écritures de l'écran « Espaces ».
//
// Ces mutations écrivent directement les tables du plugin `organization`
// (organization / member / invitation) plutôt que de passer par les endpoints
// better-auth : tout le reste de l'app parle à la base par tRPC + Drizzle, et
// remettre l'API auth dans le contexte tRPC casse le build de déclarations
// (voir le commentaire de `createTRPCContext`). Le seul geste qui reste côté
// better-auth est `setActive`, qui touche la session — donc côté client.
import { randomUUID } from "node:crypto";

import { and, eq, gt, ne, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { invitation, member, organization, user } from "@budget/db/schema";

import type { SpaceRole } from "./queries";
import { sendInvitationEmail } from "../lib/email";
import { hasRole, membershipGuards } from "./queries";

/** Durée de vie d'un lien d'invitation. Annoncée à l'écran, à garder alignée. */
export const INVITATION_DAYS = 7;

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

// Le slug n'est affiché nulle part : un suffixe aléatoire évite d'avoir à
// gérer les collisions sur une valeur que personne ne lit.
const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}`;

/** Espace partagé neuf — vide, c'est tout son propos (voir `shareSpace`). */
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

/**
 * Convertit l'espace personnel en espace partagé : il change de nom et cesse
 * d'être personnel, **rien d'autre ne bouge**. C'est la réponse au seul vrai
 * trou du parcours — les comptes, catégories et transactions d'un espace ne
 * peuvent pas être déplacés vers un autre, alors c'est l'espace lui-même qui
 * s'ouvre.
 *
 * Sans retour possible, et c'est dit à l'écran : rien ne recrée un espace
 * personnel, le hook d'inscription ne s'exécutant qu'une fois.
 */
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

/**
 * Supprime un espace **et tout ce qu'il contient** : les `ON DELETE CASCADE`
 * de `organization_id` emportent comptes, catégories, budgets et transactions.
 * L'espace personnel en est exclu — il naît avec le compte et disparaît avec
 * lui, l'écran propose la conversion à la place.
 */
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
  if (!address.includes("@")) throw new Error("Adresse email invalide.");

  const [already] = await db
    .select({ id: member.id })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(eq(member.organizationId, organizationId), eq(user.email, address)),
    );
  if (already) throw new Error("Cette personne est déjà membre de l'espace.");

  // Une seule invitation vivante par adresse et par espace : ré-inviter
  // prolonge la précédente au lieu d'empiler des liens tous valides.
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

/** Repousse l'échéance et renvoie le mail — même lien, nouvelle validité. */
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

/**
 * Retire un membre. Rien n'est supprimé : les comptes appartiennent à l'espace,
 * pas à la personne — elle perd l'accès, l'espace garde tout. L'effet est
 * immédiat, `orgProcedure` revérifiant l'appartenance à chaque requête.
 */
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

/**
 * Quitter un espace. Deux gardes, pour deux impasses différentes :
 * — le dernier propriétaire laisserait un espace que plus personne ne peut
 *   administrer (ni inviter, ni supprimer) ;
 * — son dernier espace laisserait l'utilisateur sans espace actif, donc face à
 *   un `FORBIDDEN` sur chaque écran de l'app.
 */
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

/**
 * Accepte une invitation. L'adresse du compte connecté doit être celle qui a
 * été invitée : le lien seul ne suffit pas, sinon un lien transféré ouvrirait
 * l'espace à n'importe qui.
 */
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

/** Refus explicite — le lien cesse de valoir, sans rejoindre l'espace. */
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

// L'email est best-effort : une invitation créée mais non notifiée reste
// utilisable (le propriétaire peut la renvoyer), alors qu'une erreur d'envoi
// qui remonterait ferait croire que rien n'a été créé.
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
