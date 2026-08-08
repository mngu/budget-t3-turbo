import { createEnv } from "@t3-oss/env-core";
import { z } from "zod/v4";

export function authEnv() {
  return createEnv({
    server: {
      AUTH_SECRET:
        process.env.NODE_ENV === "production"
          ? z.string().min(1)
          : z.string().min(1).optional(),
      NODE_ENV: z.enum(["development", "production"]).optional(),
      // Envoi d'emails (vérification d'adresse, invitations). Optionnels : sans
      // eux, `src/email.ts` écrit le lien dans les logs serveur au lieu de
      // l'envoyer — ce qui permet d'installer l'app avant d'avoir un domaine
      // d'envoi. Attention : l'inscription exigeant la confirmation de
      // l'adresse, une installation sans ces variables ne laisse entrer que
      // celui qui lit les logs.
      RESEND_API_KEY: z.string().min(1).optional(),
      EMAIL_FROM: z.string().min(1).optional(),
      // Origine publique du déploiement, et base des liens envoyés par email.
      // Déclarée ici plutôt que dans l'app parce que `src/email.ts` en a besoin
      // et que l'app hérite d'`authEnv()` : une seconde variable ne pourrait
      // que contredire celle-ci. Sur Vercel elle se déduit des variables de la
      // plateforme ; sur un VPS rien ne la donne, et sans elle better-auth pose
      // ses cookies sur localhost et les liens de confirmation y renvoient.
      SITE_URL: z.url().optional(),
    },
    runtimeEnv: process.env,
    // Un `.env` porte souvent la clé sans valeur (`SITE_URL=`) : sans ça, zod
    // la voit comme une chaîne vide et non comme absente, et un optionnel
    // devient une erreur de démarrage.
    emptyStringAsUndefined: true,
    skipValidation:
      !!process.env.CI || process.env.npm_lifecycle_event === "lint",
  });
}
