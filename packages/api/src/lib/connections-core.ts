// Gestion des connexions bancaires Enable Banking (sessions PSD2 en DB).
import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, sql } from "@budget/db";
import { db } from "@budget/db/client";
import { accounts, authRequests, bankConnections } from "@budget/db/schema";
import { appJwt, ebApi, getAllAspsps, requireSettings } from "./eb-client";
import {
  clampValidUntil,
  consentBadge,
  parseSessionAccounts,
  reconcileAccounts,
  type ConsentBadge,
} from "./eb-domain";

export interface AspspOption {
  name: string;
  country: string;
  logo: string | null;
}

export async function searchAspspsCore(q: string | undefined): Promise<AspspOption[]> {
  const settings = await requireSettings();
  const all = await getAllAspsps(appJwt(settings));
  const needle = (q ?? "").trim().toLowerCase();

  return all
    .filter((a) => !needle || a.name.toLowerCase().includes(needle))
    .sort(
      (x, y) =>
        Number(y.country === "FR") - Number(x.country === "FR") || x.name.localeCompare(y.name),
    )
    .slice(0, 30)
    .map(({ name, country, logo }) => ({ name, country, logo }));
}

export interface StartAuthInput {
  name: string;
  country: string;
  connectionId?: number;
}

export async function startAuthCore(input: StartAuthInput): Promise<{ url: string }> {
  const settings = await requireSettings();
  const jwt = appJwt(settings);

  // Purge des demandes abandonnées (SCA refusé, onglet fermé…).
  await db.delete(authRequests).where(lt(authRequests.createdAt, sql`now() - interval '1 hour'`));

  const aspsp = (await getAllAspsps(jwt)).find(
    (a) => a.name === input.name && a.country === input.country,
  );

  const state = randomUUID();
  const auth = await ebApi("/auth", jwt, {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: clampValidUntil(aspsp?.maximum_consent_validity, new Date()) },
      aspsp: { name: input.name, country: input.country },
      state,
      redirect_url: settings.redirectUrl,
      psu_type: "personal",
    }),
  });

  await db.insert(authRequests).values({
    state,
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

export async function completeAuthCore(code: string, state: string): Promise<CompleteAuthResult> {
  // Consommation atomique du state : un delete...returning échoue à la seconde
  // tentative (replay, double effet React) sans fenêtre de course.
  const [request] = await db.delete(authRequests).where(eq(authRequests.state, state)).returning();
  if (!request) {
    throw new Error("Demande d'autorisation inconnue ou déjà traitée — relancez la connexion.");
  }

  const settings = await requireSettings();
  const jwt = appJwt(settings);
  const session = await ebApi("/sessions", jwt, { method: "POST", body: JSON.stringify({ code }) });

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
      .set({ sessionId: session.session_id, validUntil, status: "active", logoUrl: logo })
      .where(eq(bankConnections.id, connectionId));
  } else {
    const [row] = await db
      .insert(bankConnections)
      .values({
        sessionId: session.session_id,
        aspspName: request.aspspName,
        aspspCountry: request.aspspCountry,
        logoUrl: logo,
        validUntil,
      })
      .returning({ id: bankConnections.id });
    connectionId = row.id;
  }

  const discovered = parseSessionAccounts(session.accounts);
  const existing = await db
    .select({ id: accounts.id, uid: accounts.uid, iban: accounts.iban })
    .from(accounts);
  const { updates, creates } = reconcileAccounts(existing, discovered);

  for (const u of updates) {
    await db.update(accounts).set({ uid: u.uid, connectionId }).where(eq(accounts.id, u.id));
  }
  if (creates.length > 0) {
    await db.insert(accounts).values(
      creates.map((c) => ({
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
}

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

export async function listConnectionsCore(): Promise<ConnectionSummary[]> {
  // Bascule paresseuse : les connexions actives dont la validité est passée
  // deviennent expired (pas de tâche planifiée nécessaire).
  await db
    .update(bankConnections)
    .set({ status: "expired" })
    .where(and(eq(bankConnections.status, "active"), lt(bankConnections.validUntil, new Date())));

  const connections = await db.select().from(bankConnections);
  const ids = connections.map((c) => c.id);
  const accountRows =
    ids.length > 0
      ? await db.select().from(accounts).where(inArray(accounts.connectionId, ids))
      : [];

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
      })),
  }));
}

export async function getConnectionAccountsCore(connectionId: number): Promise<AccountSummary[]> {
  const rows = await db.select().from(accounts).where(eq(accounts.connectionId, connectionId));
  return rows.map((a) => ({
    id: a.id,
    uid: a.uid,
    iban: a.iban,
    displayName: a.displayName,
    enabled: a.enabled,
  }));
}

export interface AccountUpdate {
  id: number;
  displayName: string | null;
  enabled: boolean;
}

export async function updateAccountsCore(updates: AccountUpdate[]): Promise<void> {
  for (const u of updates) {
    await db
      .update(accounts)
      .set({ displayName: u.displayName || null, enabled: u.enabled })
      .where(eq(accounts.id, u.id));
  }
}

export async function revokeConnectionCore(connectionId: number): Promise<void> {
  const [conn] = await db
    .select()
    .from(bankConnections)
    .where(eq(bankConnections.id, connectionId));
  if (!conn) throw new Error("Connexion introuvable.");

  const settings = await requireSettings();
  try {
    await ebApi(`/sessions/${conn.sessionId}`, appJwt(settings), { method: "DELETE" });
  } catch (err) {
    // Session déjà invalide côté Enable Banking : on marque quand même révoquée.
    console.warn(`⚠️  Révocation Enable Banking échouée (session déjà invalide ?) :`, err);
  }
  await db
    .update(bankConnections)
    .set({ status: "revoked" })
    .where(eq(bankConnections.id, connectionId));
}
