"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import type { TransactionsSearch } from "@budget/shared";
import { transactionsSearchSchema } from "@budget/shared";

import { defaultToCurrentMonth } from "~/lib/transactions-search";

/**
 * Le temps du forage. `outMs` a **trois** lecteurs : la durée CSS du repli, le
 * délai du `setTimeout` qui échange le niveau sur un clic, et le plancher que le
 * dépliage laisse au repli quand la navigation part d'ailleurs. Les deux
 * premiers ne peuvent pas diverger sans que l'anneau change de niveau avant
 * d'avoir fini de se replier ; le troisième ne peut pas descendre sous la durée
 * CSS sans rendre le repli invisible sur un loader rapide.
 */
export const DRILL = {
  outMs: 120,
  outEase: "cubic-bezier(0.4,0.05,0.9,0.3)",
  inMs: 340,
  inEase: "cubic-bezier(0.18,0.78,0.16,1)",
  /** Décalage du dépliage d'un arc au suivant, et son plafond. */
  staggerMs: 9,
  staggerMaxMs: 100,
  /**
   * Filet du relâchement. `requestAnimationFrame` **ne s'exécute pas** dans un
   * onglet caché : sans ce doublon, un forage déclenché puis quitté des yeux
   * laissait l'anneau replié pour de bon. Mesuré : arcs à longueur nulle et
   * carte du centre à 15 %, une seconde après le clic.
   */
  settleMs: 80,
  /**
   * Filet du repli, pour le niveau qui n'arrive jamais : navigation abandonnée,
   * retour arrière pendant le chargement. Sans lui l'anneau resterait replié
   * pour de bon, sans erreur ni rien à l'écran qui l'explique.
   */
  guardMs: 2000,
} as const;

/**
 * `out` = l'anneau du niveau courant se replie ; `in` = le nouveau niveau est
 * rendu, encore replié, prêt à se déplier ; `null` = au repos.
 */
export type DrillPhase = "out" | "in" | null;

// Les deux bornes de la période, telles que l'écran les interroge. Les searches
// comparées sont celles des `ParsedLocation` du routeur — la query brute, avant
// validation : d'où le schéma (une borne que la route rejette retombe sur
// `undefined`, une borne répétée sur une seule valeur) et le défaut de période,
// sans lequel la réécriture d'URL qui *injecte* le mois en cours au chargement
// se lirait comme un changement de période et replierait l'anneau pour rien.
const PERIOD = transactionsSearchSchema.pick({ dateFrom: true, dateTo: true });

