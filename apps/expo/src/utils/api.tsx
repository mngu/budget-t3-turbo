import { Platform } from "react-native";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";

import type { AppRouter } from "@budget/api";

import { authClient } from "./auth";
import { getBaseUrl } from "./base-url";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // ...
    },
  },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    loggerLink({
      enabled: (opts) =>
        process.env.NODE_ENV === "development" ||
        (opts.direction === "down" && opts.result instanceof Error),
      colorMode: "ansi",
    }),
    httpBatchLink({
      transformer: superjson,
      url: `${getBaseUrl()}/api/trpc`,
      // Sur web, le header Cookie est interdit par le navigateur : la session
      // passe par les cookies natifs, envoyés cross-origin via credentials
      // "include". Sur natif, pas de cookie jar fiable : on lit le cookie
      // stocké par le plugin expo de better-auth et on l'envoie à la main.
      fetch:
        Platform.OS === "web"
          ? (url, options) => fetch(url, { ...options, credentials: "include" })
          : undefined,
      headers() {
        const headers = new Map<string, string>();
        headers.set("x-trpc-source", "expo-react");

        if (Platform.OS !== "web") {
          const cookies = authClient.getCookie();
          if (cookies) {
            headers.set("Cookie", cookies);
          }
        }
        return headers;
      },
    }),
  ],
});

/**
 * A set of typesafe hooks for consuming your API.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

export type { RouterInputs, RouterOutputs } from "@budget/api";
