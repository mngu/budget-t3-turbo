import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@budget/api";
import { auth } from "~/auth/server";
import { corsPreflight, withCors } from "~/lib/cors";

const handler = (req: Request) => {
  // Direct requests have no proxy header. Forward the socket IP so bank sync
  // can identify user-present access, exempt from unattended PSD2 quotas.
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