function periodKey(search: unknown) {
  const period = defaultToCurrentMonth({
    search: PERIOD.parse(search),
    next: (s) => s,
  });
  return `${period.dateFrom}|${period.dateTo}`;
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * La séquence de forage de l'anneau : replier le niveau courant, échanger, puis
 * déplier le nouveau. **C'est la seule animation de l'anneau** — un changement
 * de période la joue comme un clic sur un poste, plutôt que de faire glisser
 * chaque arc vers sa nouvelle longueur.
 *
 * Le niveau de la revue vit dans l'URL, pas dans un `setState` : il ne change
 * donc pas au moment où on le demande mais quand la navigation a abouti (le
 * loader du layout se rejoue). D'où le forage en vol (`pending`) et l'effet qui
 * guette le niveau — attendre un délai fixe déplierait l'ancien anneau sur un
 * loader un peu lent. C'est la seule différence avec la maquette, dont le niveau
 * est un état local échangé dans la même passe que la phase.
 *
 * Deux entrées, parce que les deux gestes ne partent pas du même endroit :
 * `drill()` pour un clic sur un poste, qui retient la navigation le temps du
 * repli ; et l'effet ci-dessous pour la période, changée depuis l'en-tête — le
 * layout ne partage aucun état avec l'écran, et il n'y a rien à retenir puisque
 * la navigation est déjà partie.
 *
 * @param search Les search params dont l'anneau dépend : le poste ouvert et la
 *   période.
 */
export function useDrill(
  search: Pick<TransactionsSearch, "category" | "dateFrom" | "dateTo">,
) {
  const [phase, setPhase] = useState<DrillPhase>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  // Un forage est en cours. La cible n'a pas à être retenue : *tout* changement
  // de niveau déplie (voir l'effet). Retenir la cible laissait l'anneau replié
  // pour de bon quand deux changements de période se suivaient d'assez près
  // pour que le second annule le premier — le niveau attendu n'arrivait jamais.
  const pending = useRef(false);
  const foldedAt = useRef(0);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Le filet du repli, puis le plancher du dépliage — jamais les deux en même
  // temps : le premier est désarmé à l'instant où le second est posé.
  const unfoldTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const frame = useRef(0);

  const router = useRouter();
  // Le niveau observé : le poste ouvert **et** la période, les deux le changent.
  const level = `${periodKey(search)}|${search.category ?? ""}`;

  const fold = useCallback((direction: 1 | -1) => {
    pending.current = true;
    foldedAt.current = Date.now();
    setDir(direction);
    setPhase("out");
    clearTimeout(unfoldTimer.current);
    unfoldTimer.current = setTimeout(() => {
      pending.current = false;
      setPhase(null);
    }, DRILL.guardMs);
  }, []);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    clearTimeout(unfoldTimer.current);
    const settle = () => {
      cancelAnimationFrame(frame.current);
      clearTimeout(settleTimer.current);
      setPhase(null);
    };
    // Le nouveau niveau vient d'être rendu, encore replié (la phase est restée
    // `out`). Deux trames pour le relâcher : la première bascule en `in` —
    // l'anneau arrive de l'autre côté —, la seconde le laisse se déplier. Sans
    // ce report, le dépliage n'aurait pas d'état de départ à quitter et les
    // arcs se poseraient d'un coup à leur taille finale ; c'est aussi ce qui
    // sort les `setPhase` du corps de l'effet, où ils cascaderaient.
    const unfold = () => {
      frame.current = requestAnimationFrame(() => {
        setPhase("in");
        frame.current = requestAnimationFrame(settle);
      });
      // …et le filet, pour l'onglet caché où rien de tout cela ne tourne.
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settle, DRILL.settleMs);
    };
    // Plancher du repli. Un clic retient la navigation `outMs` avant d'échanger,
    // un changement de période ne le peut pas : le loader peut rendre en 30 ms
    // et l'anneau n'aurait fait que tressaillir. Le dépliage attend donc que le
    // repli ait eu son temps — au prix d'au plus `outMs` sur des données déjà
    // là, exactement ce que le clic coûte déjà.
    const left = DRILL.outMs - (Date.now() - foldedAt.current);
    if (left <= 0) unfold();
    else unfoldTimer.current = setTimeout(unfold, left);
  }, [level]);

  // Le changement de période, venu de l'en-tête : rien à retenir, la navigation
  // est déjà partie — l'anneau se replie pendant que le loader travaille et se
  // déplie sur les nouvelles données. C'est l'événement du routeur et non la
  // search rendue, pour deux raisons : elle n'arrive qu'*avec* le loader (elle
  // est lue sur les matches), et le repli est un `setState` qu'un effet ne peut
  // déclencher qu'en réponse à un système extérieur — ici l'abonnement.
  //
  // Ne se déclenche que sur la **période** : surligner une sous-catégorie change
  // bien `search.category` sans changer le niveau affiché, replier l'anneau y
  // serait une régression.
  useEffect(
    () =>
      router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation }) => {
        if (!fromLocation || pending.current || reducedMotion()) return;
        const from = periodKey(fromLocation.search);
        const to = periodKey(toLocation.search);
        if (from === to) return;
        // Le sens se lit dans la rotation : avancer dans le temps entre dans le
        // mois suivant, reculer en sort. Les bornes sont ISO, leur ordre
        // lexicographique est l'ordre chronologique.
        fold(to > from ? 1 : -1);
      }),
    [router, fold],
  );

  useEffect(
    () => () => {
      clearTimeout(swapTimer.current);
      clearTimeout(unfoldTimer.current);
      clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * @param target Le poste visé, tel qu'il apparaîtra dans `search.category`.
   * @param apply  Ce qui l'y met — appelé une fois le repli terminé.
   */
  const drill = (target: string | undefined, apply: () => void) => {
    // Un forage à la fois : deux séquences imbriquées laisseraient l'anneau
    // replié sur un niveau que plus personne n'attend.
    if (pending.current || target === search.category) return;
    // Mouvement réduit : l'échange se fait sur place. Ce n'est pas qu'une
    // affaire de CSS — c'est le délai du repli qu'il faut sauter, et
    // `motion-reduce:transition-none` ne peut rien contre un `setTimeout`.
    if (reducedMotion()) {
      apply();
      return;
    }
    // Sortir d'un poste tourne dans l'autre sens que d'y entrer.
    fold(target === undefined ? -1 : 1);
    clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(apply, DRILL.outMs);
  };

  return { phase, dir, drill };
}
