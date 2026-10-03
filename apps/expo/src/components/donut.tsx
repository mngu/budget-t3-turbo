import { Typography } from "heroui-native";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { euro } from "~/lib/format";

const SIZE = 200;
const STROKE = 22;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

// Decorative: the list below carries the same figures for screen readers.
export function Donut({
  slices,
  label,
}: {
  slices: { value: number; color: string }[];
  label: string;
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  // A lone slice is a full ring; a gap would read as a missing share.
  const gap = slices.length > 1 ? GAP : 0;
  const arcs = slices.reduce<
    { color: string; start: number; length: number }[]
  >((done, slice) => {
    const last = done.at(-1);
    return [
      ...done,
      {
        color: slice.color,
        start: last ? last.start + last.length : 0,
        length: (slice.value / total) * CIRCUMFERENCE,
      },
    ];
  }, []);

  return (
    <View className="items-center justify-center self-center">
      <Svg
        width={SIZE}
        height={SIZE}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {arcs.map((arc, index) => (
          <Circle
            key={index}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={arc.color}
            strokeWidth={STROKE}
            strokeDasharray={`${Math.max(arc.length - gap, 1)} ${CIRCUMFERENCE}`}
            strokeDashoffset={-arc.start}
            rotation={-90}
            origin={`${SIZE / 2}, ${SIZE / 2}`}
          />
        ))}
      </Svg>
      <View className="absolute items-center">
        <Typography type="body-sm" color="muted">
          {label}
        </Typography>
        <Typography type="h3" className="tabular-nums">
          {euro.format(total)}
        </Typography>
      </View>
    </View>
  );
}
