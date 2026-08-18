import {
  createFileRoute,
  Outlet,
  redirect,
  useMatches,
} from "@tanstack/react-router";

import { AppHeader } from "~/component/app-header";

// Toutes les routes de l'app vivent sous ce layout sans segment d'URL :
// session obligatoire, sinon redirection vers /login.
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.trpcClient.auth.getSession.query();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const title = useMatches({
    select: (m) => m.findLast((x) => x.staticData.title)?.staticData.title,
  });
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <AppHeader title={title} />
      <div className="flex flex-1 scrollbar-thin overflow-auto p-5">
        <Outlet />
      </div>
    </div>
  );
}
