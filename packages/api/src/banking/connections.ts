// Gestion des connexions bancaires Enable Banking (sessions PSD2 en DB).
import { randomUUID } from "node:crypto";

import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNull,
  lt,
  max,
  sql,
} from "@budget/db";
import { db } from "@budget/db/client";
import {
  authRequests,
  bankAccounts,
  bankConnections,
  transactions,
} from "@budget/db/schema";

import type { ConsentBadge } from "./domain";
import { appJwt, ebApi, getAllAspsps, requireSettings } from "./client";
import {
  clampValidUntil,
  consentBadge,
  parseSessionAccounts,
  reconcileAccounts,
} from "./domain";

export interface AspspOption {
  name: string;
  country: string;
  logo: string | null;
}

// Les noms d'ASPSP d'Enable Banking sont sans accent (« Caisse d'Epargne Ile De
// France », « Societe Generale ») alors que tout le reste de l'app les écrit
// accentués — à commencer par `bankAccounts.bank_name`, d'où part le lien
// « Connecter … » des comptes orphelins. Comparer sans accent des deux côtés.
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export async function searchAspsps(
  q: string | undefined,
): Promise<AspspOption[]> {
  const settings = await requireSettings();
  const all = await getAllAspsps(appJwt(settings));
  const needle = fold((q ?? "").trim());

  return all
    .filter((a) => !needle || fold(a.name).includes(needle))
    .sort(
      (x, y) =>
        Number(y.country === "FR") - Number(x.country === "FR") ||
        x.name.localeCompare(y.name),
    )
    .slice(0, 30)
    .map(({ name, country, logo }) => ({ name, country, logo }));
}

export interface StartAuthInput {
  name: string;
  country: string;
  connectionId?: number;
}

export async function startAuth(
  organizationId: string,
  userId: string,
  input: StartAuthInput,
): Promise<{ url: string }> {
  const settings = await requireSettings();
  const jwt = appJwt(settings);

  // Purge des demandes abandonnées (SCA refusé, onglet fermé…).
  await db
    .delete(authRequests)
    .where(lt(authRequests.createdAt, sql`now() - interval '1 hour'`));

  const aspsp = (await getAllAspsps(jwt)).find(
    (a) => a.name === input.name && a.country === input.country,
  );

  const state = randomUUID();
  const auth = await ebApi("/auth", jwt, {
    method: "POST",
    body: JSON.stringify({
      access: {
        valid_until: clampValidUntil(
          aspsp?.maximum_consent_validity,
          new Date(),
        ),
      },
      aspsp: { name: input.name, country: input.country },
      state,
      redirect_url: settings.redirectUrl,
      psu_type: "personal",
    }),
  });

  // L'espace voyage dans la demande et non dans la session : au retour de la
  // banque, le callback n'a que le `state`, et l'espace actif peut avoir changé
  // entre-temps (autre onglet, autre appareil).
  await db.insert(authRequests).values({
    state,
    organizationId,
    createdByUserId: userId,
    aspspName: input.name,
    aspspCountry: input.country,
    connectionId: input.connectionId ?? null,
  });

  return { url: auth.url };
}

export interface CompleteAuthResult {
  connectionId: number;
  renewed: boolean;
}

