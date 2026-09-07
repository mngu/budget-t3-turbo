import type { SpringValue } from "@react-spring/three";
import type { ThreeElements } from "@react-three/fiber";

import { animated, config, useSpring } from "@react-spring/three";
import { useCursor } from "@react-three/drei";
import { useState } from "react";

const RING_RADIUS = 5;
const TUBE_RADIUS = 1;
/** Jour angulaire entre deux arcs, rogné sur les arcs trop courts pour l'absorber. */
const GAP = 0.03;

type SegmentProps = ThreeElements["mesh"] & {
  color: string;
  arc: number;
  rotationZ: number;
};

type MaterialProps = {
  color: string;
  emissiveIntensity: SpringValue<number>;
};

/** Partagé par le tube et ses deux bouchons : ils doivent réagir au survol ensemble. */
function SegmentMaterial({ color, emissiveIntensity }: MaterialProps) {
  return (
    <animated.meshPhysicalMaterial
      color={color}
      roughness={0.35}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.15}
      iridescence={0.35}
      iridescenceIOR={1.3}
      emissive={color}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

export function Segment({
  color,
  arc,
  rotationZ,
  children,
  ...rest
}: SegmentProps) {
  const [hovered, setHovered] = useState(false);
  const { emissiveIntensity } = useSpring({
    // Au-delà de 1 la teinte sort de l'intervalle affichable et déborde dans le
    // `Bloom` du composeur : c'est ce qui fait le halo, pas l'éclaircissement.
    emissiveIntensity: hovered ? 1 : 0,
    config: config.gentle,
  });
  const { scale, rotateX, rotateY } = useSpring({
    from: { scale: 1.2, rotateX: Math.PI / 16, rotateY: Math.PI / 12 },
    to: { scale: 1, rotateX: 0, rotateY: 0 },
    config: config.gentle,
  });
  useCursor(hovered);

  const gap = Math.min(GAP, arc * 0.3);
  const drawn = arc - gap;

  return (
    <animated.mesh
      {...rest}
      scale={scale}
      rotation-x={rotateX}
      rotation-y={rotateY}
      rotation-z={rotationZ + gap / 2}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      <torusGeometry
        args={[
          RING_RADIUS,
          TUBE_RADIUS,
          24,
          Math.max(8, Math.ceil(drawn * 32)),
          drawn,
        ]}
      />
      <SegmentMaterial color={color} emissiveIntensity={emissiveIntensity} />
      {/* `torusGeometry` laisse un arc partiel ouvert aux deux bouts : sans ces
          sphères on regarde à l'intérieur du tube. */}
      {[0, drawn].map((angle) => (
        <mesh
          key={angle}
          position={[
            RING_RADIUS * Math.cos(angle),
            RING_RADIUS * Math.sin(angle),
            0,
          ]}
        >
          <sphereGeometry args={[TUBE_RADIUS, 24, 16]} />
          <SegmentMaterial
            color={color}
            emissiveIntensity={emissiveIntensity}
          />
        </mesh>
      ))}
      {children}
    </animated.mesh>
  );
}
