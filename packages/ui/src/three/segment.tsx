import type { ReactNode } from "react";

import { animated, config, useSpring } from "@react-spring/three";
import { Html, useCursor } from "@react-three/drei";
import { Select } from "@react-three/postprocessing";
import { useState } from "react";

import { RING_RADIUS, TUBE_RADIUS, useTuning } from "./tuning";

// The wrapper keeps code-inspector's injected props from reaching Html's Three group.
export function SegmentDetail({ children }: { children: ReactNode }) {
  return <Html center>{children}</Html>;
}

const RADIAL_SEGMENTS = 24;

// Do not spread props onto meshes: injected data-insp-path props crash R3F.
type SegmentProps = {
  color: string;
  arc: number;
  rotationZ: number;
  children?: ReactNode;
  onPointerOver?: () => void;
  onClick?: () => void;
};

function SegmentMaterial({ color }: { color: string }) {
  const tuning = useTuning();

  return (
    <meshPhysicalMaterial
      color={color}
      roughness={tuning.materialRoughness}
      metalness={tuning.materialMetalness}
      clearcoat={tuning.materialClearcoat}
      clearcoatRoughness={tuning.materialClearcoatRoughness}
      iridescence={tuning.materialIridescence}
      iridescenceIOR={1.3}
    />
  );
}

export function Segment({
  color,
  arc,
  rotationZ,
  children,
  onPointerOver,
  onClick,
}: SegmentProps) {
  const [hovered, setHovered] = useState(false);
  const { scale, rotateX, rotateY } = useSpring({
    from: { scale: 1.2, rotateX: Math.PI / 16, rotateY: Math.PI / 12 },
    to: { scale: 1, rotateX: 0, rotateY: 0 },
    config: config.gentle,
  });
  useCursor(hovered);

  return (
    <Select enabled={hovered}>
      <animated.mesh
        scale={scale}
        rotation-x={rotateX}
        rotation-y={rotateY}
        rotation-z={rotationZ}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onPointerOver?.();
        }}
        onPointerOut={() => setHovered(false)}
        // Prevent arcs behind this one from also handling the raycast click.
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <torusGeometry
          args={[
            RING_RADIUS,
            TUBE_RADIUS,
            RADIAL_SEGMENTS,
            Math.max(8, Math.ceil(arc * 32)),
            arc,
          ]}
        />
        <SegmentMaterial color={color} />
        {/* Flat caps close the torus without overlapping neighboring arcs.
            Match radial segments to avoid seams; separate rotations preserve their order. */}
        {[0, arc].map((angle, i) => (
          <group key={angle} rotation-z={angle}>
            <mesh
              position={[RING_RADIUS, 0, 0]}
              // Single-sided caps must face away from the tube.
              rotation-x={i === 0 ? Math.PI / 2 : -Math.PI / 2}
            >
              <circleGeometry args={[TUBE_RADIUS, RADIAL_SEGMENTS]} />
              <SegmentMaterial color={color} />
            </mesh>
          </group>
        ))}
        {children}
      </animated.mesh>
    </Select>
  );
}
