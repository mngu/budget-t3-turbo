import type { TransactionsSearch } from "@budget/shared";

import { monthBounds } from "./date";

// Sans période dans l'URL, les écrans se calent sur le mois en cours plutôt que
// sur l'historique complet. Le défaut est *injecté* dans l'URL (et non appliqué
// au seul loader) pour que le sélecteur de mois affiche la période réellement
// interrogée.
//
// `new Date()` est volontairement évalué à chaque navigation : au niveau du
// module, le mois resterait figé sur celui du démarrage du serveur.
//
// Le défaut est appliqué au *retour* de `next`, comme le fait
// `stripSearchParams`, et non sur la search entrante : le maillon terminal de
// la chaîne remplace la search par celle passée à `navigate()`, donc tout ce
// qu'on modifie avant `next` est jeté dès qu'une navigation fournit un objet
// littéral — c'est exactement le cas du bouton « Réinitialiser ».
//
// Générique, et pas typé sur TransactionsSearch : `stripSearchParams` dégrade
// le schéma vu par les middlewares suivants (`page: unknown`), et un type
// concret ne s'y unifierait plus. Ce middleware n'a de toute façon besoin que
// des deux bornes.
export const defaultToCurrentMonth = <
  TSearch extends Pick<TransactionsSearch, "dateFrom" | "dateTo">,
>({
  search,
  next,
}: {
  search: TSearch;
  next: (search: TSearch) => TSearch;
}) => {
  const result = next(search);
  return (result.dateFrom ?? result.dateTo)
    ? result
    : { ...result, ...monthBounds(new Date()) };
};

// Valeurs par défaut retirées de l'URL. Les quatre écrans de la revue partagent
// la même search : passer de l'un à l'autre conserve période et filtres.
export const SEARCH_DEFAULTS = {
  page: 1,
  sort: "date",
  order: "desc",
  catSort: "montant",
} as const;

// Périmètre « toutes les transactions du mois » : les listes qui ne paginent pas
// (revue, ventilation, zoom catégorie) doivent neutraliser la pagination du
// schéma partagé plutôt que d'hériter de la page courante de la table.
export const withoutPaging = <T extends { page: number }>(search: T) => ({
  ...search,
  page: 1,
});

// Périmètre du mois, tous filtres de contenu retirés : sert aux graphiques et
// aux tuiles, qui gardent la répartition complète et se contentent de surligner
// la sélection — sinon cliquer une catégorie la réduirait à 100 % du total.
export const wholePeriod = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  page: 1,
  category: undefined,
  nvOnly: undefined,
});

// Clé de la file de relecture. Les filtres de contenu comptent (le compteur de
// l'onglet « À revoir » parle bien du périmètre affiché), mais pagination et tri
// sont neutralisés : `reviewQueue` les ignore côté serveur, et les laisser dans
// la clé donnerait une entrée de cache par page de la table — le compteur de
// l'en-tête se remettrait à charger à chaque « Suivant ». Les quatre écrans
// doivent appeler `transactions.review` par cette seule fonction, sans quoi ils
// alimentent des entrées de cache concurrentes et le compteur change de valeur
// d'un onglet à l'autre.
export const reviewScope = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  page: 1,
  sort: "date" as const,
  order: "desc" as const,
  catSort: undefined,
});
