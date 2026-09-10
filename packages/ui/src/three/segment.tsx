import type { SpringValue } from "@react-spring/three";
import type { ReactNode } from "react";

import { animated, config, useSpring } from "@react-spring/three";
import { useCursor } from "@react-three/drei";
import { useState } from "react";

import { useTuning } from "./tuning";

const RING_RADIUS = 5;
const TUBE_RADIUS = 1;
/** Partagé par le tore et ses bouchons : voir plus bas. */
const RADIAL_SEGMENTS = 24;
/** Jour angulaire entre deux arcs, rogné sur les arcs trop courts pour l'absorber. */
const GAP = 0.0;

// Aucun prop n'est reversé dans le `mesh` : ce qu'un plugin de dev injecte
// dans `<Segment>` (`data-insp-path`) ferait tomber R3F. Voir vite.config.ts.
type SegmentProps = {
  color: string;
  arc: number;
  rotationZ: number;
  children?: ReactNode;
  onPointerOver?: () => void;
  onPointerOut?: () => void;
};

type MaterialProps = {
  color: string;
  emissiveIntensity: SpringValue<number>;
};

/** Partagé par le tube et ses deux bouchons : ils doivent réagir au survol ensemble. */
function SegmentMaterial({ color, emissiveIntensity }: MaterialProps) {
  const tuning = useTuning();

  return (
    <animated.meshPhysicalMaterial
      color={color}
      roughness={tuning.roughness}
      metalness={tuning.metalness}
      clearcoat={tuning.clearcoat}
      clearcoatRoughness={tuning.clearcoatRoughness}
      iridescence={tuning.iridescence}
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
  onPointerOver,
  onPointerOut,
}: SegmentProps) {
  const [hovered, setHovered] = useState(false);
  const { hoverEmissive } = useTuning();
  const { emissiveIntensity } = useSpring({
    // Au-delà de 1 la teinte sort de l'intervalle affichable et déborde dans le
    // `Bloom` du composeur : c'est ce qui fait le halo, pas l'éclaircissement.
    emissiveIntensity: hovered ? hoverEmissive : 0,
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
      scale={scale}
      rotation-x={rotateX}
      rotation-y={rotateY}
      rotation-z={rotationZ + gap / 2}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onPointerOver?.();
      }}
      onPointerOut={() => {
        setHovered(false);
        onPointerOut?.();
      }}
    >
      <torusGeometry
        args={[
          RING_RADIUS,
          TUBE_RADIUS,
          RADIAL_SEGMENTS,
          Math.max(8, Math.ceil(drawn * 32)),
          drawn,
        ]}
      />
      <SegmentMaterial color={color} emissiveIntensity={emissiveIntensity} />
      {/* `torusGeometry` laisse un arc partiel ouvert aux deux bouts : sans ces
          disques on regarde à l'intérieur du tube. Un disque et non une sphère :
          l'ouverture est plate, une sphère déborderait d'un rayon de tube entier
          — bien plus que le jour entre deux arcs — et les bouchons voisins se
          traverseraient, ce qui donne la jonction bombée qu'on voyait avant.
          Le `RADIAL_SEGMENTS` est le même que celui du tore : les sommets du
          bord tombent alors sur ceux de l'ouverture, sans couture ni z-fight.
          Le `group` porte la rotation autour de l'anneau et le `mesh` celle du
          disque : trois rotations dans un seul Euler s'appliqueraient dans
          l'ordre Rx·Ry·Rz, pas dans celui qu'on lit. */}
      {[0, drawn].map((angle, i) => (
        <group key={angle} rotation-z={angle}>
          <mesh
            position={[RING_RADIUS, 0, 0]}
            // Les faces sont simples : chaque bouchon doit tourner le dos au tube.
            rotation-x={i === 0 ? Math.PI / 2 : -Math.PI / 2}
          >
            <circleGeometry args={[TUBE_RADIUS, RADIAL_SEGMENTS]} />
            <SegmentMaterial
              color={color}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        </group>
      ))}
      {children}
    </animated.mesh>
  );
}
