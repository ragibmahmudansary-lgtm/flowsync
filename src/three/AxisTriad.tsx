import { useMemo } from "react";
import * as THREE from "three";

interface AxisTriadProps {
  position?: [number, number, number];
}

/**
 * Axis triad showing X (red), Y (green), Z (blue) directions.
 */
export function AxisTriad({ position = [0, 0, 0] }: AxisTriadProps) {
  const length = 1.5;

  const geometry = useMemo(() => {
    const positions = new Float32Array([
      // X axis (red)
      0, 0, 0, length, 0, 0,
      // Y axis (green)
      0, 0, 0, 0, length, 0,
      // Z axis (blue)
      0, 0, 0, 0, 0, length,
    ]);
    const colors = new Float32Array([
      // X - red
      1, 0, 0, 1, 0, 0,
      // Y - green
      0, 1, 0, 0, 1, 0,
      // Z - blue
      0, 0, 1, 0, 0, 1,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  return (
    <group position={position}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial vertexColors linewidth={2} />
      </lineSegments>
    </group>
  );
}
