import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: number }
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { type AppRouter, appRouter } from "./root";
export { createTRPCContext } from "./trpc";
export type { RouterInputs, RouterOutputs };
export type {
  AccountSummary,
  AspspOption,
  ConnectionSummary,
} from "./lib/connections-core";
export type { SetupStatus } from "./lib/settings-core";
export type { SyncOutcome } from "./lib/eb-sync";
export type { ConsentBadge } from "./lib/eb-domain";
export type {
  CategoryBreakdownItem,
  TransactionRow,
} from "./router/transactions";
export type { CategoryOption } from "./router/categories";
