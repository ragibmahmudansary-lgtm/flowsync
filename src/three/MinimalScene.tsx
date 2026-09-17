import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useUIStore } from "@/state/useUIStore";
import * as THREE from "three";

function CameraController() {
  const { camera } = useThree();
  const viewRequest = useUIStore((s) => s.viewRequest);
  const lastNonce = useRef(0);

  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === lastNonce.current) return;
    lastNonce.current = viewRequest.nonce;

    const dist = 12;
    switch (viewRequest.view) {
      case "Top":
        camera.position.set(0, 0, dist);
        break;
      case "Front":
        camera.position.set(0, -dist, 2);
        break;
      case "Side":
        camera.position.set(dist, 0, 2);
        break;
      case "Reset":
      case "Iso":
        camera.position.set(7.5, -8.5, 4.5);
        break;
    }
    camera.up.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [viewRequest, camera]);

  return null;
}

export function MinimalScene() {
  return (
    <div className="h-full w-full relative">
      <Canvas
        camera={{ position: [7.5, -8.5, 4.5], fov: 42 }}
        onCreated={({ camera }) => {
          camera.up.set(0, 0, 1);
          camera.lookAt(0, 0, 0);
        }}
      >
        <color attach="background" args={["#E8EDF2"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[10, -12, 10]} intensity={1.1} />
        <gridHelper
          args={[20, 20, "#8FA0B0", "#C6D0DA"]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -1.2]}
        />
        <axesHelper args={[2.5]} />
        <CameraController />
      </Canvas>
      <div className="absolute top-3 left-3 text-xs text-[#52606D] bg-white/80 border border-[#C3CDD8] rounded px-2 py-1 pointer-events-none">
        Phase 0 shell · CAD pipeline arrives in Phase 1 · Ctrl+K command
        palette
      </div>
    </div>
  );
}
