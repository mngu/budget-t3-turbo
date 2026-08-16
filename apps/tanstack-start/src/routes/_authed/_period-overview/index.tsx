import { useEffect, useState } from "react";
import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { ArrowRightIcon, LayersIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { RingSlice } from "./-components/category-ring";
import type { RevueCategory } from "./-lib/revue-categories";
import { CategoryIcon } from "~/component/category-icon";
import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro0, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryRing } from "./-components/category-ring";
import { useDrill } from "./-components/use-drill";
import { focusedCategory } from "./-lib/revue-categories";

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
  const { categories, expenses } = useLoaderData({
    from: "/_authed/_period-overview",
  });

  const resolveColor = useCategoryColor();
  const { search, setSearch } = useRevueSearch();

  const [hover, setHover] = useState<number | null>(null);
  // Le forage : replier l'anneau, changer de niveau, le déplier. Il guette la
  // search entière parce que le niveau tient au poste ouvert **et** à la
  // période — un changement de mois joue donc la même animation qu'un clic sur
  // un poste, c'est la seule de l'anneau. Voir `useDrill`.
  const { phase, dir } = useDrill(search, categories);

  const clear = () => {
    setHover(null);
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
  const focused = focusedCategory(categories, search.category);
  const selected = focused?.subs.length ? focused : null;
  // Sous-catégorie surlignée. Le param prime toujours : le pense-bête local du
  // segment « À classer » ne vaut qu'à défaut, et seulement tant que le filtre
  // est resté sur la parente — sans quoi retirer le filtre depuis le rappel
  // laisserait un arc surligné que plus rien dans l'URL ne justifie.
  const subByParam =
    selected?.subs.find(
      (s) => s.filter !== null && s.filter === search.category,
    ) ?? null;
  const subSelected =
    subByParam ??
    (selected && search.category === selected.filter
      ? (selected.subs.find((s) => s.filter === null) ?? null)
      : null);
  const selectedColor = selected ? resolveColor(selected.color) : "";

  // Une sous-catégorie n'a pas de couleur propre à l'écran : c'est un palier de
  // la teinte de son parent, du plus dense au plus proche de la surface — même
  // convention que les barres de la revue.
  const slices: RingSlice[] = selected
    ? selected.subs.map((sub, index) => ({
        name: sub.name,
        total: sub.total,
        color: shadeCategoryColor(
          resolveColor(selected.color),
          index,
          selected.subs.length,
        ),
        icon: null,
      }))
    : categories.map((category) => ({
        name: category.name,
        total: category.total,
        color: resolveColor(category.color),
        icon: category.icon,
      }));

  const levelTotal = slices.reduce((acc, s) => acc + s.total, 0);
  // Au niveau des parents rien n'est jamais surligné : les deux gestes qui
  // désignent un poste y descendent (voir `descend`), il n'y a donc plus d'état
  // « en avant parmi ses pairs ». Descendu, c'est la sous-catégorie filtrée.
  const activeIndex = subSelected
    ? slices.findIndex((s) => s.name === subSelected.name)
    : -1;
  const focus =
    (hover !== null ? slices[hover] : null) ??
    (activeIndex >= 0 ? slices[activeIndex] : null) ??
    null;

  /**
   * Descendre dans un poste : l'unique geste du niveau des parents, partagé par
   * la ligne de la colonne **et** par l'arc. Les deux désignent la même chose,
   * ils font donc la même chose.
   */
  const descend = (category: RevueCategory) => {
    // Le survol est remis à zéro : son index désignerait une part de l'ancien
    // niveau.
    setHover(null);
    setSearch({ category: category.filter });
  };

  return (
    // Fragment, comme `/transactions` : la colonne des postes est une **sœur**
    // de la colonne [fil d'ariane + anneau] et non sa cadette. Le fil d'ariane
    // ne coiffe donc que l'anneau, qu'il nomme, et la colonne récupère sa
    // hauteur — c'est le `ch - 41` que la maquette retranche au diamètre de
    // l'anneau, et lui seul.
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Le fil d'ariane nomme le **niveau** que l'anneau affiche, et lui
            seul : mettre un arc en avant ne le déplace pas — c'est une
            position, pas une sélection. */}
      <div className="flex min-w-0 flex-none items-center gap-3">
        <span
          className={cn(
            "flex size-7 flex-none items-center justify-center rounded-lg",
            !selected && "bg-sunken text-subtle",
          )}
          style={
            selected
              ? {
                  background: softCategoryColor(selectedColor),
                  color: selectedColor,
                }
              : undefined
          }
        >
          {selected ? (
            <CategoryIcon name={selected.icon} className="size-4" />
          ) : (
            <LayersIcon className="size-4" aria-hidden />
          )}
        </span>
        <span className="text-heading min-w-0 truncate">
          {selected ? selected.name : "Toutes catégories"}
        </span>
        <span className="text-subtle text-control flex-none whitespace-nowrap">
          {selected
            ? `${selected.subs.length} sous-catégorie${selected.subs.length > 1 ? "s" : ""} · ${sharePercent(selected.total, expenses)} des sorties`
            : `${categories.length} poste${categories.length > 1 ? "s" : ""} de dépense`}
        </span>

        {/* Le passage à la table, à droite du fil d'ariane : la barre de
              l'application n'a plus de rangée de navigation, ce lien-ci est la
              voie vers `/transactions`. La search est conservée telle quelle —
              le poste ouvert arrive donc en filtre de l'autre côté. */}
        <Link
          to="/transactions"
          search={search}
          title="Ouvrir la liste des transactions"
          className="border-border bg-card text-muted-foreground hover:border-subtle hover:text-foreground hover:bg-accent text-control ml-auto flex h-7 flex-none items-center gap-1.5 rounded-full border pr-2 pl-3 font-medium whitespace-nowrap"
        >
          Voir les transactions
          <ArrowRightIcon className="text-subtle size-3.5" aria-hidden />
        </Link>
      </div>

      {/* L'anneau s'étire sur toute la place disponible (pas d'`items-center`) :
          c'est de là qu'il tire sa taille, sa boîte carrée étant en confinement
          de taille — centrée dans un conteneur à dimension automatique, elle
          s'effondrerait à zéro. */}
      <div className="relative mt-3 flex min-h-0 min-w-0 flex-1">
        <CategoryRing
          slices={slices}
          activeIndex={activeIndex >= 0 ? activeIndex : null}
          hoverIndex={hover}
          phase={phase}
          dir={dir}
          // Pas de survol pendant le forage : l'index désignerait une part de
          // l'anneau replié, et le centre nommerait un poste qui s'en va.
          onHover={(index) => {
            if (phase !== null && index !== null) return;
            setHover(index);
          }}
          // Les arcs sont dans l'ordre de `subs` / `categories`, dont `slices`
          // est le calque : l'index désigne la même part des deux côtés.
          onActivate={(index) => {
            // Au niveau des parents, l'arc fait exactement ce que fait la
            // ligne de la colonne : il descend. Les deux désignent le même
            // poste, ils ne peuvent pas répondre différemment.
            if (!selected) {
              const category = categories[index];
              if (category?.subs.length) descend(category);
              return;
            }
            const sub = selected.subs[index];
            if (!sub) return;
            if (sub.filter === null) {
              // Le filtre revient sur la parente : c'est ce que le segment
              // désigne de plus précis, et c'est aussi ce qui ancre le
              // pense-bête local (voir `subSelected`).
              setSearch({ category: selected.filter });
              return;
            }
            setSearch({
              category:
                search.category === sub.filter
                  ? // Retirer le surlignage d'une sous-catégorie ne remonte pas
                    // d'un cran : on est toujours *dans* le poste ouvert, et le
                    // filtre revient donc à lui, pas à rien.
                    selected.filter
                  : sub.filter,
            });
          }}
          center={{
            icon: focus
              ? selected
                ? null
                : (categories.find((c) => c.name === focus.name)?.icon ?? null)
              : (selected?.icon ?? null),
            iconColor: focus ? focus.color : selectedColor || "var(--subtle)",
            name: focus?.name ?? selected?.name ?? "",
            amount: euro0.format(focus?.total ?? selected?.total ?? levelTotal),
            label: focus
              ? `${sharePercent(focus.total, levelTotal)} ${selected ? "du poste" : "du total"}`
              : selected
                ? `${sharePercent(selected.total, expenses)} du total`
                : "Sorties",
            // Troisième voie de sortie, avec Échap et le clic à côté : la
            // maquette l'a ajoutée parce que les deux autres ne s'annoncent
            // nulle part. Ne pas en supprimer une en croyant les autres
            // suffisantes.
            onBack: selected ? clear : undefined,
          }}
        />
      </div>
    </div>
  );
}
