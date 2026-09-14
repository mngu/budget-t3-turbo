import type { ReactNode } from "react";

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { Color } from "three";

import { useTheme } from "../theme";
import { RING_RADIUS, TUBE_RADIUS, useTuning } from "./tuning";

type Props = {
  /** Milieu de l'arc, dans le repère local du segment. */
  angle: number;
  /** Teinte de la catégorie, déjà passée par `resolveCategoryColor`. */
  color: string;
  children?: ReactNode;
};

export function SegmentLabel({ angle, color, children }: Props) {
  const { resolvedTheme } = useTheme();
  // `labelLift` décolle les étiquettes du plan de l'anneau : en perspective
  // elles forment un second anneau et cessent de se chevaucher dans le bas.
  // `labelBlend` mélange la teinte vers le premier plan — la teinte pure est
  // illisible en petit corps, même règle que l'anneau SVG.
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
      {/* Trait de rappel : décalée vers l'extérieur *et* vers le haut, une
          étiquette ne désigne plus son arc sans lui. */}
      <Line
        points={[anchor, label]}
        color={labelColor}
        lineWidth={1}
        transparent
        opacity={0.35}
      />
      <Html position={label}>
        <div style={{ fontSize: `${labelSize}px` }}>{children}</div>
      </Html>
    </>
  );
}
