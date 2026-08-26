import type { AppRouter } from "./root";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

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
  OrphanBankGroup,
} from "./banking/connections";
export type { SetupStatus } from "./banking/settings";
export type { SyncOutcome } from "./banking/fetch-transactions";
export type { ConsentBadge } from "./banking/domain";
export type {
  MonthlyCategoryTotal,
  TransactionRow,
} from "./transactions/queries";
export type { CategoryOption, CategoryTreeNode } from "./categories/queries";
export type {
  IncomingInvitation,
  InvitationDetail,
  Space,
  SpaceInvitation,
  SpaceMember,
  SpaceRole,
} from "./spaces/queries";
