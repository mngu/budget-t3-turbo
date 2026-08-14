import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import { RevuePanel } from "./-components/revue-panel";

/**
 * Revue du mois — portage de la maquette « Revue du mois épurée » (Claude
 * Design, projet fc13100e-7ea1-4dac-8d2f-6614e40a7209, importée le 2026-07-31).
 * Elle a vécu sur `/revue-epuree` jusqu'au 2026-08-03, date à laquelle elle a
 * *remplacé* l'ancienne revue (tuiles de synthèse + deux listes de catégories à
 * barres segmentées) : un anneau et une liste dépliable disent la même chose en
 * un écran, et les composants de l'ancienne ont été supprimés avec elle.
 *
 * L'écran se réduit à l'anneau : le bandeau de tête et la colonne des postes
 * sont montés par le layout `_revue`, qui porte aussi la search et le loader —
 * `/transactions` affiche exactement les mêmes.
 *
 * Trois branches de la maquette ne sont pas portées : elles y sont **mortes**,
 * pas oubliées. `mode` est fixé à `'anneau'` (tout le pavage/treemap et la
 * bascule des deux vues sont inatteignables), `sv` est fixé à `'liste'`, et le
 * booléen `montants` ne nourrit que les tuiles du pavage. `ecarts`,
 * `reviewCount` et `reviewDots` sont calculés dans le script mais jamais liés
 * au template — ce dernier n'a d'ailleurs aucun équivalent en base (pas de
 * score de confiance, voir CLAUDE.md).
 *
 * S'y est ajouté le 2026-08-04 le **halo derrière l'anneau** : `haloBg`
 * (dégradé conique des trois plus gros postes, radial une fois un poste ouvert)
 * et l'animation `@keyframes breathe` qui l'accompagnait sont calculés et
 * déclarés, mais aucun nœud du template ne les porte. Non portés pour la même
 * raison que les trois branches ci-dessus : morts dans la maquette, pas
 * oubliés ici.
 */
export const Route = createFileRoute("/_authed/_revue/")({
  component: RevueDuMois,
});

function RevueDuMois() {
  // Les agrégats sont ceux du layout : l'anneau et la colonne des postes lisent
  // la même répartition, elle n'a pas à être chargée deux fois.
  const { categories, expenses } = useLoaderData({
    from: "/_authed/_revue",
  });

  return <RevuePanel categories={categories} expenses={expenses} />;
}
