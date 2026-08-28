import type { AppRouter } from "@budget/api";
import type { TRPCClient } from "@trpc/client";
import type * as React from "react";

import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@budget/ui/theme";
import { Toaster } from "@budget/ui/toast";
import { TooltipProvider } from "@budget/ui/tooltip";

import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{
  trpcClient: TRPCClient<AppRouter>;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Budget Tracker" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <html lang="fr" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="bg-background text-foreground min-h-screen font-sans antialiased">
          {/* Monté une fois : le provider partage le délai et n'ouvre qu'une
              infobulle à la fois. */}
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  );
}
