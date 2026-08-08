// Envoi d'emails — le strict minimum, deux usages : le lien de connexion et
// l'invitation à un espace. Le module vit ici plutôt que dans `@budget/api`
// parce que le lien de connexion est déclenché par better-auth lui-même
// (plugin `magicLink`) et que la dépendance va api → auth : l'inverse serait
// un cycle.
//
// Pas de dépendance ni de gabarit : un POST à l'API Resend suffit, et le corps
// est du texte.
//
// **L'email est devenu le seul moyen de se connecter** (il n'y a plus de mot
// de passe) : une clé absente n'est plus une dégradation, c'est une app
// inaccessible. D'où les deux régimes de `send` — en développement le lien
// part dans les logs, ce qui suffit à travailler sans domaine d'envoi ; en
// production l'absence de clé lève, pour que l'écran de connexion ne puisse
// pas annoncer un email que personne n'a envoyé.

import { authEnv } from "../env";

interface Mail {
  to: string;
  subject: string;
  text: string;
}

async function send(mail: Mail): Promise<void> {
  const { RESEND_API_KEY: key, EMAIL_FROM: from, NODE_ENV } = authEnv();
  if (!key || !from) {
    if (NODE_ENV === "production") {
      throw new Error(
        "RESEND_API_KEY/EMAIL_FROM absents : impossible d'envoyer le lien.",
      );
    }
    console.warn(
      `✉️  RESEND_API_KEY/EMAIL_FROM absents — email non envoyé à ${mail.to}. Contenu :\n${mail.text}`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, ...mail }),
  });
  if (!response.ok) {
    throw new Error(
      `Envoi de l'email échoué (${response.status}) : ${await response.text()}`,
    );
  }
}

/** L'URL publique de l'app, base des liens envoyés par email. */
function appUrl(): string {
  return authEnv().SITE_URL ?? "http://localhost:3000";
}

/**
 * Le lien de connexion — l'unique voie d'entrée. Il vaut aussi inscription
 * (le plugin crée le compte si l'adresse est inconnue) et preuve d'adresse :
 * c'est ce qui referme, sans mécanisme séparé, le trou qu'ouvrirait sinon
 * `spaces.incoming`, où l'on verrait les invitations d'une adresse qu'on se
 * contenterait de déclarer.
 *
 * L'URL est fournie entière par better-auth : pas d'`appUrl()` ici.
 */
export async function sendMagicLinkEmail(input: {
  to: string;
  url: string;
  minutes: number;
}): Promise<void> {
  await send({
    to: input.to,
    subject: "Votre lien de connexion à Budget",
    text: [
      "Voici votre lien de connexion :",
      "",
      input.url,
      "",
      `Il est valable ${input.minutes} minutes et ne sert qu'une fois.`,
      "Si vous n'avez rien demandé, ignorez cet email — personne ne peut se",
      "connecter sans ouvrir ce lien.",
    ].join("\n"),
  });
}

export async function sendInvitationEmail(input: {
  to: string;
  invitationId: string;
  spaceName: string;
  invitedBy: string;
}): Promise<void> {
  const link = `${appUrl()}/invitation/${input.invitationId}`;
  await send({
    to: input.to,
    subject: `${input.invitedBy} vous invite dans l'espace « ${input.spaceName} »`,
    text: [
      `${input.invitedBy} vous invite à rejoindre l'espace « ${input.spaceName} » sur Budget.`,
      "",
      "En acceptant, vous verrez les comptes bancaires, les catégories et les",
      "transactions de cet espace, comme les autres membres.",
      "",
      link,
      "",
      "Ce lien est valable 7 jours et ne sert qu'une fois.",
    ].join("\n"),
  });
}
