"use client";

import { useEffect, useState } from "react";
import { LayersIcon } from "lucide-react";

import { cn } from "@budget/ui";

import type { RingSlice } from "./category-ring";
import type { RevueBudgets } from "~/lib/revue-budgets";
import type { RevueCategory } from "~/lib/revue-categories";
import {
  shadeCategoryColor,
  softCategoryColor,
  useCategoryColor,
} from "~/lib/category-color";
import { euro0, sharePercent } from "~/lib/format";
import { focusedCategory } from "~/lib/revue-categories";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryIcon } from "../../categories/-components/category-icon";
import { BreakdownList, breakdownRows } from "./breakdown-list";
import { CategoryRing } from "./category-ring";
import { useDrill } from "./use-drill";

/**
 * L'anneau de la revue du mois, la colonne des postes à sa droite, et le fil
 * d'ariane qui les coiffe. Le bandeau de tête, lui, vit dans le layout `_revue`,
 * partagé avec `/transactions`.
 *
 * **Un seul geste au niveau des parents : descendre.** L'arc et la ligne de la
 * colonne désignent le même poste, ils font donc la même chose (`descend`) —
 * l'arc a eu un temps un rôle propre, « mettre en avant sans quitter le niveau
 * des parents », qui n'existe plus. Il n'en reste aucun état local : le niveau
 * affiché est `focusedCategory(search.category)`, la même expression que celle
 * dont le layout tire `KpiFocus`, si bien que le fil d'ariane, l'anneau et le
 * bandeau ne peuvent pas nommer trois postes différents.
 *
 * La colonne et le fil d'ariane restent montés ici et non dans le layout : leur
 * geste et leur intitulé ne valent que sur cet écran (sur `/transactions` la
 * ligne pose un filtre, elle ne fait rien descendre).
 *
 * L'anneau interne de sous-catégories de la maquette n'est pas porté : elle ne
 * l'affiche qu'*à la place* de la colonne, quand celle-ci ne tient plus en
 * largeur. Ici la colonne reste affichée, à droite de l'anneau.
 */
