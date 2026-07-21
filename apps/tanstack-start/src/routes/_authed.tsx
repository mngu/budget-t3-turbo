import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// Toutes les routes de l'app vivent sous ce layout sans segment d'URL :
// session obligatoire, sinon redirection vers /login.
export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.trpcClient.auth.getSession.query();
    if (!session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
