import type { AppRouter } from "@budget/api";

import { focusManager, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { AppState } from "react-native";
import SuperJSON from "superjson";

import { API_URL, authClient } from "./auth";

export const queryClient = new QueryClient();

// React Native has no window focus: coming back to the app plays that role.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener("change", (state) =>
    setFocused(state === "active"),
  );
  return () => subscription.remove();
});

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
