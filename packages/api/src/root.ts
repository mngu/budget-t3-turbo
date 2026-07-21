import { authRouter } from "./router/auth";
import { categoriesRouter } from "./router/categories";
import { connectionsRouter } from "./router/connections";
import { settingsRouter } from "./router/settings";
import { syncRouter } from "./router/sync";
import { transactionsRouter } from "./router/transactions";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  categories: categoriesRouter,
  connections: connectionsRouter,
  settings: settingsRouter,
  sync: syncRouter,
  transactions: transactionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
