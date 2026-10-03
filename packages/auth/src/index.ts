import type { BetterAuthOptions, BetterAuthPlugin } from "better-auth";

import { randomUUID } from "node:crypto";

import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, organization } from "better-auth/plugins";

import { eq } from "@budget/db";
import { db } from "@budget/db/client";
import { member, organization as orgTable } from "@budget/db/schema";

import { sendMagicLinkEmail } from "./email";

const MAGIC_LINK_MINUTES = 15;
// Must match the scheme in apps/expo/app.json.
const MOBILE_ORIGIN = "jar://";

export const slugify = (name: string) =>
  `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${randomUUID().slice(0, 8)}`;

// Every new user needs a space before orgProcedure can authorize requests,
// including invitees who have not yet accepted their invitation.
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
    slug: slugify(label),
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

export function initAuth(options: {
  baseUrl: string;
  secret: string | undefined;
  extraPlugins?: BetterAuthPlugin[];
  trustedOrigins?: string[];
}) {
  const config = {
    database: drizzleAdapter(db, {
      provider: "pg",
    }),
    baseURL: options.baseUrl,
    secret: options.secret,
    user: {
      additionalFields: {
        // Installation admins are granted manually, never through user input.
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
      // Magic links prove email ownership, required before exposing incoming invitations.
      magicLink({
        // Allow time to open the email on another device.
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
              // Member count cannot distinguish a personal space from a new shared one.
              isPersonal: {
                type: "boolean",
                defaultValue: false,
                input: false,
              },
            },
          },
        },
      }),
      // Hands the session to the mobile app when a magic link redirects to its scheme.
      expo(),
      ...(options.extraPlugins ?? []),
    ],
    trustedOrigins: [MOBILE_ORIGIN, ...(options.trustedOrigins ?? [])],
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
