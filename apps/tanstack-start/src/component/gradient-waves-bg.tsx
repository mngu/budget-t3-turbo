import { useEffect, useRef } from "react";

import { useTheme } from "@budget/ui/theme";

/**
 * Fond animé de `/login` — port de « GradientWaves » (React Bits,
 * DavidHDev/react-bits, MIT) tel que `Connexion.dc.html` le monte : une houle
 * en raymarching, calculée par pixel dans un shader.
 *
 * Le GLSL est repris **mot pour mot** de la source ; seule la couche OGL
 * (Renderer/Program/Mesh/Triangle) est remplacée par du WebGL2 brut, pour ne
 * pas faire entrer une librairie 3D dans le bundle pour un seul écran. Les
 * uniformes qui ne bougent jamais sont posés une fois à l'initialisation, pas
 * à chaque image comme dans la source.
 *
 * Deux écarts avec la maquette :
 * - `prefers-reduced-motion` **arrête** la boucle après une image (et coupe la
 *   parallaxe), là où la source gèle le temps et continue de repeindre ;
 * - sans WebGL2, le canvas reste transparent : il ne reste que le voile sur
 *   `--background`, l'écran est intact.
 */

// prettier-ignore
const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

// prettier-ignore
const FRAG = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uWaveScale;
uniform float uWaveRatio;
uniform float uSwell;
uniform float uTurbulence;
uniform float uTilt;
uniform float uZoom;
uniform float uHeight;
uniform float uFogDepth;
uniform float uSteps;
uniform float uBrightness;
uniform float uOpacity;
uniform float uGrain;
uniform float uGrainIntensity;
uniform vec2 uMouse;
uniform float uParallax;
uniform bool uEnableMouse;
uniform vec3 uHorizonColor;
uniform vec3 uWaveColor;
uniform vec3 uCrestColor;
out vec4 fragColor;

const float MAX_DIST = 20000.0;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float plasma(vec3 r, vec2 freq, vec4 tc) {
  float mx = r.x + tc.x;
  mx += uSwell * sin((r.y + mx) / 20.0 + tc.y);
  float my = r.y - tc.z;
  my += uTurbulence * cos(r.x / 23.0 + tc.w);
  return r.z - (sin(mx * freq.x) * uAmplitude + sin(my * freq.y) * uAmplitude + uHeight);
}

float raymarch(vec3 pos, vec3 dir, vec2 freq, vec4 tc) {
  float dist = 0.0;
  for (int i = 0; i < 128; i++) {
    if (float(i) >= uSteps) break;
    float dscene = plasma(pos + dist * dir, freq, tc);
    if (abs(dscene) < 0.1) break;
    dist += 0.9 * dscene;
    if (!(abs(dist) < MAX_DIST)) return MAX_DIST;
  }
  return dist;
}

