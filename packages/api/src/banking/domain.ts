import { createSign } from "node:crypto";

import { CONSENT_DAYS } from "./schemas";

const CONSENT_WARNING_DAYS = 30;

export function makeJwt(
  applicationId: string,
  privateKeyPem: string,
  now = new Date(),
): string {
  const b64 = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const iat = Math.floor(now.getTime() / 1000);
  const header = b64({ typ: "JWT", alg: "RS256", kid: applicationId });
  const payload = b64({
    iss: "enablebanking.com",
    aud: "api.enablebanking.com",
    iat,
    exp: iat + 3600,
  });

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign(privateKeyPem).toString("base64url");

  return `${header}.${payload}.${signature}`;
}

export function clampValidUntil(
  maximumConsentValiditySeconds: number | null | undefined,
  now: Date,
): string {
  const wanted = CONSENT_DAYS * 24 * 3600;
  const seconds = maximumConsentValiditySeconds
    ? Math.min(wanted, maximumConsentValiditySeconds)
    : wanted;
  return new Date(now.getTime() + seconds * 1000).toISOString();
}

export interface ConsentBadge {
  level: "ok" | "warning" | "expired";
  daysLeft: number;
}

export function consentBadge(validUntil: Date, now: Date): ConsentBadge {
  const daysLeft = Math.ceil(
    (validUntil.getTime() - now.getTime()) / (24 * 3600 * 1000),
  );
  if (daysLeft <= 0) return { level: "expired", daysLeft: 0 };
  if (daysLeft <= CONSENT_WARNING_DAYS) return { level: "warning", daysLeft };
  return { level: "ok", daysLeft };
}

export interface DiscoveredAccount {
  uid: string;
  iban: string | null;
}

// Enable Banking may return either account UIDs or account objects.
export function parseSessionAccounts(
  raw: unknown[] | undefined,
): DiscoveredAccount[] {
  return (raw ?? []).flatMap((acc: any) => {
    const uid = typeof acc === "string" ? acc : acc?.uid;
    if (!uid) return [];
    const iban =
      typeof acc === "object" ? (acc?.account_id?.iban ?? null) : null;
    return [{ uid, iban }];
  });
}

export interface ExistingAccount {
  id: number;
  uid: string;
  iban: string | null;
}

export interface AccountReconciliation {
  updates: { id: number; uid: string }[];
  creates: DiscoveredAccount[];
}

// Account UIDs can change on renewal; prefer IBAN to preserve account continuity.
export function reconcileAccounts(
  existing: ExistingAccount[],
  discovered: DiscoveredAccount[],
): AccountReconciliation {
  const byIban = new Map(
    existing.filter((a) => a.iban).map((a) => [a.iban as string, a]),
  );
  const byUid = new Map(existing.map((a) => [a.uid, a]));

  const updates: AccountReconciliation["updates"] = [];
  const creates: DiscoveredAccount[] = [];

  for (const d of discovered) {
    const match = (d.iban ? byIban.get(d.iban) : undefined) ?? byUid.get(d.uid);
    if (match) updates.push({ id: match.id, uid: d.uid });
    else creates.push(d);
  }

  return { updates, creates };
}
