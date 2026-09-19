import type { ResolvedTheme } from "../theme";
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

import { useTheme } from "../theme";
import { DEFAULT_TUNING, TuningContext } from "./tuning";

const CAMERA: [number, number, number] = [0, -5, 20];
/** Frame-rate-independent damping speed. */
const LAMBDA = 3;
const CAMERA_DISTANCE = Math.hypot(...CAMERA);
// HTML labels do not scale with the camera; reserve a label's width on each side.
const LABEL_PX = 130;

// Dark surfaces need rim lighting; light surfaces need darker sides for contrast.
const SCENE: Record<
  ResolvedTheme,
  {
    lightKey: number;
    lightRim: number;
    lightFill: number;
    lightFillColor: string;
    luminanceThreshold: number;
    radius: number;
    intensity: number;
  }
> = {
  dark: {
    lightKey: 3.4,
    lightRim: 2.3,
    lightFill: 6.6,
    lightFillColor: "#b8c8ff",
    luminanceThreshold: 0.12,
    radius: 0.4,
    intensity: 0.45,
  },
  light: {
    lightKey: 1.8,
    lightRim: 0.3,
    lightFill: 7,
    lightFillColor: "#ffffff",
    luminanceThreshold: 0,
    radius: 0.6,
    intensity: 1.2,
  },
};

type CameraProps = {
  sway: number;
  fov: number;
};

// Limit motion to parallax: free orbit can turn the ring edge-on and obscure its proportions.
function ParallaxCamera({ sway, fov }: CameraProps) {
  const camera = useThree((state) => state.camera);
  const still = useRef(false);

  useEffect(() => {
    still.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // Canvas camera props only apply on mount; update the live camera for Leva changes.
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame(({ pointer, size }, delta) => {
    const amount = still.current ? 0 : sway;
    // Visible half-width is d * tan(fov / 2) * aspect, minus fixed-width HTML labels.
    const usable = Math.max(0.2, 1 - (2 * LABEL_PX) / size.width);
    const needed =
      DEFAULT_TUNING.labelRadius /
      (Math.tan(MathUtils.degToRad(fov / 2)) *
        (size.width / size.height) *
        usable);
    const retreat = Math.max(1, needed / CAMERA_DISTANCE);
    camera.position.z = MathUtils.damp(
      camera.position.z,
      CAMERA[2] * retreat,
      LAMBDA,
      delta,
    );
    camera.position.x = MathUtils.damp(
      camera.position.x,
      CAMERA[0] + pointer.x * amount,
      LAMBDA,
      delta,
    );
    camera.position.y = MathUtils.damp(
      camera.position.y,
      CAMERA[1] * retreat + pointer.y * amount,
      LAMBDA,
      delta,
    );
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

  const { resolvedTheme } = useTheme();
  const scene = SCENE[resolvedTheme];
  const [lights, setLights] = useControls("Lumières", () => ({
    lightKey: { value: scene.lightKey, min: 0, max: 12, step: 0.1 },
    lightRim: { value: scene.lightRim, min: 0, max: 12, step: 0.1 },
    lightFill: { value: scene.lightFill, min: 0, max: 12, step: 0.1 },
    lightFillColor: scene.lightFillColor,
  }));

  // Bloom the whole selected arc, not just its bright reflections.
  const [bloom, setBloom] = useControls("Halo", () => ({
    luminanceThreshold: {
      value: scene.luminanceThreshold,
      min: 0,
      max: 1,
      step: 0.01,
    },
    radius: { value: scene.radius, min: 0, max: 1, step: 0.01 },
    intensity: { value: scene.intensity, min: 0, max: 5, step: 0.05 },
  }));

  // useControls dependencies update bounds, not values; set applies theme defaults.
  useEffect(() => {
    const { lightKey, lightRim, lightFill, lightFillColor, ...halo } = scene;
    setLights({ lightKey, lightRim, lightFill, lightFillColor });
    setBloom(halo);
  }, [scene, setLights, setBloom]);

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
    // Keep Drei's depth-based HTML z-indices below application overlays.
    <div
      id="canvas-container"
      className="isolate flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="fixed bottom-4 left-4 z-50 hidden w-[280px] md:block">
        <Leva fill collapsed titleBar={{ title: "Anneau 3D" }} />
      </div>
      {/* Disable ACES tone mapping to keep category colors aligned with CSS. */}
      <Canvas flat camera={{ position: CAMERA, fov: camera.fov }}>
        {/* Generate environment lighting locally to avoid downloading an HDR asset. */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={lights.lightKey}
            color={lights.lightFillColor}
            position={[0, 6, 8]}
            scale={[12, 12, 1]}
          />
          {/* Ring-shaped backlighting follows the tubes' curvature. */}
          <Lightformer
            form="ring"
            intensity={lights.lightRim}
            color={lights.lightFillColor}
            position={[0, -7, -9]}
            scale={9}
          />
          <Lightformer
            form="rect"
            intensity={lights.lightFill}
            color={lights.lightFillColor}
            position={[-9, -4, 5]}
            scale={[9, 9, 1]}
          />
        </Environment>
        <ParallaxCamera sway={camera.sway} fov={camera.fov} />
        {/* Scene and composer must share Selection or selective bloom silently stays empty. */}
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
