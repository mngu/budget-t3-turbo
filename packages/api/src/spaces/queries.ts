// Lectures de l'écran « Espaces » : mes espaces, leurs membres, leurs
// invitations. Un espace est une `organization` (plugin better-auth) ; voir
// CLAUDE.md, section « Espaces ».
import { and, count, eq, inArray, isNull, or, sql } from "@budget/db";
import { db } from "@budget/db/client";
import {
  bankAccounts,
  bankConnections,
  categories,
  invitation,
  member,
  organization,
  transactions,
  user,
} from "@budget/db/schema";

/** Rôles retenus. Le plugin en connaît un troisième (`admin`), inutilisé ici. */
export type SpaceRole = "owner" | "member";

export interface SpaceMember {
  userId: string;
  name: string;
  email: string;
  role: SpaceRole;
  /** Entrée dans l'espace. */
  since: string;
  /** C'est l'utilisateur courant — la ligne dit « Quitter » plutôt que « Retirer ». */
  isMe: boolean;
}

/**
 * Une invitation, dans l'un des quatre états que porte la table. Il n'y en a
 * pas de cinquième : « reçue » ou « ouverte » supposeraient un suivi de
 * délivrabilité que rien n'enregistre.
 */
export interface SpaceInvitation {
  id: string;
  email: string;
  role: SpaceRole;
  status: "pending" | "accepted" | "canceled" | "expired";
  expiresAt: string;
  invitedBy: string;
}

/**
 * « Qui doit renouveler l'autorisation bancaire ». Le consentement PSD2
 * appartient à la personne qui s'est authentifiée à la banque : sur un espace
 * partagé, tout le monde voit les opérations mais elle seule peut le refaire.
 */
export interface SpaceConsent {
  bankName: string;
  authorizedBy: string;
}

export interface Space {
  id: string;
  name: string;
  isPersonal: boolean;
  createdAt: string;
  /** Rôle de l'utilisateur courant dans cet espace. */
  role: SpaceRole;
  isActive: boolean;
  counts: {
    accounts: number;
    categories: number;
    transactions: number;
    members: number;
  };
  members: SpaceMember[];
  /** Invitations en attente ou récemment traitées, les plus récentes d'abord. */
  invitations: SpaceInvitation[];
  consents: SpaceConsent[];
}

const asRole = (role: string): SpaceRole =>
  role === "owner" ? "owner" : "member";

/**
 * Le statut affiché d'une invitation. `expired` **n'est pas** un statut stocké :
 * la table ne connaît que pending/accepted/canceled et une invitation périmée y
 * reste « pending ». Le dérivé ici plutôt qu'un job de nettoyage — une ligne
 * dont l'échéance est passée ne vaut plus rien, quelle que soit sa colonne.
 */
function invitationStatus(
  status: string,
  expiresAt: Date,
  now: Date,
): SpaceInvitation["status"] {
  if (status === "accepted") return "accepted";
  if (status === "canceled" || status === "rejected") return "canceled";
  return expiresAt.getTime() <= now.getTime() ? "expired" : "pending";
}

/**
 * Tous les espaces de l'utilisateur, garnis. Une seule procédure pour tout
 * l'écran : les cartes affichent leurs membres dépliés, un appel par espace
 * ferait N+1 requêtes pour une poignée de lignes.
 */
