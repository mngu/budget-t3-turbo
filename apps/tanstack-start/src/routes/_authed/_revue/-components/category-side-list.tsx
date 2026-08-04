"use client";

import { useQuery } from "@tanstack/react-query";

import type { TransactionsSearch } from "@budget/shared";
import { cn } from "@budget/ui";

import type { BreakdownItem } from "./breakdown-list";
import { useCategoryColor } from "~/lib/category-color";
import { wholePeriod } from "~/lib/transactions-search";
import { useTRPC } from "~/lib/trpc";
import { useRevueSearch } from "~/lib/use-revue-search";
import {
  BREAKDOWN_WIDTH,
  BreakdownRow,
  breakdownScale,
} from "./breakdown-list";

/**
 * Périmètre de la colonne — exporté pour que le loader de la route préchauffe
 * exactement cette clé : sans quoi la colonne se peuplerait après coup, une
 * requête en cascade derrière la table.
 */
export const sideScope = <T extends TransactionsSearch>(search: T) => ({
  ...wholePeriod(search),
  direction: "debit" as const,
});

/**
 * Colonne de droite de « Toutes les transactions » — portage du panneau latéral
 * de `Transactions.dc.html`. Le poids de chaque poste de **sortie** sur la
 * période, en barres proportionnelles au plus gros ; cliquer une ligne pose ou
 * retire le filtre de catégorie.
 *
 * Elle partage le dessin de ses lignes avec la liste de la revue
 * (`BreakdownRow`) mais **pas** son enveloppe : celle-ci défile sous l'anneau,
 * celle-là longe la table. Et surtout pas sa source — la liste de la revue est
 * nourrie par le panneau, qui la fait descendre dans les sous-catégories ;
 * celle-ci interroge `byCategory` pour son compte, sur un périmètre dont le
 * loader de la route dépend (`sideScope`).
 *
 * `direction: "debit"` est forcé, comme la maquette et comme l'anneau de la
 * revue (`_revue/index.tsx`, même agrégat et même geste). Ce n'est pas un
 * réglage : sans lui, un seul mois de salaires écrase l'échelle et les postes de
 * dépense s'affaissent tous à un moignon indistinct — la colonne n'aurait plus
 * rien à comparer. Deux conséquences voulues : la colonne ne suit pas le
 * sélecteur de sens (elle répond à « où part l'argent », pas « qu'affiche la
 * table »), là où la maquette, qui somme des débits sur une base déjà filtrée
 * par le sens, se vide en passant sur « Crédits » ; et les catégories d'entrée
 * n'y figurent pas — elles restent atteignables par la modale « Filtrer par
 * catégorie », qui liste tout, exactement comme dans la maquette.
 *
 * Le reste du périmètre est `wholePeriod` : filtrer une catégorie ne doit pas la
 * porter à 100 % de sa propre répartition. `aClasser` en est retiré du même
 * coup, alors qu'il resserre bien la table.
 */
export function CategorySideList({ className }: { className?: string }) {
  const trpc = useTRPC();
  const { search, setSearch } = useRevueSearch();
  const resolveColor = useCategoryColor();
  const { data } = useQuery(
    trpc.transactions.byCategory.queryOptions(sideScope(search)),
  );

  const rows: BreakdownItem[] = (data ?? []).map((item) => {
    // Même sentinelle que partout ailleurs dans la search : `byCategory`
    // regroupe les transactions sans catégorie sous un libellé vide, le filtre
    // les désigne par « none ».
    const value = item.category === "" ? "none" : item.category;
    const label = item.category || "Sans catégorie";
    const active = search.category === value;

    return {
      name: label,
      total: item.total,
      color: resolveColor(item.color),
      active,
      // Un filtre posé sur une *autre* catégorie estompe la barre sans la faire
      // disparaître : la répartition reste lisible pendant qu'on navigue dedans.
      dimmed: search.category !== undefined && !active,
      title: active
        ? "Retirer le filtre de catégorie"
        : `N'afficher que « ${label} »`,
      onSelect: () =>
        setSearch({ category: active ? undefined : value, page: 1 }),
    };
  });

  const max = breakdownScale(rows);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col gap-0.5 overflow-y-auto pr-0.5",
        BREAKDOWN_WIDTH,
        className,
      )}
    >
      {rows.map((row) => (
        <BreakdownRow key={row.name} row={row} max={max} />
      ))}
    </div>
  );
}
