import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppHeader } from "./_revue/-components/app-header";

/**
 * Coque des quatre écrans de la revue (revue du mois, « À revoir », zoom
 * catégorie, table complète) : en-tête persistant, hauteur fixée au viewport,
 * chaque volet scrollant pour son compte.
 *
 * Seuls la période, la recherche et le filtre de comptes vivent dans l'en-tête —
 * ils ont un sens sur les quatre écrans. Les filtres de contenu (sens,
 * catégorie, à classer) sont posés par chaque écran, via sa propre barre
 * « Affiner » : la revue les subirait sans pouvoir les commander, filtrer une
 * catégorie la portant à 100 % de sa propre répartition.
 *
 * Layout sans segment d'URL : `/`, `/transactions`, `/classer` et
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
      <Outlet />
    </div>
  );
}
