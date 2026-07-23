import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@budget/api";

import { auth } from "~/auth/server";
import { corsPreflight, withCors } from "~/lib/cors";

const handler = (req: Request) => {
  // Sync déclenché depuis l'app : sync.ts classe l'accès « PSU présent » côté
  // banque (exempté du quota PSD2 des accès non-assistés, ~4/jour) à partir du
  // header x-forwarded-for. En accès direct (ex. localhost), il n'y a pas de
  // proxy donc pas de x-forwarded-for : on complète avec l'IP socket résolue
  // par TanStack pour ne pas perdre ce classement.
  const headers = new Headers(req.headers);
  if (!headers.has("x-forwarded-for")) {
    const ip = getRequestIP({ xForwardedFor: true });
    if (ip) headers.set("x-forwarded-for", ip);
  }

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req,
    createContext: () =>
      createTRPCContext({
        auth: auth,
        headers,
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });
};

export const Route = createFileRoute("/api/trpc/$")({
  server: {
    handlers: {
      GET: async ({ request }) => withCors(request, await handler(request)),
      POST: async ({ request }) => withCors(request, await handler(request)),
      OPTIONS: ({ request }) => corsPreflight(request),
    },
  },
});
