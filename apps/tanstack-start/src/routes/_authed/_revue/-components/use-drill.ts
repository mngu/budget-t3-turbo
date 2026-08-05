"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Le temps du forage. `outMs` est lu **des deux côtés** — c'est le délai du
 * `setTimeout` qui échange le niveau autant que la durée CSS du repli — et les
 * deux ne peuvent pas diverger sans que l'anneau change de niveau avant d'avoir
 * fini de se replier.
 */
export const DRILL = {
  outMs: 200,
  outEase: "cubic-bezier(0.4,0.05,0.9,0.3)",
  inMs: 560,
  inEase: "cubic-bezier(0.18,0.78,0.16,1)",
  /** Décalage du dépliage d'un arc au suivant, et son plafond. */
  staggerMs: 16,
  staggerMaxMs: 190,
  /**
   * Filet du relâchement. `requestAnimationFrame` **ne s'exécute pas** dans un
   * onglet caché : sans ce doublon, un forage déclenché puis quitté des yeux
   * laissait l'anneau replié pour de bon. Mesuré : arcs à longueur nulle et
   * carte du centre à 15 %, une seconde après le clic.
   */
  settleMs: 80,
} as const;

/**
 * `out` = l'anneau du niveau courant se replie ; `in` = le nouveau niveau est
 * rendu, encore replié, prêt à se déplier ; `null` = au repos.
 */
export type DrillPhase = "out" | "in" | null;

/**
 * La séquence de forage de l'anneau : replier le niveau courant, échanger, puis
 * déplier le nouveau.
 *
 * Le niveau de la revue vit dans l'URL, pas dans un `setState` : il ne change
 * donc pas au moment où on le demande mais quand la navigation a abouti (le
 * loader du layout se rejoue). D'où la cible en vol (`pending`) et l'effet qui
 * la guette — attendre un délai fixe déplierait l'ancien anneau sur un loader
 * un peu lent. C'est la seule différence avec la maquette, dont le niveau est un
 * état local échangé dans la même passe que la phase.
 *
 * @param level Le niveau observé — le search param dont l'anneau dépend.
 */
export function useDrill(level: string | undefined) {
  const [phase, setPhase] = useState<DrillPhase>(null);
  const [dir, setDir] = useState<1 | -1>(1);
  // Boîte plutôt que la valeur nue : `undefined` est un niveau légitime (« tous
  // les postes »), c'est donc la *présence* de la boîte qui dit qu'un forage est
  // en cours.
  const pending = useRef<{ level: string | undefined } | null>(null);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const frame = useRef(0);

  useEffect(() => {
    if (!pending.current || pending.current.level !== level) return;
    pending.current = null;
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
    frame.current = requestAnimationFrame(() => {
      setPhase("in");
      frame.current = requestAnimationFrame(settle);
    });
    // …et le filet, pour l'onglet caché où rien de tout cela ne tourne.
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(settle, DRILL.settleMs);
  }, [level]);

  useEffect(
    () => () => {
      clearTimeout(swapTimer.current);
      clearTimeout(settleTimer.current);
      cancelAnimationFrame(frame.current);
    },
    [],
  );

  /**
   * @param target Le niveau visé, tel qu'il apparaîtra dans `level`.
   * @param apply  Ce qui l'y met — appelé une fois le repli terminé.
   */
  const drill = (target: string | undefined, apply: () => void) => {
    // Un forage à la fois : deux séquences imbriquées laisseraient l'anneau
    // replié sur un niveau que plus personne n'attend.
    if (pending.current || target === level) return;
    // Mouvement réduit : l'échange se fait sur place. Ce n'est pas qu'une
    // affaire de CSS — c'est le délai de 200 ms qu'il faut sauter, et
    // `motion-reduce:transition-none` ne peut rien contre un `setTimeout`.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }
    pending.current = { level: target };
    // Sortir d'un poste tourne dans l'autre sens que d'y entrer.
    setDir(target === undefined ? -1 : 1);
    setPhase("out");
    clearTimeout(swapTimer.current);
    swapTimer.current = setTimeout(apply, DRILL.outMs);
  };

  return { phase, dir, drill };
}
