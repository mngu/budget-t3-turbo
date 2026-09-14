import type { Auth } from "@budget/auth";

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z, ZodError } from "zod/v4";

import { and, eq } from "@budget/db";
import { db } from "@budget/db/client";
import { member } from "@budget/db/schema";

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
  return { session, headers: opts.headers };
};

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

export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: { ...ctx.session, user: ctx.session.user } },
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
  return next({ ctx: { organizationId } });
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
