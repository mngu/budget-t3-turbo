import { createContext, useContext } from "react";

/**
 * Les réglages que `CanvasContainer` expose dans leva et qui doivent redescendre
 * dans les arcs et leurs intitulés. Ils passent par un contexte plutôt que par
 * un `useControls` local : `Segment` est monté une fois par catégorie, et leva
 * pose un panneau par appel.
 *
 * ponytail: leva part au bundle de production. À passer derrière
 * `import.meta.env.DEV`, ou à retirer avec ce contexte, le jour où l'anneau 3D
 * remplace le SVG.
 */
export type Tuning = {
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  iridescence: number;
  /** Au-delà de 1, l'arc survolé franchit le seuil du `Bloom` et fait le halo. */
  hoverEmissive: number;
  /** Mélange de la teinte vers le premier plan — 0 = teinte pure, illisible. */
  labelBlend: number;
  labelSize: number;
  /** Décalage en z : c'est lui qui décolle les intitulés du plan de l'anneau. */
  labelLift: number;
  labelRadius: number;
};

export const DEFAULT_TUNING: Tuning = {
  roughness: 0.63,
  metalness: 0.24,
  clearcoat: 0.47,
  clearcoatRoughness: 0.78,
  iridescence: 0.35,
  hoverEmissive: 0.3,
  labelBlend: 0,
  labelSize: 14,
  labelLift: 2,
  labelRadius: 7.8,
};

const TuningContext = createContext(DEFAULT_TUNING);

export const TuningProvider = TuningContext.Provider;

export const useTuning = () => useContext(TuningContext);
