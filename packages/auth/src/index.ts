import { randomUUID } from "node:crypto";
import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";

import { eq } from "@budget/db";
import { db } from "@budget/db/client";
import { member, organization as orgTable } from "@budget/db/schema";

import { sendMagicLinkEmail } from "./email";

/** Validité d'un lien de connexion. Annoncée dans l'email, à garder alignée. */
const MAGIC_LINK_MINUTES = 15;

/**
 * L'« espace » de l'app (un utilisateur seul, ou un foyer) est une organization
 * better-auth : le plugin apporte les tables organization/member/invitation, et
 * surtout `session.activeOrganizationId`, qui fait vivre l'espace courant dans
 * la session plutôt que dans l'URL — d'où l'absence de diff sur les routes.
 *
 * Tout ce qui est propre à un espace (comptes bancaires, catégories, et donc
 * transactions) porte son `organization_id` ; `app_settings`, credentials
 * Enable Banking de l'installation, reste hors espace.
 */

// Espace personnel créé à l'inscription. Sans lui, la session d'un nouvel
// utilisateur n'aurait aucun espace actif et l'app entière lui répondrait
// FORBIDDEN — y compris à un invité, dont l'adhésion n'est créée qu'à
// l'acceptation de l'invitation, donc après la création du compte.
async function createPersonalOrganization(newUser: {
  id: string;
  name: string;
  email: string;
}) {
  const organizationId = randomUUID();
  const label = newUser.name || (newUser.email.split("@")[0] ?? "Espace");
  await db.insert(orgTable).values({
    id: organizationId,
    name: label,
    isPersonal: true,
    // Le slug n'est affiché nulle part : le suffixe aléatoire évite d'avoir à
    // gérer les collisions sur une valeur que personne ne lit.
    slug: `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}`,
    createdAt: new Date(),
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId,
    userId: newUser.id,
    role: "owner",
    createdAt: new Date(),
  });
}

export function initAuth<
  TExtraPlugins extends BetterAuthPlugin[] = [],
>(options: {
  baseUrl: string;
  secret: string | undefined;
  extraPlugins?: TExtraPlugins;
  trustedOrigins?: string[];
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    // Pas de `emailAndPassword` : la seule voie d'entrée est le lien de
    // connexion, plus bas. Les mots de passe des comptes créés avant sont
    // restés en base (table `account`) et n'ont plus aucun appelant.
    user: {
      additionalFields: {
        // Configuration Enable Banking = celle de l'installation : seul un
        // admin peut l'écraser (voir `adminProcedure`). Faux par défaut,
        // posé à la main sur le compte propriétaire de l'instance.
        isAdmin: {
          type: "boolean",
          defaultValue: false,
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Inscription ouverte : n'importe qui peut créer un compte, et
          // repart avec son seul espace personnel. Une invitation ne donne
          // plus le droit d'exister, seulement l'adhésion à un espace partagé.
          after: createPersonalOrganization,
        },
      },
      session: {
        create: {
          before: async (newSession) => {
            const [membership] = await db
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, newSession.userId))
              .limit(1);
            return {
              data: {
                ...newSession,
                activeOrganizationId: membership?.organizationId,
              },
            };
          },
        },
      },
    },
    plugins: [
      // Connexion par lien, et rien d'autre. Le lien fait trois choses d'un
      // coup : il connecte, il inscrit si l'adresse est inconnue
      // (`disableSignUp` laissé à false — c'est l'inscription ouverte), et il
      // prouve l'adresse. Cette troisième est ce qui remplace la vérification
      // d'email supprimée avec les mots de passe : sans elle, `spaces.incoming`
      // montrerait les invitations d'une adresse qu'il suffirait de déclarer.
      magicLink({
        // 5 minutes par défaut, trop court pour un aller-retour par email
        // ouvert sur un téléphone.
        expiresIn: MAGIC_LINK_MINUTES * 60,
        sendMagicLink: ({ email, url }) =>
          sendMagicLinkEmail({
            to: email,
            url,
            minutes: MAGIC_LINK_MINUTES,
          }),
      }),
      organization({
        schema: {
          organization: {
            additionalFields: {
              // Un espace personnel ne se déduit pas de son nombre de membres :
              // un espace partagé dont on n'a encore invité personne lui
              // ressemblerait trait pour trait, alors qu'il ne se comporte pas
              // pareil (suppression, conversion). D'où le drapeau explicite.
              isPersonal: {
                type: "boolean",
                defaultValue: false,
                input: false,
              },
            },
          },
        },
      }),
      ...(options.extraPlugins ?? []),
    ],
    trustedOrigins: options.trustedOrigins ?? [],
    onAPIError: {
      onError(error, ctx) {
        console.error("BETTER AUTH API ERROR", error, ctx);
      },
    },
  } satisfies BetterAuthOptions;

  return betterAuth(config);
}

export { sendInvitationEmail } from "./email";

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
