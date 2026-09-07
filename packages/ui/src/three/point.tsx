import type { Vector3 } from "@react-three/fiber";
import type { ReactNode } from "react";

import { Html } from "@react-three/drei";

type PointProps = {
  coordinates: Vector3;
  children?: ReactNode;
};

export function Point({ coordinates, children }: PointProps) {
  return (
    <Html position={coordinates} center occlude="raycast">
      <div>{children}</div>
    </Html>
  );
}
