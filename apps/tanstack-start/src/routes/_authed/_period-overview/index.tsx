import { useEffect } from "react";
import { createFileRoute, useLoaderData } from "@tanstack/react-router";

import type { RingSlice } from "./-components/category-ring";
import { CategoryIcon } from "~/component/category-icon";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro0, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryRing, RingBackButton } from "./-components/category-ring";
import { useDrill } from "./-components/use-drill";
import { breakdownLevel } from "./-lib/breakdown";

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
export const Route = createFileRoute("/_authed/_period-overview/")({
  component: PeriodOverview,
});

function PeriodOverview() {
  // Les agrégats sont ceux du layout : l'anneau et la colonne des postes lisent
  // la même répartition, elle n'a pas à être chargée deux fois.
  const { breakdownByCategories } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  const resolveColor = useCategoryColor();
  const { search, setSearch } = useRevueSearch();

  // Le forage : replier l'anneau, changer de niveau, le déplier. Il guette la
  // search entière parce que le niveau tient au poste ouvert **et** à la
  // période — un changement de mois joue donc la même animation qu'un clic sur
  // un poste, c'est la seule de l'anneau. Voir `useDrill`.
  const drill = useDrill(search, breakdownByCategories);

  const clear = () => {
    // Ne naviguer que s'il y a un filtre à retirer : `setSearch` relance le
    // loader de la route, et Échap est *aussi* la touche qui referme les
    // popovers de l'en-tête — sans cette garde, chaque fermeture de sélecteur
    // rejouerait les agrégats de l'écran pour rien.
    if (search.category === undefined) return;
    setSearch({ category: undefined });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Le niveau affiché est une fonction pure du search param — aucun état local
  // ne le double. Filtrer une parente y descend, filtrer une de ses
  // sous-catégories descend dans la parente (sinon l'arc surligné ne serait pas
  // à l'écran), et c'est ce qui rend une URL partagée fidèle à ce qu'elle
  // montrait.
  //
  // Un poste **sans sous-catégorie** (« Sans catégorie », et toute parente dont
  // la base n'a pas de feuille) reste au niveau des parents : il n'a rien à
  // montrer au niveau du dessous, l'anneau y serait vide et le seul moyen d'en
  // ressortir serait le bouton du centre. Le bandeau, lui, continue de le
  // nommer — sur `/transactions` c'est un filtre parfaitement légitime.
  const level = breakdownLevel(breakdownByCategories, search.category);
  const selected = level.parent;
  const selectedColor = selected ? resolveColor(selected.color) : "";

  // Une sous-catégorie n'a pas de couleur propre à l'écran : c'est un palier de
  // la teinte de son parent, du plus dense au plus proche de la surface — même
  // convention que les barres de la revue.
  const slices: RingSlice[] = level.slices.map((slice, index) => ({
    name: slice.name,
    total: slice.total,
    color: selected
      ? shadeCategoryColor(selectedColor, index, level.slices.length)
      : resolveColor(slice.color),
    icon: slice.icon,
  }));

  // Sous-catégorie surlignée. Au niveau des parents rien ne l'est jamais : les
  // deux gestes qui désignent un poste y descendent, il n'y a donc plus d'état
  // « en avant parmi ses pairs ».
  //
  // Le param prime toujours ; le segment « À classer », qu'aucun filtre ne
  // désigne, ne se surligne qu'à défaut et seulement tant que le filtre est
  // resté sur la parente — sans quoi retirer le filtre depuis le rappel
  // laisserait un arc surligné que plus rien dans l'URL ne justifie.
  const byParam = level.slices.findIndex(
    (s) => !s.unallocated && s.filter === search.category,
  );
  const activeIndex =
    byParam >= 0
      ? byParam
      : selected && search.category === selected.filter
        ? level.slices.findIndex((s) => s.unallocated)
        : -1;

  return (
    // Fragment, comme `/transactions` : la colonne des postes est une **sœur**
    // de la colonne [fil d'ariane + anneau] et non sa cadette. Le fil d'ariane
    // ne coiffe donc que l'anneau, qu'il nomme, et la colonne récupère sa
    // hauteur — c'est le `ch - 41` que la maquette retranche au diamètre de
    // l'anneau, et lui seul.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* L'anneau s'étire sur toute la place disponible (pas d'`items-center`) :
          c'est de là qu'il tire sa taille, sa boîte carrée étant en confinement
          de taille — centrée dans un conteneur à dimension automatique, elle
          s'effondrerait à zéro. */}
      <div className="relative mt-3 flex min-h-0 min-w-0 flex-1">
        <CategoryRing
          slices={slices}
          activeIndex={activeIndex >= 0 ? activeIndex : null}
          drill={drill}
          // Les arcs sont dans l'ordre de `level.slices`, dont `slices` est le
          // calque : l'index désigne la même part des deux côtés.
          // Au niveau des parents, l'arc fait exactement ce que fait la ligne
          // de la colonne : il descend. Les deux désignent le même poste, ils
          // ne peuvent pas répondre différemment. Un poste sans sous-catégorie
          // n'ouvre aucun niveau et ne répond donc pas.
          //
          // Au niveau des sous-catégories, en revanche, **rien** ne répond au
          // clic : l'anneau y est en lecture seule, comme la colonne. Le
          // surlignage d'une sous-catégorie ne s'y pose donc plus que par
          // l'URL (`search.category`, en revenant de `/transactions`).
          onActivate={
            selected
              ? undefined
              : (index) => {
                  const slice = level.slices[index];
                  if (slice?.drillable)
                    setSearch({ category: slice.filter });
                }
          }
        >
          {/* Le centre nomme l'arc mis en avant, à défaut le niveau lui-même.
              L'icône vient de la part (`null` sur une sous-catégorie, elles
              n'en ont pas) — au niveau des parents, `slices` porte déjà celle
              de la catégorie. */}
          {(focus) => {
            const name = focus?.name ?? selected?.name;
            const icon = focus ? focus.icon : (selected?.icon ?? null);
            return (
              <>
                {icon !== null && (
                  <span className="mb-2">
                    <CategoryIcon
                      name={icon}
                      className="size-5"
                      color={
                        focus ? focus.color : selectedColor || "var(--subtle)"
                      }
                    />
                  </span>
                )}
                {name && (
                  <div className="text-control mb-1 max-w-full truncate font-semibold tracking-[-0.015em]">
                    {name}
                  </div>
                )}
                <div className="num text-title leading-none font-medium tracking-[-0.03em]">
                  {euro0.format(focus?.total ?? level.total)}
                </div>
                <div className="label-caps mt-1 whitespace-nowrap">
                  {focus
                    ? `${sharePercent(focus.total, level.total)} ${selected ? "du poste" : "du total"}`
                    : selected
                      ? `${sharePercent(level.total, level.expenses)} du total`
                      : "Sorties"}
                </div>
                {/* Troisième voie de sortie, avec Échap et le clic à côté : la
                    maquette l'a ajoutée parce que les deux autres ne
                    s'annoncent nulle part. Ne pas en supprimer une en croyant
                    les autres suffisantes. */}
                {selected && <RingBackButton onClick={clear} />}
              </>
            );
          }}
        </CategoryRing>
      </div>
    </div>
  );
}
