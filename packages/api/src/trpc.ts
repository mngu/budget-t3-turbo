import type { Auth } from "@budget/auth";

/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import { and, eq } from "@budget/db";
import { db } from "@budget/db/client";
import { member } from "@budget/db/schema";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */

export const createTRPCContext = async (opts: {
  headers: Headers;
  auth: Auth;
}) => {
  const session = await opts.auth.api.getSession({
    headers: opts.headers,
  });
  // `authApi` n'est volontairement **pas** exposé dans le contexte : aucune
  // procédure ne s'en sert, et depuis le plugin `organization` son type est
  // assez gros pour que `tsc` renonce à sérialiser celui d'`appRouter`
  // (« inferred type … exceeds the maximum length »), ce qui casse le build de
  // déclarations du package.
  return {
    session,
    db,
    headers: opts.headers,
  };
};
/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError:
        error.cause instanceof ZodError
          ? z.flattenError(error.cause as ZodError<Record<string, unknown>>)
          : null,
    },
  }),
});

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      // infers the `session` as non-nullable
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Procédure d'espace — **le point de passage unique du cloisonnement**.
 *
 * Elle résout l'espace courant et le met dans le contexte ; chaque service le
 * reçoit ensuite en premier paramètre et le pose dans son `WHERE`. L'id
 * d'espace vient de la **session** (`activeOrganizationId`, posé par le plugin
 * organization) et jamais d'un input : un espace choisi par le client serait
 * une autorisation accordée par le client.
 *
 * L'appartenance est revérifiée à chaque requête plutôt qu'au moment du
 * `setActive` : une exclusion de l'espace doit prendre effet sans attendre que
 * la session expire.
 */
export const orgProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const organizationId = ctx.session.session.activeOrganizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Aucun espace actif pour cette session.",
    });
  }
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, ctx.session.user.id),
      ),
    )
    .limit(1);
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous n'êtes pas membre de cet espace.",
    });
  }
  return next({ ctx: { organizationId, memberRole: membership.role } });
});

/**
 * Réservée à la configuration Enable Banking, qui est celle de
 * l'*installation* : `settings.save` écrase l'application_id et la clé privée
 * pour tout le monde. Sans cette garde, n'importe quel utilisateur invité
 * pourrait détourner les connexions bancaires de tous les espaces.
 *
 * `is_admin` se pose à la main en base — il n'y a pas d'écran pour l'accorder,
 * et c'est voulu.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.user.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Réservé à l'administrateur de l'installation.",
    });
  }
  return next();
});
