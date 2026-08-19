"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

import type { Breakdown, TransactionsSearch } from "@budget/shared";
import { transactionsSearchSchema } from "@budget/shared";

import { defaultToCurrentMonth } from "~/lib/transactions-search";
import { openParent } from "../-lib/breakdown";

/**
 * Le temps du forage. `outMs` a **deux** lecteurs : la durée CSS du repli, et le
 * plancher que le dépliage laisse au repli — il ne peut pas descendre sous la
 * durée CSS sans rendre le repli invisible sur un loader rapide, qui rend en
 * 30 ms.
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

/** L'état du forage, tel que l'anneau le consomme : une phase et un sens. */
export interface Drill {
  phase: DrillPhase;
  /** 1 = on entre dans un poste, −1 = on en sort. */
  dir: 1 | -1;
}

// Les deux bornes de la période, telles que l'écran les interroge. Les searches
// comparées sont celles des `ParsedLocation` du routeur — la query brute, avant
// validation : d'où le schéma (une borne que la route rejette retombe sur
// `undefined`, une borne répétée sur une seule valeur) et le défaut de période,
// sans lequel la réécriture d'URL qui *injecte* le mois en cours au chargement
// se lirait comme un changement de période et replierait l'anneau pour rien.
const PERIOD = transactionsSearchSchema.pick({
  dateFrom: true,
  dateTo: true,
  category: true,
});

function periodKey(search: unknown) {
  const period = defaultToCurrentMonth({
    search: PERIOD.parse(search),
    next: (s) => s,
  });
  return `${period.dateFrom}|${period.dateTo}`;
}

/**
 * Le niveau que l'anneau **affiche** pour un filtre donné : la parente ouverte,
 * ou rien. Ce n'est pas `search.category` : surligner une sous-catégorie le
 * change sans changer le niveau, et une parente **sans sous-catégorie** n'ouvre
 * aucun niveau (même expression que `selected`, côté écran) — replier l'anneau
 * dans ces deux cas ferait clignoter la répartition pour rien.
 */
export function levelKey(search: unknown, rows: Breakdown) {
  const parent = openParent(rows, PERIOD.parse(search).category ?? undefined);
  return parent?.name ?? "";
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
 * **Une seule entrée** : l'abonnement au routeur ci-dessous. Le geste qui change
 * de niveau n'a rien à déclarer — qu'il vienne de l'anneau, de la colonne des
 * postes (montée par le layout, qui ne partage aucun état avec l'écran) ou du
 * sélecteur de période, il navigue, et c'est la navigation qui replie. Il a
 * existé un `drill(target, apply)` qui retenait la navigation le temps du
 * repli : il est devenu inutile le jour où le dépliage a reçu son plancher
 * (`left`, plus bas), et deux instances du hook — une par appelant — laissaient
 * l'anneau immobile sur un clic dans la colonne.
 *
 * @param search Les search params dont l'anneau dépend : le poste ouvert et la
 *   période.
 * @param rows La répartition de la période, seule à dire si une parente ouvre
 *   un niveau (voir `levelKey`).
 */
export function useDrill(
  search: Pick<TransactionsSearch, "category" | "dateFrom" | "dateTo">,
  rows: Breakdown,
): Drill {
  const [phase, setPhase] = useState<DrillPhase>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  // Un forage est en cours. La cible n'a pas à être retenue : *tout* changement
  // de niveau déplie (voir l'effet). Retenir la cible laissait l'anneau replié
  // pour de bon quand deux changements de période se suivaient d'assez près
  // pour que le second annule le premier — le niveau attendu n'arrivait jamais.
  const pending = useRef(false);
  const foldedAt = useRef(0);
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
  const level = `${periodKey(search)}|${levelKey(search, rows)}`;

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

  // Le repli : rien à retenir, la navigation est déjà partie — l'anneau se
  // replie pendant que le loader travaille et se déplie sur les nouvelles
  // données. C'est l'événement du routeur et non la search rendue, pour deux
  // raisons : elle n'arrive qu'*avec* le loader (elle est lue sur les matches),
  // et le repli est un `setState` qu'un effet ne peut déclencher qu'en réponse
  // à un système extérieur — ici l'abonnement.
  //
  // Ne se déclenche que sur la période ou le **niveau affiché** : surligner une
  // sous-catégorie change bien `search.category` sans changer de niveau, replier
  // l'anneau y serait une régression (voir `levelKey`).
  useEffect(
    () =>
      router.subscribe("onBeforeNavigate", ({ fromLocation, toLocation }) => {
        if (!fromLocation || pending.current || reducedMotion()) return;
        const from = periodKey(fromLocation.search);
        const to = periodKey(toLocation.search);
        // Le sens se lit dans la rotation. Sur la période : avancer dans le
        // temps entre dans le mois suivant, reculer en sort — les bornes sont
        // ISO, leur ordre lexicographique est l'ordre chronologique. Sur le
        // niveau : entrer dans un poste, ou en sortir vers « toutes catégories ».
        if (from !== to) {
          fold(to > from ? 1 : -1);
          return;
        }
        const next = levelKey(toLocation.search, rows);
        if (next === levelKey(fromLocation.search, rows)) return;
        fold(next === "" ? -1 : 1);
      }),
    // `rows` est dans les dépendances : la répartition change avec la période, et
    // une parente qui avait des sous-catégories le mois dernier peut ne plus en
    // avoir — capturée périmée, elle déciderait à faux de replier ou non.
    [router, fold, rows],
  );

  useEffect(
    () => () => {
      clearTimeout(unfoldTimer.current);
      clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { phase, dir };
}
