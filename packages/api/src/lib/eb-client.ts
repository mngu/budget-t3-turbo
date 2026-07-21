// Accès à l'API Enable Banking : settings (DB), appels HTTP signés, cache ASPSPs.
import { db } from "@budget/db/client";
import { appSettings } from "@budget/db/schema";
import { makeJwt } from "./eb-domain";

const API = "https://api.enablebanking.com";

export class EbApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Non documenté par Enable Banking, mais relayé s'il apparaît un jour.
    public readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}

export interface EbSettings {
  applicationId: string;
  privateKeyPem: string;
  redirectUrl: string;
}

export async function loadSettings(): Promise<EbSettings | null> {
  const [row] = await db.select().from(appSettings).limit(1);
  return row ?? null;
}

export async function requireSettings(): Promise<EbSettings> {
  const settings = await loadSettings();
  if (!settings) {
    throw new Error(
      "Configuration Enable Banking manquante — complétez l'onboarding sur la page Banques.",
    );
  }
  return settings;
}

export function appJwt(settings: EbSettings): string {
  return makeJwt(settings.applicationId, settings.privateKeyPem);
}

export async function ebApi(path: string, jwt: string, init: RequestInit = {}): Promise<any> {
  const resp = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!resp.ok) {
    const retryAfter = resp.headers.get("retry-after");
    if (retryAfter) {
      console.warn(`⚠️  Retry-After reçu de l'API Enable Banking : ${retryAfter} (${path})`);
    }
    throw new EbApiError(
      resp.status,
      `${init.method ?? "GET"} ${path} → ${resp.status} ${await resp.text()}${
        retryAfter ? ` (Retry-After : ${retryAfter})` : ""
      }`,
      retryAfter,
    );
  }
  return resp.json();
}

export interface Aspsp {
  name: string;
  country: string;
  logo: string | null;
  maximum_consent_validity?: number;
}

// La liste complète (~2700 banques) change rarement — cache mémoire 24 h.
let aspspsCache: { at: number; list: Aspsp[] } | null = null;

export async function getAllAspsps(jwt: string): Promise<Aspsp[]> {
  if (aspspsCache && Date.now() - aspspsCache.at < 24 * 3600 * 1000) {
    return aspspsCache.list;
  }
  const data = await ebApi("/aspsps", jwt);
  aspspsCache = {
    at: Date.now(),
    list: (data.aspsps ?? []).map((a: any) => ({
      name: a.name,
      country: a.country,
      logo: a.logo ?? null,
      maximum_consent_validity: a.maximum_consent_validity,
    })),
  };
  return aspspsCache.list;
}
