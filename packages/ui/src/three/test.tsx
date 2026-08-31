import { Canvas } from "@react-three/fiber";

export function Test() {
  return (
    <div id="canvas-container" className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Canvas>
        <ambientLight intensity={0.7} />
        <mesh>
          <torusGeometry args={[5, 3, 16, 100, Math.PI * 2]} />
          <meshStandardMaterial />
        </mesh>
      </Canvas>
    </div>
  );
}
