import type { ReactNode } from "react";
import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/settings")({
  component: SettingsLayout,
});

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    aside?: () => ReactNode;
  }
}

function SettingsLayout() {
  const staticData = useMatches({
    select: (m) => m.findLast((x) => x.staticData.title)?.staticData,
  });
  const { title, aside: Aside } = staticData ?? {};
  return (
    <main className="mx-auto w-250 px-6 pt-5 pb-12">
      <div className="flex items-center">
        <h1 className="text-title">{title}</h1>
        {Aside && <Aside />}
      </div>
      <Outlet />
    </main>
  );
}
