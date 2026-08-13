import type { ConnectionSummary } from "@budget/api";

import { dateFr } from "~/lib/format";

// Miroir de `CONSENT_DAYS` (@budget/api, banking/domain.ts). Il ne peut pas être
// importé : les imports app → @budget/api sont tous des `import type`, effacés à
// la compilation, et faire entrer une *valeur* ferait suivre @budget/db/pg dans
// le bundle client (même raison d'être que @budget/shared).
const CONSENT_WINDOW_DAYS = 180;

export type ConsentLevel = "ok" | "warning" | "expired" | "revoked";

export type ConsentTone = "ok" | "warn" | "bad";

/** Tailwind ne génère que les classes écrites en toutes lettres : les rôles de
 *  couleur de la maquette se traduisent par une table, pas par interpolation. */
/**
 * Variante de `Badge` / `Alert` correspondant à chaque ton. `bad` passe par
 * `destructive` : `--destructive` a exactement la valeur de `--bad`.
 */
export const TONE_VARIANT: Record<ConsentTone, "ok" | "warn" | "destructive"> =
  {
    ok: "ok",
    warn: "warn",
    bad: "destructive",
  };

export const CONSENT_TONE: Record<
  ConsentTone,
  { text: string; bg: string; border: string; fill: string }
> = {
  ok: {
    text: "text-ok",
    bg: "bg-ok-soft",
    border: "border-ok",
    fill: "bg-ok",
  },
  warn: {
    text: "text-warn",
    bg: "bg-warn-soft",
    border: "border-warn",
    fill: "bg-warn",
  },
  bad: {
    text: "text-bad",
    bg: "bg-bad-soft",
    border: "border-bad",
    fill: "bg-bad",
  },
};

export interface ConsentView {
  level: ConsentLevel;
  /** La synchronisation est menacée ou déjà arrêtée : la carte se met en avant. */
  critical: boolean;
  tone: ConsentTone;
  badge: string;
  meta: string;
  /** Part restante de la fenêtre de consentement, pour la barre de la carte. */
  pct: number;
}

/**
 * `ConnectionSummary.badge` renvoie `{ level: "expired" }` pour toute connexion
 * non active : une révoquée y est indiscernable d'une expirée. C'est `status`
 * qu'il faut lire en premier, sinon les deux copies de la maquette (« n'est plus
 * connectée » / « a été révoquée ») fusionnent en silence.
 */
export function consentView(connection: ConnectionSummary): ConsentView {
  const until = new Date(connection.validUntil);

  if (connection.status === "revoked") {
    return {
      level: "revoked",
      critical: true,
      tone: "bad",
      badge: "Révoqué",
      meta: "l'accès a été annulé chez votre banque",
      pct: 0,
    };
  }

  if (connection.status === "expired" || connection.badge.level === "expired") {
    return {
      level: "expired",
      critical: true,
      tone: "bad",
      badge: "Consentement expiré",
      meta: `depuis le ${dateFr.format(until)} · aucune transaction importée depuis`,
      pct: 0,
    };
  }

  const { daysLeft, level } = connection.badge;
  return {
    level: level === "warning" ? "warning" : "ok",
    critical: level === "warning",
    tone: level === "warning" ? "warn" : "ok",
    badge: `Expire dans ${daysLeft} j`,
    meta: `jusqu'au ${dateFr.format(until)}`,
    pct: Math.min(100, Math.round((daysLeft / CONSENT_WINDOW_DAYS) * 100)),
  };
}

export interface ConsentAlert {
  connection: ConnectionSummary;
  level: Exclude<ConsentLevel, "ok">;
  tone: Exclude<ConsentTone, "ok">;
  title: string;
  body: string;
  cta: string;
}

const URGENCY: Record<ConsentLevel, number> = {
  expired: 3,
  revoked: 2,
  warning: 1,
  ok: 0,
};

/**
 * Une seule bannière, pour la connexion la plus urgente : c'est un appel à
 * l'action, pas une liste — chaque carte porte déjà son propre état.
 */
export function consentAlert(
  connections: ConnectionSummary[],
): ConsentAlert | null {
  let worst: { connection: ConnectionSummary; view: ConsentView } | null = null;
  for (const connection of connections) {
    const view = consentView(connection);
    if (!worst || URGENCY[view.level] > URGENCY[worst.view.level]) {
      worst = { connection, view };
    }
  }
  if (!worst || worst.view.level === "ok") return null;

  const { connection, view } = worst;
  const name = connection.aspspName;
  const until = dateFr.format(new Date(connection.validUntil));

  if (view.level === "revoked") {
    return {
      connection,
      level: "revoked",
      tone: "bad",
      title: `${name} a été révoquée`,
      body: "Vous avez annulé cette autorisation. Les transactions déjà importées restent disponibles ; les nouvelles ne le sont plus.",
      cta: "Reconnecter",
    };
  }

  if (view.level === "expired") {
    return {
      connection,
      level: "expired",
      tone: "bad",
      title: `${name} n'est plus connectée`,
      body: `L'autorisation a expiré le ${until}. Aucune transaction n'a été importée depuis : réautoriser récupérera l'historique manquant.`,
      cta: "Réautoriser",
    };
  }

  return {
    connection,
    level: "warning",
    tone: "warn",
    title: `${name} doit être réautorisée avant le ${until}`,
    body: `L'autorisation arrive à échéance dans ${connection.badge.daysLeft} jours. Passé ce délai, les transactions cessent d'être importées sans message d'erreur — un mois de retard se rattrape mal.`,
    cta: "Réautoriser maintenant",
  };
}
