import { createFileRoute } from "@tanstack/react-router";

import { auth } from "~/auth/server";
import { corsPreflight, withCors } from "~/lib/cors";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        withCors(request, await auth.handler(request)),
      POST: async ({ request }) =>
        withCors(request, await auth.handler(request)),
      OPTIONS: ({ request }) => corsPreflight(request),
    },
  },
});
