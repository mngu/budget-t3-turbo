// Email lives in auth to avoid an auth -> api dependency cycle.
// Missing credentials may log links in development, but must fail in production:
// email is the only login method, so reporting unsent mail as success locks users out.

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

function appUrl(): string {
  return authEnv().SITE_URL ?? "http://localhost:3000";
}

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