export async function completeAuth(
  code: string,
  state: string,
): Promise<CompleteAuthResult> {
  // Pas de paramètre d'espace : il vient de la demande consommée ci-dessous,
  // seule source fiable ici.
  // Consommation atomique du state : un delete...returning échoue à la seconde
  // tentative (replay, double effet React) sans fenêtre de course.
  const [request] = await db
    .delete(authRequests)
    .where(eq(authRequests.state, state))
    .returning();
  if (!request) {
    throw new Error(
      "Demande d'autorisation inconnue ou déjà traitée — relancez la connexion.",
    );
  }

  const settings = await requireSettings();
  const jwt = appJwt(settings);
  const session = await ebApi("/sessions", jwt, {
    method: "POST",
    body: JSON.stringify({ code }),
  });

  const validUntil = session.access?.valid_until
    ? new Date(session.access.valid_until)
    : new Date(clampValidUntil(null, new Date()));
  const logo =
    (await getAllAspsps(jwt)).find(
      (a) => a.name === request.aspspName && a.country === request.aspspCountry,
    )?.logo ?? null;

  let connectionId = request.connectionId;
  if (connectionId) {
    await db
      .update(bankConnections)
      .set({
        sessionId: session.session_id,
        validUntil,
        status: "active",
        logoUrl: logo,
      })
      .where(
        and(
          eq(bankConnections.id, connectionId),
          eq(bankConnections.organizationId, request.organizationId),
        ),
      );
  } else {
    const [row] = await db
      .insert(bankConnections)
      .values({
        organizationId: request.organizationId,
        createdByUserId: request.createdByUserId,
        sessionId: session.session_id,
        aspspName: request.aspspName,
        aspspCountry: request.aspspCountry,
        logoUrl: logo,
        validUntil,
      })
      .returning({ id: bankConnections.id });
    if (!row) throw new Error("Échec de la création de la connexion bancaire.");
    connectionId = row.id;
  }

  const discovered = parseSessionAccounts(session.accounts);
  // Rapprochement dans le seul espace de la demande : le même compte joint
  // connecté par deux membres d'un couple, chacun chez lui, donne deux comptes
  // — un rapprochement global les fusionnerait en volant la ligne à l'autre.
  const existing = await db
    .select({
      id: bankAccounts.id,
      uid: bankAccounts.uid,
      iban: bankAccounts.iban,
    })
    .from(bankAccounts)
    .where(eq(bankAccounts.organizationId, request.organizationId));
  const { updates, creates } = reconcileAccounts(existing, discovered);

  for (const u of updates) {
    await db
      .update(bankAccounts)
      .set({ uid: u.uid, connectionId })
      .where(eq(bankAccounts.id, u.id));
  }
  if (creates.length > 0) {
    await db.insert(bankAccounts).values(
      creates.map((c) => ({
        organizationId: request.organizationId,
        uid: c.uid,
        iban: c.iban,
        bankName: request.aspspName,
        connectionId,
      })),
    );
  }

  return { connectionId, renewed: request.connectionId != null };
}

export interface AccountSummary {
  id: number;
  uid: string;
  iban: string | null;
  displayName: string | null;
  enabled: boolean;
  /** Transactions déjà importées pour ce compte (0 pour un compte tout juste découvert). */
  transactionCount: number;
  /** Import le plus récent sur ce compte — pas la dernière *synchronisation* :
   *  une synchro qui ne ramène rien ne le fait pas bouger (voir la note du
   *  bloc d'état de /banques). */
  lastImportedAt: string | null;
}

interface AccountStats {
  transactionCount: number;
  lastImportedAt: string | null;
}

// Un seul agrégat pour toute la page plutôt qu'une requête par compte.
async function accountStats(
  accountIds: number[],
): Promise<Map<number, AccountStats>> {
  if (accountIds.length === 0) return new Map();
  const rows = await db
    .select({
      accountId: transactions.accountId,
      transactionCount: count(),
      lastImportedAt: max(transactions.importedAt),
    })
    .from(transactions)
    .where(inArray(transactions.accountId, accountIds))
    .groupBy(transactions.accountId);

  return new Map(
    rows.map((r) => [
      r.accountId,
      {
        transactionCount: r.transactionCount,
        lastImportedAt: r.lastImportedAt?.toISOString() ?? null,
      },
    ]),
  );
}

const NO_STATS: AccountStats = { transactionCount: 0, lastImportedAt: null };

export interface ConnectionSummary {
  id: number;
  aspspName: string;
  aspspCountry: string;
  logoUrl: string | null;
  validUntil: string;
  status: "active" | "expired" | "revoked";
  badge: ConsentBadge;
  accounts: AccountSummary[];
}