void main() {
  float T = iTime * uSpeed;
  vec2 freq = vec2(uWaveScale / 7.0, (uWaveScale * uWaveRatio) / 3.0);
  vec4 tc = vec4(T / 0.130, T / 0.810, T / 0.200, T / 0.710);
  float c, s;
  float vfov = (3.14159 / 2.3) / max(uZoom, 0.05);
  vec3 cam = vec3(0.0, 0.0, 30.0);
  vec2 uv = (gl_FragCoord.xy / iResolution.xy) - 0.5;
  uv.x *= iResolution.x / iResolution.y;
  uv.y *= -1.0;

  vec3 dir = vec3(0.0, 0.0, -1.0);
  float ulen = length(uv);
  float xrot = vfov * ulen;
  c = cos(xrot); s = sin(xrot);
  dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  vec2 nuv = ulen > 1e-5 ? uv / ulen : vec2(1.0, 0.0);
  c = nuv.x; s = nuv.y;
  dir = mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0) * dir;
  c = cos(uTilt); s = sin(uTilt);
  dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;

  if (uEnableMouse) {
    float yaw = (uMouse.x - 0.5) * uParallax * 0.4;
    float pitch = (uMouse.y - 0.5) * uParallax * 0.4;
    c = cos(yaw); s = sin(yaw);
    dir = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c) * dir;
    c = cos(pitch); s = sin(pitch);
    dir = mat3(1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c) * dir;
  }

  float dist = raymarch(cam, dir, freq, tc);
  vec3 pos = cam + dist * dir;

  float t = clamp(uFogDepth / max(dist, 0.001), 0.0, 1.0);
  vec3 body = mix(uWaveColor, uCrestColor, clamp(pos.z * 0.08 + 0.5, 0.0, 1.0));
  vec3 col = mix(uHorizonColor, body, t);
  col *= uBrightness;
  col = clamp(col, 0.0, 1.0);

  float alpha = clamp(t, 0.0, 1.0) * uOpacity;
  if (uGrain > 0.5) {
    float g = hash21(gl_FragCoord.xy + mod(iTime, 64.0) * 11.0);
    alpha += (g - 0.5) * uGrainIntensity;
  }
  alpha = clamp(alpha, 0.0, 1.0);
  fragColor = vec4(col * alpha, alpha);
}
`;

/**
 * `speed` et `tilt` viennent des attributs de la maquette, le reste des valeurs
 * par défaut de la source — que la maquette ne redéfinit pas.
 */
const FIXED: Record<string, number> = {
  uSpeed: 0.28,
  uTilt: 1.16,
  uAmplitude: 2.5,
  uWaveScale: 0.6,
  uWaveRatio: 0.9,
  uSwell: 35,
  uTurbulence: 20,
  uZoom: 1,
  uHeight: 5.5,
  uSteps: 70,
  uGrain: 1,
  uGrainIntensity: 0.05,
  uParallax: 0.5,
};

/**
 * Houle dérivée de l'indigo de la marque plutôt que du rose d'origine. En thème
 * clair elle doit être **plus sombre** que la page : une crête blanche sur un
 * fond quasi blanc ne se verrait pas — d'où la crête lavande et le creux
 * indigo. Et c'est la profondeur de brouillard, pas la couleur, qui commande la
 * présence à l'écran (`alpha = fogDepth / distance`) : il en faut bien plus en
 * clair pour que la houle existe.
 */
const PALETTE = {
  light: {
    horizon: "#7d86dd",
    wave: "#1f2a86",
    crest: "#6f7ce8",
    opacity: 1,
    brightness: 1,
    fog: 52,
  },
  dark: {
    horizon: "#171b2e",
    wave: "#2f3a86",
    crest: "#8fa0ff",
    opacity: 0.85,
    brightness: 0.95,
    fog: 22,
  },
};

const rgb = (hex: string) => ({
  r: parseInt(hex.slice(1, 3), 16) / 255,
  g: parseInt(hex.slice(3, 5), 16) / 255,
  b: parseInt(hex.slice(5, 7), 16) / 255,
});

export function GradientWavesBg() {
  const { resolvedTheme } = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!canvas || !gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(sh));
      }
      return sh;
    };

    const prog = gl.createProgram();
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Le shader sort une couleur prémultipliée : la houle se fond dans le fond
    // de la page au lieu de le recouvrir.
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Triangle plein écran — l'équivalent du `Triangle` d'OGL.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(prog, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const at = (name: string) => gl.getUniformLocation(prog, name);
    for (const [name, value] of Object.entries(FIXED)) {
      gl.uniform1f(at(name), value);
    }
    gl.uniform1i(at("uEnableMouse"), 1);

    const skin = PALETTE[resolvedTheme];
    for (const [name, hex] of [
      ["uHorizonColor", skin.horizon],
      ["uWaveColor", skin.wave],
      ["uCrestColor", skin.crest],
    ] as const) {
      const { r, g, b } = rgb(hex);
      gl.uniform3f(at(name), r, g, b);
    }
    gl.uniform1f(at("uFogDepth"), skin.fog);
    gl.uniform1f(at("uBrightness"), skin.brightness);
    gl.uniform1f(at("uOpacity"), skin.opacity);

    const uResolution = at("iResolution");
    const uTime = at("iTime");
    const uMouse = at("uMouse");

    const setSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    // La parallaxe suit le curseur avec retard : le déplacement de la caméra
    // reste doux même sur un geste sec.
    const cur = { x: 0.5, y: 0.5 };
    const target = { x: 0.5, y: 0.5 };

    const draw = (seconds: number) => {
      cur.x += 0.05 * (target.x - cur.x);
      cur.y += 0.05 * (target.y - cur.y);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      gl.uniform2f(uMouse, cur.x, cur.y);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      target.x = (e.clientX - rect.left) / rect.width;
      target.y = 1 - (e.clientY - rect.top) / rect.height;
    };
    const onLeave = () => {
      target.x = 0.5;
      target.y = 0.5;
    };

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ro = new ResizeObserver(() => {
      setSize();
      if (still) draw(0);
    });
    ro.observe(canvas);
    setSize();

    if (still) {
      draw(0);
      return () => ro.disconnect();
    }

    const t0 = performance.now();
    let raf = requestAnimationFrame(function frame(t) {
      draw((t - t0) * 0.001);
      raf = requestAnimationFrame(frame);
    });
    addEventListener("pointermove", onMove, { passive: true });
    addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      ro.disconnect();
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [resolvedTheme]);

  return <canvas ref={ref} className="absolute inset-0 block size-full" />;
}
