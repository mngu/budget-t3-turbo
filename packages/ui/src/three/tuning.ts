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
export const RING_RADIUS = 5;
export const TUBE_RADIUS = 1;

export type Tuning = {
  materialRoughness: number;
  materialMetalness: number;
  materialClearcoat: number;
  materialClearcoatRoughness: number;
  materialIridescence: number;
  /** Mélange de la teinte vers le premier plan - 0 = teinte pure, illisible. */
  labelBlend: number;
  labelSize: number;
  /** Décalage en z : c'est lui qui décolle les intitulés du plan de l'anneau. */
  labelLift: number;
  labelRadius: number;
};

export const DEFAULT_TUNING: Tuning = {
  materialRoughness: 0.29,
  materialMetalness: 0,
  materialClearcoat: 1,
  materialClearcoatRoughness: 0.78,
  materialIridescence: 0,

  labelBlend: 0,
  labelSize: 14,
  labelLift: 2,
  labelRadius: 7.8,
};

export const TuningContext = createContext(DEFAULT_TUNING);

export const useTuning = () => useContext(TuningContext);
