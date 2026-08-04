"use client";

import { useEffect, useState } from "react";

import type { RingSlice } from "./category-ring";
import type { Delta } from "~/lib/history";
import { shadeCategoryColor, useCategoryColor } from "~/lib/category-color";
import { euro0, sharePercent } from "~/lib/format";
import { useRevueSearch } from "~/lib/use-revue-search";
import { CategoryRing } from "./category-ring";

/** Une catégorie parente de sortie, telle que l'anneau la manipule. */
export interface EpureeCategory {
  /** Libellé affiché — « Sans catégorie » pour le groupe sans rattachement. */
  name: string;
  /**
   * Valeur à poser dans le search param `category` pour désigner ce poste :
   * le libellé affiché n'en tient pas lieu, le groupe sans rattachement se
   * filtrant par la sentinelle `"none"` (voir `categoryFilterLabel`).
   */
  filter: string;
  total: number;
  /** Hex canonique de la palette, à résoudre au thème au rendu. */
  color: string;
  /** Nom d'icône Lucide de `categories.icon`, `null` si aucune n'est choisie. */
  icon: string | null;
  /**
   * Sous-catégories, déjà triées du plus gros au plus petit, « À classer »
   * compris — c'est l'ordre que `transactions.byCategory` garantit, et dont les
   * nuances de la teinte parente dérivent.
   *
   * `filter: null` désigne le segment « À classer », que `byCategory` fabrique
   * (le reliquat porté par la parente elle-même) et qui n'est **pas** une ligne
   * de `categories` : aucune valeur de `category` ne le sélectionne, le poser
   * dans l'URL donnerait un filtre sans résultat.
   */
  subs: { name: string; total: number; filter: string | null }[];
  delta: Delta | null;
}

/**
 * L'anneau de la revue du mois, et lui seul : le bandeau de tête et la colonne
 * des postes vivent dans le layout `_revue`, partagés avec `/transactions`.
 *
 * L'anneau interne de sous-catégories de la maquette n'est pas porté : elle ne
 * l'affiche qu'*à la place* de la colonne, quand celle-ci ne tient plus en
 * largeur. Ici la colonne reste affichée, à droite de l'anneau.
 */
export function EpureePanel({
  categories,
  expenses,
}: {
  /** Postes de sortie, du plus gros au plus petit. */
  categories: EpureeCategory[];
  /** Total des sorties de la période, dénominateur de la part affichée au centre. */
  expenses: number;
}) {
  const resolveColor = useCategoryColor();
  const { search, setSearch } = useRevueSearch();

  // `sel` et « l'arc surligné » ne sont pas deux tailles du même geste, et c'est
  // tout le ressort de l'écran : cliquer un arc fait *descendre* l'anneau dans
  // les sous-catégories du poste, cliquer une ligne de la colonne de droite le
  // met **en avant** sans quitter le niveau des parents.
  //
  // Les deux gestes étaient inversés jusqu'au passage du bandeau et de la
  // colonne dans le layout `_revue` : la colonne n'est plus ici, elle ne peut
  // plus commander le niveau de l'anneau, et c'est donc l'arc qui descend.
  // L'ensemble des états atteignables est le même, seule la correspondance
  // geste → état change.
  //
  // L'arc surligné vit dans l'URL (`category`) et non dans un état local : c'est
  // la même sélection que celle de la table, et elle la suit. Le niveau, lui,
  // reste local — un nom de catégorie ne peut pas dire à la fois « surligné
  // parmi ses pairs » et « ouvert sur ses enfants », et c'est `sel` qui départage
  // les deux lectures du même param.
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // Le segment « À classer » n'a pas de filtre qui le désigne (voir
  // `EpureeCategory.subs`) : son surlignage est le seul qui reste local.
  const [aClasserSel, setAClasserSel] = useState(false);

  const clear = () => {
    setSel(null);
    setHover(null);
    setAClasserSel(false);
    // Ne naviguer que s'il y a un filtre à retirer : `setSearch` relance le
    // loader de la route, et Échap est *aussi* la touche qui referme les
    // popovers de l'en-tête — sans cette garde, chaque fermeture de sélecteur
    // rejouerait les agrégats de l'écran pour rien.
    if (search.category !== undefined) setSearch({ category: undefined });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Le param désigne une sous-catégorie : l'anneau *descend* de lui-même, sinon
  // l'arc surligné ne serait pas à l'écran. C'est ce qui rend une URL partagée
  // fidèle à ce qu'elle montrait.
  const subOwner = search.category
    ? (categories.find((c) =>
        c.subs.some((s) => s.filter === search.category),
      ) ?? null)
    : null;
  const selected =
    subOwner ?? (sel ? (categories.find((c) => c.name === sel) ?? null) : null);
  // Un poste ne peut pas être « en avant » et « ouvert » à la fois : descendre
  // dans une catégorie remet l'anneau à plat sur ses enfants.
  const opened = selected
    ? null
    : (categories.find((c) => c.filter === search.category) ?? null);
  const parent = opened ?? selected;
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
  const parentColor = parent ? resolveColor(parent.color) : "";

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
  const activeName = selected
    ? (subSelected?.name ?? null)
    : (opened?.name ?? null);
  const activeIndex = activeName
    ? slices.findIndex((s) => s.name === activeName)
    : -1;
  const focus =
    (hover !== null ? slices[hover] : null) ??
    (activeIndex >= 0 ? slices[activeIndex] : null) ??
    null;

  return (
    // Cliquer à côté referme, comme la touche Échap. L'anneau s'étire sur toute
    // la place disponible (pas d'`items-center`) : c'est de là qu'il tire sa
    // taille, sa boîte carrée étant en confinement de taille — centrée dans un
    // conteneur à dimension automatique, elle s'effondrerait à zéro.
    <div className="relative flex min-h-0 min-w-0 flex-1" onClick={clear}>
      <CategoryRing
        slices={slices}
        activeIndex={activeIndex >= 0 ? activeIndex : null}
        hoverIndex={hover}
        onHover={setHover}
        // Les arcs sont dans l'ordre de `subs` / `categories`, dont `slices`
        // est le calque : l'index désigne la même part des deux côtés.
        onActivate={(index) => {
          // Au niveau des parents, l'arc fait descendre. Le survol est remis à
          // zéro : son index désignerait une part de l'ancien niveau.
          if (!selected) {
            const category = categories[index];
            if (!category) return;
            setSel(category.name);
            setHover(null);
            setAClasserSel(false);
            setSearch({ category: category.filter });
            return;
          }
          const sub = selected.subs[index];
          if (!sub) return;
          // Ancrer la descente avant de toucher au param. Sans ça, une visite
          // arrivée par une sous-catégorie (`sel` encore nul, le niveau ne
          // tenant qu'au param) remonterait d'un cran dès que le filtre
          // revient sur la parente — ce que font le dépointage et « À classer ».
          setSel(selected.name);
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
              : (categories.find((c) => c.name === focus.name)?.icon ?? null)
            : (selected?.icon ?? null),
          iconColor: focus ? focus.color : parentColor || "var(--subtle)",
          name: focus?.name ?? selected?.name ?? "",
          amount: euro0.format(focus?.total ?? selected?.total ?? levelTotal),
          label: focus
            ? `${sharePercent(focus.total, levelTotal)} ${selected ? "du poste" : "du total"}`
            : selected
              ? `${sharePercent(selected.total, expenses)} du total`
              : "Sorties",
        }}
      />
    </div>
  );
}
