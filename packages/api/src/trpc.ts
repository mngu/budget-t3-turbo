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
  // Exposing authApi here exceeds TypeScript's declaration serialization limit.
  return { session, headers: opts.headers };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    const zodError =
      error.cause instanceof ZodError
        ? (error.cause as ZodError<Record<string, unknown>>)
        : null;
    return {
      ...shape,
      // Clients show the message as is: one readable sentence, not the issue dump.
      message: zodError?.issues[0]?.message ?? shape.message,
      data: {
        ...shape.data,
        zodError: zodError && z.flattenError(zodError),
      },
    };
  },
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

// Resolve scope from the session and recheck membership on every request so
// removal takes effect immediately. Services must scope their queries to this ID.
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

// Enable Banking credentials are installation-wide, so space ownership is insufficient.
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.session.user.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Réservé à l'administrateur de l'installation.",
    });
  }
  return next();
});
