"use client";

import type { TransactionsSearch } from "@budget/api/schemas";

import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Search partagée par les quatre écrans de la revue (revue du mois, « À revoir »,
 * zoom catégorie, table complète).
 *
 * `strict: false` parce que l'en-tête et la barre de filtres vivent dans le
 * layout `_revue`, au-dessus des routes qui déclarent le schéma : elles ne
 * peuvent pas passer par `getRouteApi`. Le cast est sans risque — toutes les
 * routes sous ce layout valident `transactionsSearchSchema` — mais il ne tient
 * que tant que c'est vrai : y placer une route à la search différente casserait
 * silencieusement l'en-tête.
 *
 * Depuis le portage du nouvel en-tête, `AppHeader` est aussi monté **hors** de
 * ce layout (`/categories`, `/banques`, `/callback`), où le cast est donc faux :
 * la search rendue est celle de ces routes-là. Il l'appelle quand même — un hook
 * ne se conditionne pas — mais n'en lit la valeur que derrière la garde
 * `isRevue` d'`AppHeader`, qui teste la **présence du match**
 * `/_authed/_period-overview`. Toute nouvelle lecture dans l'en-tête doit passer
 * par cette garde.
 *
 * Elle est positive depuis le 2026-08-28, et doit le rester : l'absence de titre
 * en tenait lieu jusque-là, ce qui rangeait `/callback` — sous `_authed`, sans
 * titre — du côté de la revue et y montait les deux sélecteurs hors de leur
 * layout. Sans conséquence tant qu'ils lisaient un cache client ; ils lisent
 * maintenant le loader de ce layout, et `useLoaderData` lève sans le match.
 */
export function useRevueSearch() {
  const search: TransactionsSearch = useSearch({ strict: false });
  const navigate = useNavigate();

  // Tout changement de filtre revient page 1 : rester page 4 après avoir
  // restreint la sélection donne une table vide sans explication.
  //
  // `page: 1` est posé **avant** le patch, jamais après : les boutons de
  // pagination passent leur propre `page` et doivent gagner. Dans l'autre ordre
  // le défaut écrase la page demandée et la pagination ne bouge plus.
  const setSearch = (patch: Partial<TransactionsSearch>) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        page: 1,
        ...patch,
      }),
    });

  return { search, setSearch };
}
