import { createIsomorphicFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { getRequestHeaders } from "@tanstack/react-start/server";
import {
  createTRPCClient,
  httpBatchStreamLink,
  loggerLink,
  unstable_localLink,
} from "@trpc/client";
import SuperJSON from "superjson";

import * as Api from "@budget/api";
import { auth } from "~/auth/server";
import { getBaseUrl } from "~/lib/url";

export const makeTRPCClient = createIsomorphicFn()
  .server(() => {
    return createTRPCClient<Api.AppRouter>({
      links: [
        unstable_localLink({
          router: Api.appRouter,
          transformer: SuperJSON,
          createContext: () => {
            const headers = new Headers(getRequestHeaders());
            headers.set("x-trpc-source", "tanstack-start-server");
            return Api.createTRPCContext({ auth, headers });
          },
        }),
      ],
    });
  })
  .client(() => {
    return createTRPCClient<Api.AppRouter>({
      links: [
        loggerLink({
          enabled: (op) =>
            op.direction === "down" && op.result instanceof Error,
        }),
        httpBatchStreamLink({
          transformer: SuperJSON,
          url: getBaseUrl() + "/api/trpc",
          headers() {
            const headers = new Headers();
            headers.set("x-trpc-source", "tanstack-start-client");
            return headers;
          },
        }),
      ],
    });
  });

/**
 * Le client tRPC des composants. Il vit dans le contexte du routeur (voir
 * `router.tsx`), qui est le seul endroit où il est construit une fois par
 * requête — un singleton de module serait faux au SSR, où chaque rendu doit
 * porter les en-têtes de *sa* requête (`unstable_localLink`).
 *
 * Remplace le hook homonyme de `@trpc/tanstack-react-query`, supprimé avec
 * react-query : les lectures passent par les loaders, il ne restait de ce
 * package que ce hook.
 */
export function useTRPCClient() {
  return useRouter().options.context.trpcClient;
}
