import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useSyncExternalStore } from "react";

// Lazy-mount the ring only on desktop so mobile never downloads Three.js.
const Ring = lazy(() => import("./-components/ring"));

// Match Tailwind's md breakpoint; a false server snapshot avoids hydration mismatches.
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
