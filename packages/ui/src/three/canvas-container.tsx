import type { ReactNode } from "react";

import {
  Environment,
  Lightformer,
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";

type Props = {
  children?: ReactNode;
};

export function CanvasContainer({ children }: Props) {
  return (
    <div id="canvas-container" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* `flat` coupe le tone mapping ACES appliqué par défaut : sans lui les
          teintes de catégorie arrivent désaturées et décalées par rapport aux
          jetons CSS, alors que la couleur *est* l'encodage. */}
      <Canvas flat>
        {/* Éclairage par image, généré à la volée à partir de ses enfants :
            aucun HDR téléchargé, contrairement à `<Environment preset="…">`.
            L'ancienne `ambientLight intensity={1}` remplissait tout et annulait
            le relief que les deux directionnelles essayaient de créer. */}
        <Environment resolution={256}>
          {/* Clé : grand panneau devant et au-dessus de l'anneau. */}
          <Lightformer
            form="rect"
            intensity={4}
            position={[0, 6, 8]}
            scale={[12, 12, 1]}
          />
          {/* Contre-jour : derrière et sous l'anneau, il pose un liseré sur le
              bord des tubes et les détache du fond. En anneau plutôt qu'en
              panneau, pour que le liseré suive la courbe. */}
          <Lightformer
            form="ring"
            intensity={2.5}
            position={[0, -7, -9]}
            scale={9}
          />
          {/* Remplissage : côté caméra, froid et faible (~1/3 de la clé) pour
              éclaircir l'ombre sans la neutraliser. */}
          <Lightformer
            form="rect"
            intensity={1.4}
            color="#b8c8ff"
            position={[-9, -4, 5]}
            scale={[9, 9, 1]}
          />
        </Environment>
        <PerspectiveCamera makeDefault position={[-5, -10, 12]} />
        {children}
        <OrbitControls makeDefault />
        {/* Le halo des arcs — équivalent 3D des jetons `--arc-glow` /
            `--arc-glow-lit` de l'anneau SVG. Le seuil est au-dessus de ce que
            l'éclairage seul produit : seul l'`emissiveIntensity` d'un arc
            survolé, poussé au-delà de 1, franchit la barre et déborde. Sans
            tone mapping (`flat`), rien d'autre ne monte aussi haut. */}
        <EffectComposer>
          <Bloom mipmapBlur luminanceThreshold={0.9} intensity={1.2} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
