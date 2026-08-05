// Envoi d'emails — le strict minimum, et un seul usage aujourd'hui :
// l'invitation à un espace.
//
// Pas de dépendance ni de gabarit : un POST à l'API Resend suffit, et le corps
// est du texte. Sans `RESEND_API_KEY`, le lien est écrit dans les logs serveur
// plutôt que perdu — c'est ce qui permet d'installer et de tester l'app avant
// d'avoir un domaine d'envoi, sans jamais laisser croire qu'un email est parti.

interface Mail {
  to: string;
  subject: string;
  text: string;
}

async function send(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
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

/**
 * L'URL publique de l'app, base des liens envoyés par email. `AUTH_URL` est
 * déjà l'origine que better-auth sert ; s'en servir évite une seconde variable
 * qui pourrait la contredire.
 */
function appUrl(): string {
  return process.env.AUTH_URL ?? "http://localhost:3000";
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