export function RevuePanel({
  categories,
  budgets,
  expenses,
}: {
  /** Postes de sortie, du plus gros au plus petit. */
  categories: RevueCategory[];
  /**
   * Comparaison au budget, telle que le loader du layout l'a tranchée. La
   * colonne des postes en tire ses jauges et son pied ; le bandeau, monté par le
   * layout, en tire sa rangée « Budget ».
   */
  budgets: RevueBudgets;
  /** Total des sorties de la période, dénominateur de la part affichée au centre. */
  expenses: number;
}) {
  const resolveColor = useCategoryColor();
  const { search, setSearch } = useRevueSearch();

  const [hover, setHover] = useState<number | null>(null);
  // Le forage : replier l'anneau, changer de niveau, le déplier. Il guette
  // `search.category` parce que c'est *lui* qui porte le niveau — voir `useDrill`.
  const { phase, dir, drill } = useDrill(search.category);
  // Le segment « À classer » n'a pas de filtre qui le désigne (voir
  // `RevueCategory.subs`) : son surlignage est le seul qui reste local.
  const [aClasserSel, setAClasserSel] = useState(false);

  const clear = () => {
    setHover(null);
    setAClasserSel(false);
    // Ne naviguer que s'il y a un filtre à retirer : `setSearch` relance le
    // loader de la route, et Échap est *aussi* la touche qui referme les
    // popovers de l'en-tête — sans cette garde, chaque fermeture de sélecteur
    // rejouerait les agrégats de l'écran pour rien.
    if (search.category === undefined) return;
    const remove = () => setSearch({ category: undefined });
    // Forer seulement s'il y a un niveau à quitter : sur un poste sans
    // sous-catégorie (voir `selected`) l'anneau ne bouge pas, animer le vide
    // ferait clignoter la répartition des parents pour rien.
    if (selected) drill(undefined, remove);
    else remove();
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
    (aClasserSel && selected && search.category === selected.filter
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
    setAClasserSel(false);
    drill(category.filter, () => setSearch({ category: category.filter }));
  };

  // Les lignes de la colonne. Au niveau des parents chacune est une porte
  // d'entrée vers ses enfants ; une fois descendu, elles sont en lecture seule —
  // c'est l'anneau qui surligne une sous-catégorie.
  // Une parente est « détaillée » quand ce sont ses sous-catégories qui portent
  // les montants. Rien à demander au serveur : si l'une d'elles a un budget,
  // c'est qu'elle l'est — et sinon elle se lit comme globale, exactement comme
  // `budgetSlots` en décide côté base.
  const budgetedSubs = selected
    ? selected.subs.filter((sub) => sub.budget !== null).length
    : 0;

  // La jauge est posée ici et non dans `breakdownRows`, comme le geste : celle-ci
  // reste la forme pure de la ligne, partagée avec `/transactions`, qui ne
  // compare rien et garde donc la barre de répartition.
  //
  // **Toutes** les lignes de la revue en reçoivent une, même sans budget et même
  // quand la comparaison est écartée : sans ça la colonne changerait de gabarit
  // le jour où le premier budget est saisi.
  const rows = breakdownRows(categories, selected, resolveColor).map(
    (row, index) => {
      // Les lignes suivent l'ordre de `selected.subs` / `categories` : l'index
      // désigne le même poste des deux côtés.
      const budget = selected
        ? subGauge(selected.subs[index], budgets.off !== null, budgetedSubs > 0)
        : categoryGauge(categories[index], budgets.off !== null);
      if (selected) return { ...row, budget };
      const category = categories[index];
      // Sans sous-catégorie, la ligne n'est pas une porte : elle reste
      // désactivée plutôt que d'ouvrir sur le vide (voir `selected`).
      if (!category?.subs.length) return { ...row, budget };
      return {
        ...row,
        budget,
        title: `Voir la répartition de « ${row.name} »`,
        onSelect: () => descend(category),
      };
    },
  );

  return (
    // Fragment, comme `/transactions` : la colonne des postes est une **sœur**
    // de la colonne [fil d'ariane + anneau] et non sa cadette. Le fil d'ariane
    // ne coiffe donc que l'anneau, qu'il nomme, et la colonne récupère sa
    // hauteur — c'est le `ch - 41` que la maquette retranche au diamètre de
    // l'anneau, et lui seul.
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Le fil d'ariane nomme le **niveau** que l'anneau affiche, et lui
            seul : mettre un arc en avant ne le déplace pas — c'est une
            position, pas une sélection. */}
        <div className="flex min-w-0 flex-none items-center gap-[11px]">
          <span
            className={cn(
              "flex size-[27px] flex-none items-center justify-center rounded-lg",
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
              <CategoryIcon name={selected.icon} className="size-[15px]" />
            ) : (
              <LayersIcon className="size-[15px]" aria-hidden />
            )}
          </span>
          <span className="min-w-0 truncate text-base font-semibold tracking-[-0.02em]">
            {selected ? selected.name : "Toutes catégories"}
          </span>
          <span className="text-subtle flex-none text-[11.5px] whitespace-nowrap">
            {selected
              ? `${selected.subs.length} sous-catégorie${selected.subs.length > 1 ? "s" : ""} · ${sharePercent(selected.total, expenses)} des sorties`
              : `${categories.length} poste${categories.length > 1 ? "s" : ""} de dépense`}
          </span>
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
              // « À classer » n'est pas une catégorie de la base : le poser dans
              // l'URL donnerait un filtre sans résultat. Seul segment dont le
              // surlignage ne quitte pas la page.
              if (sub.filter === null) {
                setAClasserSel((current) => !current);
                // Le filtre revient sur la parente : c'est ce que le segment
                // désigne de plus précis, et c'est aussi ce qui ancre le
                // pense-bête local (voir `subSelected`).
                setSearch({ category: selected.filter });
                return;
              }
              setAClasserSel(false);
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
                  : (categories.find((c) => c.name === focus.name)?.icon ??
                    null)
                : (selected?.icon ?? null),
              iconColor: focus ? focus.color : selectedColor || "var(--subtle)",
              name: focus?.name ?? selected?.name ?? "",
              amount: euro0.format(
                focus?.total ?? selected?.total ?? levelTotal,
              ),
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

      <BreakdownList
        rows={rows}
        fold={selected !== null}
      />
    </>
  );
}

/**
 * Jauge d'un poste. Son budget global couvre tout ce qu'il porte ; celui d'une
 * parente détaillée s'arrête à ses sous-catégories budgétées, et le reliquat
 * « à classer » part en hachures. Sans budget — ou comparaison écartée — la
 * dépense se peint entière : la ligne garde sa jauge et son gabarit.
 */
const categoryGauge = (category: RevueCategory | undefined, off: boolean) =>
  category === undefined
    ? undefined
    : off || category.budget === null
      ? { amount: null, covered: category.total }
      : { amount: category.budget, covered: category.covered };

/**
 * Jauge d'une sous-catégorie : elle porte son budget seule, rien n'en déborde.
 *
 * Le segment « à classer » d'une parente **détaillée** est le seul cas où rien
 * n'est couvert : c'est de la dépense qu'aucun budget ne peut atteindre, et elle
 * se peint donc tout en hachures. Sous une parente globale, au contraire, il
 * fait partie de ce que le budget de la parente couvre — la ligne se lit alors
 * comme n'importe quelle autre.
 */
const subGauge = (
  sub: RevueCategory["subs"][number] | undefined,
  off: boolean,
  detailed: boolean,
) => {
  if (sub === undefined) return undefined;
  if (sub.filter === null && detailed && !off)
    return { amount: null, covered: 0 };
  return off || sub.budget === null
    ? { amount: null, covered: sub.total }
    : { amount: sub.budget, covered: sub.total };
};
