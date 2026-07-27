import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "./_revue/-components/app-header";
import { FilterBar } from "./_revue/-components/filter-bar";

/**
 * Coque des quatre écrans de la revue (revue du mois, ventilation, zoom
 * catégorie, table complète) : en-tête et barre de filtres persistants,
 * hauteur fixée au viewport, chaque volet scrollant pour son compte.
 *
 * Layout sans segment d'URL : `/`, `/transactions`, `/ventiler` et
 * `/categorie/$name` restent à la racine. `/banques` et `/categories` sont
 * volontairement en dehors — la barre de filtres n'y voudrait rien dire.
 */
export const Route = createFileRoute("/_authed/_revue")({
  component: RevueLayout,
});

function RevueLayout() {
  return (
    // text-[13px] : la base typographique de la maquette. Les tailles fines
    // (11–12,5 px) sont posées au cas par cas, jamais héritées d'un rem global
    // qui décalerait aussi /banques et /categories.
    <div className="flex h-dvh flex-col overflow-hidden text-[13px] leading-[1.45]">
      <AppHeader />
      <FilterBar />
      <Outlet />
    </div>
  );
}
