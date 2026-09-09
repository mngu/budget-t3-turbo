import type { ReactNode } from "react";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Leva, useControls } from "leva";
import { useEffect, useRef } from "react";
import { MathUtils, PerspectiveCamera } from "three";

import { DEFAULT_TUNING, TuningProvider } from "./tuning";

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
    key: { value: 4, min: 0, max: 12, step: 0.1 },
    rim: { value: 2.5, min: 0, max: 12, step: 0.1 },
    fill: { value: 1.4, min: 0, max: 12, step: 0.1 },
    fillColor: "#b8c8ff",
  });

  // Plancher à 0,70 : c'est la luminance du plus clair des intitulés en thème
  // sombre (mesurée sur la palette). En dessous, le texte bave.
  const bloom = useControls("Halo", {
    luminanceThreshold: { value: 0.75, min: 0, max: 1, step: 0.01 },
    luminanceSmoothing: { value: 0.3, min: 0, max: 1, step: 0.01 },
    radius: { value: 0.6, min: 0, max: 1, step: 0.01 },
    intensity: { value: 0.8, min: 0, max: 5, step: 0.05 },
  });

  const tuning = useControls("Matière", {
    roughness: { value: DEFAULT_TUNING.roughness, min: 0, max: 1, step: 0.01 },
    metalness: { value: DEFAULT_TUNING.metalness, min: 0, max: 1, step: 0.01 },
    clearcoat: { value: DEFAULT_TUNING.clearcoat, min: 0, max: 1, step: 0.01 },
    clearcoatRoughness: {
      value: DEFAULT_TUNING.clearcoatRoughness,
      min: 0,
      max: 1,
      step: 0.01,
    },
    iridescence: {
      value: DEFAULT_TUNING.iridescence,
      min: 0,
      max: 1,
      step: 0.01,
    },
    hoverEmissive: {
      value: DEFAULT_TUNING.hoverEmissive,
      min: 0,
      max: 4,
      step: 0.05,
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
      min: 0.1,
      max: 1,
      step: 0.01,
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
      <Leva collapsed titleBar={{ title: "Anneau 3D" }} />
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
            intensity={lights.key}
            position={[0, 6, 8]}
            scale={[12, 12, 1]}
          />
          {/* Contre-jour : derrière et sous l'anneau, il pose un liseré sur le
              bord des tubes et les détache du fond. En anneau plutôt qu'en
              panneau, pour que le liseré suive la courbe. */}
          <Lightformer
            form="ring"
            intensity={lights.rim}
            position={[0, -7, -9]}
            scale={9}
          />
          {/* Remplissage : côté caméra, froid et faible (~1/3 de la clé) pour
              éclaircir l'ombre sans la neutraliser. */}
          <Lightformer
            form="rect"
            intensity={lights.fill}
            color={lights.fillColor}
            position={[-9, -4, 5]}
            scale={[9, 9, 1]}
          />
        </Environment>
        <ParallaxCamera sway={camera.sway} fov={camera.fov} />
        <TuningProvider value={{ ...tuning, ...labels }}>
          {children}
        </TuningProvider>
        {/* Le halo des arcs — équivalent 3D des jetons `--arc-glow` /
            `--arc-glow-lit` de l'anneau SVG. */}
        <EffectComposer>
          <Bloom mipmapBlur {...bloom} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
