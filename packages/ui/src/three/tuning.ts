import { createContext, useContext } from "react";

// Share controls through context to avoid creating a Leva panel per segment.
// TODO: restrict Leva to development or remove it once tuning values are fixed.
export const RING_RADIUS = 5;
export const TUBE_RADIUS = 1;

export type Tuning = {
  materialRoughness: number;
  materialMetalness: number;
  materialClearcoat: number;
  materialClearcoatRoughness: number;
  materialIridescence: number;
  /** Blend toward the foreground; zero leaves the raw category color. */
  labelBlend: number;
  labelSize: number;
  /** Z offset above the ring plane. */
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
