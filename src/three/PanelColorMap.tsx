import { useMemo } from "react";
import * as THREE from "three";
import { useSolverStore } from "@/state/useSolverStore";

/**
 * Panels colored by |Γ| (blue → red), with vertex colors.
 * Legend rendered by FlowViewport.
 */
export function PanelColorMap() {
  const panels = useSolverStore((s) => s.panels);
  const vizGamma = useSolverStore((s) => s.vizGamma);

  const geo = useMemo(() => {
    if (!panels || !vizGamma) return null;

    const pos: number[] = [];
    const col: number[] = [];
    const gmax = Math.max(...vizGamma.map(Math.abs), 1e-9);
    const color = new THREE.Color();

    panels.forEach((p, i) => {
      const t = Math.abs(vizGamma[i] ?? 0) / gmax;
      color.setHSL(0.66 - 0.66 * t, 0.85, 0.5); // blue (0.66) to red (0.0)

      const [c00, c01, c11, c10] = p.corners;
      // Two triangles: c00-c01-c11 and c00-c11-c10
      for (const v of [c00, c01, c11, c00, c11, c10]) {
        pos.push(v[0], v[1], v[2]);
        col.push(color.r, color.g, color.b);
      }
    });

    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [panels, vizGamma]);

  if (!geo) return null;

  return (
    <mesh geometry={geo}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={0.85} />
    </mesh>
  );
}
