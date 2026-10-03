import type { AppRouter } from "@budget/api";
import type { NavigateOptions, ToOptions } from "@tanstack/react-router";
import type { TRPCClient } from "@trpc/client";
import type * as React from "react";

import { I18nProvider, RouterProvider, Toast } from "@heroui/react";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ThemeProvider } from "@budget/ui/theme";

import appCss from "~/styles.css?url";

export const Route = createRootRouteWithContext<{
  trpcClient: TRPCClient<AppRouter>;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jar" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
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

// HeroUI links and menu items take TanStack Router destinations and navigate client-side.
declare module "react-aria-components" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <ThemeProvider>
      <html lang="fr" suppressHydrationWarning>
        <head>
          <HeadContent />
        </head>
        <body className="bg-background text-foreground min-h-screen font-sans antialiased">
          <I18nProvider locale="fr-FR">
            <RouterProvider
              navigate={(to, options) => router.navigate({ to, ...options })}
              useHref={(to) => router.buildLocation({ to }).href}
            >
              {children}
              <Toast.Provider />
            </RouterProvider>
          </I18nProvider>
          <TanStackRouterDevtools position="bottom-right" />
          <Scripts />
        </body>
      </html>
    </ThemeProvider>
  );
}
