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
  internes: "toutes",
} as const;

// Banques explicitement retenues, sous forme de liste. Vide = aucun filtre,
// c'est-à-dire *toutes* les banques — le panneau de comptes ne matérialise
// jamais la sélection complète dans l'URL (voir `bank` dans @budget/shared).
export const selectedBanks = (search: Pick<TransactionsSearch, "bank">) =>
  search.bank === undefined
    ? []
    : Array.isArray(search.bank)
      ? search.bank
      : [search.bank];

// Bascule d'un compte dans la sélection. `undefined` dès que tous les comptes
// connus sont cochés : sans ce repli, décocher puis recocher laisserait une
// liste figée dans l'URL, qui ignorerait toute banque connectée par la suite.
export function toggleBank(
  search: Pick<TransactionsSearch, "bank">,
  bank: string,
  known: string[],
): string[] | undefined {
  const current = selectedBanks(search);
  const base = current.length > 0 ? current : known;
  const next = base.includes(bank)
    ? base.filter((b) => b !== bank)
    : [...base, bank];
  // Décocher le dernier compte ne laisse rien à afficher : la bascule est
  // ignorée plutôt que de vider l'écran sans explication.
  if (next.length === 0) return base;
  return next.length === known.length && known.every((b) => next.includes(b))
    ? undefined
    : next;
}

// Périmètre « toutes les transactions du mois » : les listes qui ne paginent pas
// (revue, « À revoir », zoom catégorie) doivent neutraliser la pagination du
// schéma partagé plutôt que d'hériter de la page courante de la table.
export const withoutPaging = <T extends { page: number }>(search: T) => ({
  ...search,
  page: 1,
});

// Liste qui *détaille un agrégat* — les cartes de « À revoir », les lignes du
// zoom d'une catégorie. Elles passent par `transactions.list`, qui honore le
// param `internes` parce qu'il sert aussi le relevé : sans ce retrait explicite,
// elles montreraient des virements que l'agrégat au-dessus d'elles a écartés
// (un total qui ne fait pas la somme de ses lignes, sans la mention qui
// l'explique sur `/transactions`), et `/classer` présenterait un virement
// interne comme du travail à faire.
//
// C'est le prix de la règle « seul le relevé les montre » : elle déplace la
// décision de la seule `transactionsFilterQuery` vers chaque liste de détail.
// Toute nouvelle liste bâtie sur `transactions.list` doit passer par ici, sauf
// à vouloir délibérément le relevé complet.
export const aggregateDetail = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  internes: "masquer" as const,
});

// Périmètre du mois, tous filtres de contenu retirés : sert au bandeau, à
// l'anneau et à la colonne des postes, qui gardent la répartition complète et se
// contentent de surligner la sélection — sinon cliquer une catégorie la
// réduirait à 100 % du total.
//
// `q` en fait partie : le bandeau annonce le *solde du mois*, une recherche de
// libellé dans le relevé ne peut pas le déplacer. Ne restent donc que la période
// et les comptes — un périmètre, pas un filtre.
export const wholePeriod = <T extends TransactionsSearch>(search: T) => ({
  ...search,
  page: 1,
  category: undefined,
  aClasser: undefined,
  q: undefined,
  // Les agrégats écartent les virements internes d'eux-mêmes, quelle que soit
  // la valeur du param : le laisser passer donnerait trois clés react-query
  // pour trois réponses identiques, rechargées à chaque bascule de la puce.
  internes: "toutes" as const,
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
  // Même raison que la pagination : `reviewQueue` écarte les virements internes
  // sans consulter le param, une clé par valeur ferait clignoter le compteur de
  // l'onglet au premier clic sur la puce.
  internes: "toutes" as const,
});
