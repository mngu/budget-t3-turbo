import type { ReactNode } from "react";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Selection,
  SelectiveBloom,
} from "@react-three/postprocessing";
import { Leva, useControls } from "leva";
import { useEffect, useRef } from "react";
import { MathUtils, PerspectiveCamera } from "three";

import { DEFAULT_TUNING, TuningContext } from "./tuning";

/** Position de repos, celle qu'occupait `PerspectiveCamera`. */
const CAMERA: [number, number, number] = [0, -5, 20];
/** Vitesse de rattrapage de `damp` — indépendante du framerate, contrairement
 *  à un `lerp` à facteur constant. */
const LAMBDA = 3;

type CameraProps = {
  sway: number;
  fov: number;
};

/**
 * Remplace `OrbitControls` : la caméra suit le pointeur de quelques unités et
 * revient au repos. L'orbite libre laissait mettre l'anneau de chant, ce qui
 * détruit la lecture des parts — et faisait passer les intitulés du fond
 * devant les arcs proches.
 */
function ParallaxCamera({ sway, fov }: CameraProps) {
  const camera = useThree((state) => state.camera);
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // `<Canvas camera>` ne s'applique qu'au montage : sans ça le curseur de leva
  // ne ferait rien.
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame(({ pointer }, delta) => {
    const amount = still.current ? 0 : sway;
    camera.position.x = MathUtils.damp(
      camera.position.x,
      CAMERA[0] + pointer.x * amount,
      LAMBDA,
      delta,
    );
    camera.position.y = MathUtils.damp(
      camera.position.y,
      CAMERA[1] + pointer.y * amount,
      LAMBDA,
      delta,
    );
    // Sans `OrbitControls`, plus rien ne recentre la caméra sur l'anneau.
    camera.lookAt(0, 0, 0);
  });

  return null;
}

type Props = {
  children?: ReactNode;
};

export function CanvasContainer({ children }: Props) {
  const camera = useControls("Caméra", {
    fov: { value: 50, min: 20, max: 90, step: 1 },
    sway: { value: 2.2, min: 0, max: 6, step: 0.1 },
  });

  const lights = useControls("Lumières", {
    lightKey: { value: 3.4, min: 0, max: 12, step: 0.1 },
    lightRim: { value: 2.3, min: 0, max: 12, step: 0.1 },
    lightFill: { value: 6.6, min: 0, max: 12, step: 0.1 },
    lightFillColor: "#b8c8ff",
  });

  // Seuil à 0 : seul l'arc survolé (`<Select>`) entre dans la passe, il doit
  // rayonner en entier, dans sa teinte — pas seulement ses reflets.
  const bloom = useControls("Halo", {
    luminanceThreshold: {
      value: 0.12,
      min: 0,
      max: 1,
      step: 0.01,
    },
    radius: {
      value: 0.4,
      min: 0,
      max: 1,
      step: 0.01,
    },
    intensity: {
      value: 0.45,
      min: 0,
      max: 5,
      step: 0.05,
    },
  });

  const tuning = useControls("Matière", {
    materialRoughness: {
      value: DEFAULT_TUNING.materialRoughness,
      min: 0,
      max: 1,
      step: 0.01,
    },
    materialMetalness: {
      value: DEFAULT_TUNING.materialMetalness,
      min: 0,
      max: 1,
      step: 0.01,
    },
    materialClearcoat: {
      value: DEFAULT_TUNING.materialClearcoat,
      min: 0,
      max: 1,
      step: 0.01,
    },
    materialClearcoatRoughness: {
      value: DEFAULT_TUNING.materialClearcoatRoughness,
      min: 0,
      max: 1,
      step: 0.01,
    },
    materialIridescence: {
      value: DEFAULT_TUNING.materialIridescence,
      min: 0,
      max: 1,
      step: 0.01,
    },
  });

  const labels = useControls("Intitulés", {
    labelBlend: {
      value: DEFAULT_TUNING.labelBlend,
      min: 0,
      max: 1,
      step: 0.01,
    },
    labelSize: {
      value: DEFAULT_TUNING.labelSize,
      min: 6,
      max: 64,
      step: 1,
    },
    labelLift: { value: DEFAULT_TUNING.labelLift, min: 0, max: 6, step: 0.1 },
    labelRadius: {
      value: DEFAULT_TUNING.labelRadius,
      min: 5,
      max: 12,
      step: 0.1,
    },
  });

  return (
    <div id="canvas-container" className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* `fill` rend le panneau en flux dans son parent au lieu du coin haut
          droit fixé par leva : c'est le wrapper qui choisit le coin. */}
      <div className="fixed bottom-4 left-4 z-50 w-[280px]">
        <Leva fill collapsed titleBar={{ title: "Anneau 3D" }} />
      </div>
      {/* `flat` coupe le tone mapping ACES appliqué par défaut : sans lui les
          teintes de catégorie arrivent désaturées et décalées par rapport aux
          jetons CSS, alors que la couleur *est* l'encodage. */}
      <Canvas flat camera={{ position: CAMERA, fov: camera.fov }}>
        {/* Éclairage par image, généré à la volée à partir de ses enfants :
            aucun HDR téléchargé, contrairement à `<Environment preset="…">`.
            L'ancienne `ambientLight intensity={1}` remplissait tout et annulait
            le relief que les deux directionnelles essayaient de créer. */}
        <Environment resolution={256}>
          {/* Clé : grand panneau devant et au-dessus de l'anneau. */}
          <Lightformer
            form="rect"
            intensity={lights.lightKey}
            position={[0, 6, 8]}
            scale={[12, 12, 1]}
          />
          {/* Contre-jour : derrière et sous l'anneau, il pose un liseré sur le
              bord des tubes et les détache du fond. En anneau plutôt qu'en
              panneau, pour que le liseré suive la courbe. */}
          <Lightformer
            form="ring"
            intensity={lights.lightRim}
            position={[0, -7, -9]}
            scale={9}
          />
          {/* Remplissage : côté caméra, froid et faible (~1/3 de la clé) pour
              éclaircir l'ombre sans la neutraliser. */}
          <Lightformer
            form="rect"
            intensity={lights.lightFill}
            color={lights.lightFillColor}
            position={[-9, -4, 5]}
            scale={[9, 9, 1]}
          />
        </Environment>
        <ParallaxCamera sway={camera.sway} fov={camera.fov} />
        {/* `Selection` doit englober la scène *et* le composeur : sans le
            contexte, `SelectiveBloom` retombe sur une sélection vide, en
            silence. Le halo est l'équivalent 3D du jeton `--arc-glow-lit` de
            l'anneau SVG ; il n'y a pas de `--arc-glow` au repos. */}
        <Selection>
          <TuningContext value={{ ...tuning, ...labels }}>
            {children}
          </TuningContext>
          <EffectComposer>
            <SelectiveBloom mipmapBlur {...bloom} />
          </EffectComposer>
        </Selection>
      </Canvas>
    </div>
  );
}
