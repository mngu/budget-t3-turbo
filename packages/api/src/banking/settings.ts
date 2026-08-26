import type { EbSettings } from "./client";

// Onboarding Enable Banking : vérification de la configuration et sauvegarde.
// Source de vérité unique : la table app_settings (pas de fallback fichiers).
import { db } from "@budget/db/client";
import { appSettings } from "@budget/db/schema";

import { ebApi, loadSettings } from "./client";
import { makeJwt } from "./domain";

export interface SetupStatus {
  configured: boolean;
  settingsPresent: boolean;
  apiOk: boolean;
  redirectUrlRegistered: boolean;
  applicationName: string | null;
  redirectUrl: string | null;
  error: string | null;
}

const NOT_CONFIGURED: SetupStatus = {
  configured: false,
  settingsPresent: false,
  apiOk: false,
  redirectUrlRegistered: false,
  applicationName: null,
  redirectUrl: null,
  error: null,
};

// La vérification appelle l'API Enable Banking : memo 1 h des statuts OK
// pour ne pas ralentir chaque chargement de la page Banques.
let statusCache: { at: number; status: SetupStatus } | null = null;
const STATUS_TTL_MS = 3600 * 1000;

function invalidateSetupStatus(): void {
  statusCache = null;
}

async function checkSettings(settings: EbSettings): Promise<SetupStatus> {
  try {
    const jwt = makeJwt(settings.applicationId, settings.privateKeyPem);
    const app = await ebApi("/application", jwt);
    const registered = (app.redirect_urls ?? []).includes(settings.redirectUrl);
    return {
      configured: registered,
      settingsPresent: true,
      apiOk: true,
      redirectUrlRegistered: registered,
      applicationName: app.name ?? null,
      redirectUrl: settings.redirectUrl,
      error: registered
        ? null
        : `L'URL de redirection ${settings.redirectUrl} n'est pas enregistrée dans le Control Panel Enable Banking.`,
    };
  } catch (err) {
    return {
      configured: false,
      settingsPresent: true,
      apiOk: false,
      redirectUrlRegistered: false,
      applicationName: null,
      redirectUrl: settings.redirectUrl,
      error: `Impossible de valider la configuration auprès d'Enable Banking : ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

async function upsertSettings(settings: EbSettings): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: 1, ...settings })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { ...settings, updatedAt: new Date() },
    });
}

export async function getSetupStatus(): Promise<SetupStatus> {
  if (statusCache && Date.now() - statusCache.at < STATUS_TTL_MS)
    return statusCache.status;

  const settings = await loadSettings();
  if (!settings) return NOT_CONFIGURED;

  const status = await checkSettings(settings);
  // Seuls les statuts entièrement OK sont mémorisés : pendant la configuration,
  // l'utilisateur doit voir l'état frais à chaque tentative.
  if (status.configured) statusCache = { at: Date.now(), status };
  return status;
}

export async function saveSettings(input: EbSettings): Promise<SetupStatus> {
  try {
    makeJwt(input.applicationId, input.privateKeyPem);
  } catch {
    throw new Error("Clé privée invalide ou illisible (format PEM attendu).");
  }

  const status = await checkSettings(input);
  if (!status.apiOk) {
    throw new Error(status.error ?? "Validation Enable Banking échouée.");
  }

  await upsertSettings(input);
  invalidateSetupStatus();
  return status;
}
