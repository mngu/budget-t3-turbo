import type { ReactNode } from "react";

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { Color } from "three";

import { useTheme } from "../theme";
import { RING_RADIUS, TUBE_RADIUS, useTuning } from "./tuning";

type Props = {
  /** Arc midpoint in the segment's local coordinates. */
  angle: number;
  /** Rotation around the ring, needed to determine the label's side. */
  rotation: number;
  /** Theme-resolved category color. */
  color: string;
  children?: ReactNode;
};

export function SegmentLabel({ angle, rotation, color, children }: Props) {
  const { resolvedTheme } = useTheme();
  // Lift labels to reduce overlap; blend toward the foreground for text contrast.
  const { labelBlend, labelSize, labelLift, labelRadius } = useTuning();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  const labelColor = useMemo(
    () =>
      new Color(color).lerp(
        new Color(resolvedTheme === "dark" ? "#ffffff" : "#000000"),
        labelBlend,
      ),
    [color, resolvedTheme, labelBlend],
  );

  const anchor: [number, number, number] = [
    RING_RADIUS * cos,
    RING_RADIUS * sin,
    TUBE_RADIUS * 0.4,
  ];
  const label: [number, number, number] = [
    labelRadius * cos,
    labelRadius * sin,
    labelLift,
  ];

  return (
    <>
      <Line
        points={[anchor, label]}
        color={labelColor}
        lineWidth={1}
        transparent
        opacity={0.35}
      />
      {/* Anchor the ring-facing edge so left-side labels extend away from the arcs. */}
      <Html position={label}>
        <div
          style={{
            fontSize: `${labelSize}px`,
            transform: `translate(${Math.cos(rotation + angle) < 0 ? "-100%" : "0"}, -50%)`,
          }}
        >
          {children}
        </div>
      </Html>
    </>
  );
}
