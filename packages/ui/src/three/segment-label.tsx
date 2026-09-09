import { Billboard, Line, Text } from "@react-three/drei";
import { useMemo } from "react";
import { Color } from "three";

import { useTheme } from "../theme";
import { useTuning } from "./tuning";

const RING_RADIUS = 5;
const TUBE_RADIUS = 1;

type Props = {
  /** Milieu de l'arc, dans le repère local du segment. */
  angle: number;
  /** Teinte de la catégorie, déjà passée par `resolveCategoryColor`. */
  color: string;
  text: string;
};

export function SegmentLabel({ angle, color, text }: Props) {
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
      <Billboard position={label}>
        {/* ponytail: sans `font`, troika télécharge Roboto depuis un CDN. Geist
            n'est distribué qu'en woff2, que troika ne lit pas — s'en passer
            demande de committer un .woff converti. */}
        <Text
          fontSize={labelSize}
          color={labelColor}
          anchorX={cos >= 0 ? "left" : "right"}
          anchorY="middle"
          position={[cos >= 0 ? 0.25 : -0.25, 0, 0]}
        >
          {text}
        </Text>
      </Billboard>
    </>
  );
}