export async function listSpaces(
  userId: string,
  activeOrganizationId: string | null,
): Promise<Space[]> {
  const mine = await db
    .select({
      id: organization.id,
      name: organization.name,
      isPersonal: organization.isPersonal,
      createdAt: organization.createdAt,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(organization.createdAt);

  if (mine.length === 0) return [];
  const ids = mine.map((o) => o.id);
  const now = new Date();

  const [members, invites, accountCounts, categoryCounts, txnCounts, consents] =
    await Promise.all([
      db
        .select({
          organizationId: member.organizationId,
          userId: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
          since: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(inArray(member.organizationId, ids))
        .orderBy(member.createdAt),
      db
        .select({
          id: invitation.id,
          organizationId: invitation.organizationId,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          invitedBy: user.name,
        })
        .from(invitation)
        .innerJoin(user, eq(user.id, invitation.inviterId))
        .where(inArray(invitation.organizationId, ids))
        .orderBy(invitation.createdAt),
      db
        .select({
          organizationId: bankAccounts.organizationId,
          n: count(),
        })
        .from(bankAccounts)
        .where(inArray(bankAccounts.organizationId, ids))
        .groupBy(bankAccounts.organizationId),
      db
        .select({ organizationId: categories.organizationId, n: count() })
        .from(categories)
        .where(inArray(categories.organizationId, ids))
        .groupBy(categories.organizationId),
      db
        .select({ organizationId: bankAccounts.organizationId, n: count() })
        .from(transactions)
        .innerJoin(bankAccounts, eq(bankAccounts.id, transactions.accountId))
        .where(inArray(bankAccounts.organizationId, ids))
        .groupBy(bankAccounts.organizationId),
      // Une ligne par banque encore connectée dont on connaît l'autorisant.
      db
        .selectDistinct({
          organizationId: bankConnections.organizationId,
          bankName: bankConnections.aspspName,
          authorizedBy: user.name,
        })
        .from(bankConnections)
        .innerJoin(user, eq(user.id, bankConnections.createdByUserId))
        .where(
          and(
            inArray(bankConnections.organizationId, ids),
            eq(bankConnections.status, "active"),
          ),
        ),
    ]);

  const byOrg = <T extends { organizationId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      map.set(row.organizationId, [
        ...(map.get(row.organizationId) ?? []),
        row,
      ]);
    }
    return map;
  };
  const membersByOrg = byOrg(members);
  const invitesByOrg = byOrg(invites);
  const consentsByOrg = byOrg(consents);
  const countOf = (rows: { organizationId: string; n: number }[], id: string) =>
    rows.find((r) => r.organizationId === id)?.n ?? 0;

  return mine.map((org) => {
    const orgMembers = membersByOrg.get(org.id) ?? [];
    return {
      id: org.id,
      name: org.name,
      isPersonal: org.isPersonal ?? false,
      createdAt: org.createdAt.toISOString(),
      role: asRole(org.role),
      isActive: org.id === activeOrganizationId,
      counts: {
        accounts: countOf(accountCounts, org.id),
        categories: countOf(categoryCounts, org.id),
        transactions: countOf(txnCounts, org.id),
        members: orgMembers.length,
      },
      members: orgMembers.map((m) => ({
        userId: m.userId,
        name: m.name,
        email: m.email,
        role: asRole(m.role),
        since: m.since.toISOString(),
        isMe: m.userId === userId,
      })),
      invitations: (invitesByOrg.get(org.id) ?? [])
        .map((i) => ({
          id: i.id,
          email: i.email,
          role: asRole(i.role ?? "member"),
          status: invitationStatus(i.status, i.expiresAt, now),
          expiresAt: i.expiresAt.toISOString(),
          invitedBy: i.invitedBy,
        }))
        .reverse(),
      consents: (consentsByOrg.get(org.id) ?? []).map((c) => ({
        bankName: c.bankName,
        authorizedBy: c.authorizedBy,
      })),
    };
  });
}

export interface InvitationDetail {
  id: string;
  email: string;
  spaceName: string;
  invitedBy: string;
  status: SpaceInvitation["status"];
  /** Ce que contient l'espace — le détail que l'invité voit avant d'accepter. */
  counts: { accounts: number; categories: number; members: number };
}

/**
 * L'invitation vue depuis son lien, **avant toute authentification** : l'invité
 * n'a pas forcément de compte. Ne renvoie donc que ce qu'il est légitime de
 * montrer à qui détient le lien — nom de l'espace, qui invite, volumétrie — et
 * jamais la liste des membres ni la moindre transaction.
 */
export async function getInvitation(
  invitationId: string,
): Promise<InvitationDetail | null> {
  const [row] = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      organizationId: invitation.organizationId,
      spaceName: organization.name,
      invitedBy: user.name,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .innerJoin(user, eq(user.id, invitation.inviterId))
    .where(eq(invitation.id, invitationId));
  if (!row) return null;

  const [[accounts], [cats], [members]] = await Promise.all([
    db
      .select({ n: count() })
      .from(bankAccounts)
      .where(eq(bankAccounts.organizationId, row.organizationId)),
    db
      .select({ n: count() })
      .from(categories)
      .where(eq(categories.organizationId, row.organizationId)),
    db
      .select({ n: count() })
      .from(member)
      .where(eq(member.organizationId, row.organizationId)),
  ]);

  return {
    id: row.id,
    email: row.email,
    spaceName: row.spaceName,
    invitedBy: row.invitedBy,
    status: invitationStatus(row.status, row.expiresAt, new Date()),
    counts: {
      accounts: accounts?.n ?? 0,
      categories: cats?.n ?? 0,
      members: members?.n ?? 0,
    },
  };
}

/**
 * Le nombre d'espaces où l'utilisateur est encore membre, et parmi eux ceux
 * dont il est le dernier propriétaire. Les deux gardes de `leaveSpace` en
 * sortent — voir son commentaire.
 */
export async function membershipGuards(
  userId: string,
  organizationId: string,
): Promise<{ spaceCount: number; isLastOwner: boolean }> {
  const [[mine], owners] = await Promise.all([
    db.select({ n: count() }).from(member).where(eq(member.userId, userId)),
    db
      .select({ userId: member.userId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, "owner"),
        ),
      ),
  ]);
  return {
    spaceCount: mine?.n ?? 0,
    isLastOwner: owners.length === 1 && owners[0]?.userId === userId,
  };
}

/** Vrai si l'utilisateur est membre de l'espace, avec le rôle demandé si fourni. */
export async function hasRole(
  userId: string,
  organizationId: string,
  role?: SpaceRole,
): Promise<boolean> {
  const [row] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        role === undefined
          ? or(isNull(member.role), sql`true`)
          : eq(member.role, role),
      ),
    );
  return row !== undefined;
}
