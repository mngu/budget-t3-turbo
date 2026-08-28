import { createRouter } from "@tanstack/react-router";

import { makeTRPCClient } from "~/lib/trpc";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const trpcClient = makeTRPCClient();

  return createRouter({
    routeTree,
    context: { trpcClient },
    defaultPreload: "intent",
  });
}