export async function listConnections(
  organizationId: string,
): Promise<ConnectionSummary[]> {
  // Bascule paresseuse : les connexions actives dont la validité est passée
  // deviennent expired (pas de tâche planifiée nécessaire).
  await db
    .update(bankConnections)
    .set({ status: "expired" })
    .where(
      and(
        eq(bankConnections.organizationId, organizationId),
        eq(bankConnections.status, "active"),
        lt(bankConnections.validUntil, new Date()),
      ),
    );

  const connections = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.organizationId, organizationId));
  const ids = connections.map((c) => c.id);
  const accountRows =
    ids.length > 0
      ? await db
          .select()
          .from(bankAccounts)
          .where(inArray(bankAccounts.connectionId, ids))
      : [];

  const stats = await accountStats(accountRows.map((a) => a.id));

  const now = new Date();
  return connections.map((c) => ({
    id: c.id,
    aspspName: c.aspspName,
    aspspCountry: c.aspspCountry,
    logoUrl: c.logoUrl,
    validUntil: c.validUntil.toISOString(),
    status: c.status,
    badge:
      c.status === "active"
        ? consentBadge(c.validUntil, now)
        : { level: "expired" as const, daysLeft: 0 },
    accounts: accountRows
      .filter((a) => a.connectionId === c.id)
      .map((a) => ({
        id: a.id,
        uid: a.uid,
        iban: a.iban,
        displayName: a.displayName,
        enabled: a.enabled,
        ...(stats.get(a.id) ?? NO_STATS),
      })),
  }));
}

export interface OrphanBankGroup {
  bankName: string;
  accountCount: number;
  transactionCount: number;
}

/**
 * Comptes sans connexion (`bankAccounts.connection_id IS NULL`) : historiques d'avant
 * le wizard, ou dont la connexion n'a jamais été rétablie. Ils portent des
 * transactions mais plus aucune autorisation — regroupés par banque, c'est le
 * nom qu'il faut reconnecter.
 */
export async function listOrphanAccounts(
  organizationId: string,
): Promise<OrphanBankGroup[]> {
  const rows = await db
    .select({
      bankName: bankAccounts.bankName,
      // countDistinct : la jointure sur les transactions duplique la ligne compte.
      accountCount: countDistinct(bankAccounts.id),
      transactionCount: count(transactions.id),
    })
    .from(bankAccounts)
    .leftJoin(transactions, eq(transactions.accountId, bankAccounts.id))
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        isNull(bankAccounts.connectionId),
      ),
    )
    .groupBy(bankAccounts.bankName)
    .orderBy(bankAccounts.bankName);

  return rows;
}

export async function getConnectionAccounts(
  organizationId: string,
  connectionId: number,
): Promise<AccountSummary[]> {
  const rows = await db
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.organizationId, organizationId),
        eq(bankAccounts.connectionId, connectionId),
      ),
    );
  const stats = await accountStats(rows.map((a) => a.id));

  return rows.map((a) => ({
    id: a.id,
    uid: a.uid,
    iban: a.iban,
    displayName: a.displayName,
    enabled: a.enabled,
    ...(stats.get(a.id) ?? NO_STATS),
  }));
}

export interface AccountUpdate {
  id: number;
  displayName: string | null;
  enabled: boolean;
}

export async function updateAccounts(
  organizationId: string,
  updates: AccountUpdate[],
): Promise<void> {
  for (const u of updates) {
    await db
      .update(bankAccounts)
      .set({ displayName: u.displayName || null, enabled: u.enabled })
      .where(
        and(
          eq(bankAccounts.id, u.id),
          eq(bankAccounts.organizationId, organizationId),
        ),
      );
  }
}

export async function revokeConnection(
  organizationId: string,
  connectionId: number,
): Promise<void> {
  // Révoquer coupe une autorisation bancaire réelle : la vérification d'espace
  // est ici la garde qui compte, l'id venant du client.
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.organizationId, organizationId),
      ),
    );
  if (!conn) throw new Error("Connexion introuvable.");

  const settings = await requireSettings();
  try {
    await ebApi(`/sessions/${conn.sessionId}`, appJwt(settings), {
      method: "DELETE",
    });
  } catch (err) {
    // Session déjà invalide côté Enable Banking : on marque quand même révoquée.
    console.warn(
      `⚠️  Révocation Enable Banking échouée (session déjà invalide ?) :`,
      err,
    );
  }
  await db
    .update(bankConnections)
    .set({ status: "revoked" })
    .where(
      and(
        eq(bankConnections.id, connectionId),
        eq(bankConnections.organizationId, organizationId),
      ),
    );
}
