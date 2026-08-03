import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";

import type { HeaderPage } from "~/component/app-header";
import { AppHeader } from "~/component/app-header";

/**
 * Coque des écrans de la revue (revue du mois, table complète, « À revoir »,
 * zoom catégorie) : en-tête persistant, hauteur fixée au viewport, chaque volet
 * scrollant pour son compte.
 *
 * Seuls la période et le filtre de comptes vivent dans l'en-tête — ils ont un
 * sens sur tous ces écrans. Les filtres de contenu (sens, catégorie, à classer,
 * et depuis le portage du nouvel en-tête la recherche) sont posés par chaque
 * écran, via sa propre barre « Affiner » : la revue les subirait sans pouvoir
 * les commander, filtrer une catégorie la portant à 100 % de sa répartition.
 *
 * Layout sans segment d'URL : `/`, `/transactions`, `/classer` et
 * `/categorie/$name` restent à la racine. `/banques` et `/categories` sont
 * volontairement en dehors — leur search n'est pas `transactionsSearchSchema` —
 * mais montent désormais le *même* en-tête, avec un autre `page`.
 */
export const Route = createFileRoute("/_authed/_revue")({
  component: RevueLayout,
});

// Seules les deux routes qu'une icône désigne s'allument. `/classer` et
// `/categorie/$name` n'en ont pas, la rangée étant réduite à deux entrées :
// elles gardent l'en-tête complet, sans rien de surligné.
//
// Lecture du pathname et non `useMatchRoute` : celui-ci compare aussi la search
// et renvoyait `false` sur `/?dateFrom=…`, laissant l'icône éteinte sur sa
// propre page — un échec silencieux, sans erreur ni type qui l'attrape.
//
// Rançon de ce choix : ces chemins doivent suivre à la lettre les `to` des deux
// `NavIcon` d'`AppHeader`, et rien ne le vérifie. Renommer une des deux routes
// sans toucher ici éteint l'icône, silencieusement là encore.
const PAGE_BY_PATH: Record<string, HeaderPage> = {
  "/": "revue",
  "/transactions": "transactions",
};

function RevueLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const page = PAGE_BY_PATH[pathname.replace(/\/$/, "") || "/"];

  return (
    // text-[13px] : la base typographique de la maquette. Les tailles fines
    // (11–12,5 px) sont posées au cas par cas, jamais héritées d'un rem global
    // qui décalerait aussi /banques et /categories.
    <div className="flex h-dvh flex-col overflow-hidden text-[13px] leading-[1.45]">
      <AppHeader page={page} />
      <Outlet />
    </div>
  );
}
