import type { AppRouter } from "@budget/api";

import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import SuperJSON from "superjson";

import { API_URL, authClient } from "./auth";

export const queryClient = new QueryClient();

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    // React Native's fetch cannot read a streamed body.
    httpBatchLink({
      transformer: SuperJSON,
      url: `${API_URL}/api/trpc`,
      async headers() {
        return {
          "x-trpc-source": "expo",
          cookie: await authClient.getCookie(),
        };
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  queryClient,
  client: trpcClient,
});
