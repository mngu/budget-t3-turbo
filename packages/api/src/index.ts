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
  OrphanBankGroup,
} from "./banking/connections";
export type { SetupStatus } from "./banking/settings";
export type { SyncOutcome } from "./banking/fetch-transactions";
export type { ConsentBadge } from "./banking/domain";
export type {
  CategoryBreakdownDetail,
  CategoryBreakdownItem,
  MonthlyCategoryTotal,
  ReviewItem,
  ReviewReason,
  TransactionRow,
} from "./transactions/queries";
export type {
  CategoriesOverview,
  CategoryOption,
  CategoryOverviewNode,
  CategoryTreeNode,
} from "./categories/queries";
export type {
  CategorySuggestion,
  CategorySuggestionChild,
} from "./categories/suggestions/schema";
export type { ReplacePlan } from "./categories/suggestions/replace-plan";
export type {
  SuggestionsRun,
  SuggestionsStatus,
} from "./categories/suggestions/state";
export type { TxnForAnalysis } from "./categories/suggestions/analyze";
