import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useSyncExternalStore } from "react";

/**
 * `/` sur bureau, c'est l'anneau ; sur téléphone, c'est la colonne des postes
 * que le layout rend déjà, et l'écran n'a rien à ajouter. L'anneau est donc
 * caché sous `md` par le CSS (premier rendu identique au SSR) **et** non monté
 * (`matchMedia`, lu après hydratation) : three.js ne part pas sur un téléphone
 * qui ne l'affichera pas.
 */
const Ring = lazy(() => import("./-components/ring"));

// 48rem = `md` de Tailwind v4. Instantané serveur à `false` : le serveur ne
// rend jamais l'anneau, le client le monte après hydratation si la fenêtre
// est assez large, sans divergence de balisage.
const desktop =
  typeof window === "undefined"
    ? null
    : window.matchMedia("(min-width: 48rem)");
const useDesktop = () =>
  useSyncExternalStore(
    (onChange) => {
      desktop?.addEventListener("change", onChange);
      return () => desktop?.removeEventListener("change", onChange);
    },
    () => desktop?.matches ?? false,
    () => false,
  );

export const Route = createFileRoute("/_authed/_period-overview/")({
  component: RouteComponent,
});

function RouteComponent() {
  const isDesktop = useDesktop();
  return (
    <div className="hidden min-h-0 flex-1 flex-col md:flex">
      {isDesktop && (
        <Suspense>
          <Ring />
        </Suspense>
      )}
    </div>
  );
}
