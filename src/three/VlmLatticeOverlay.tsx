import { useMemo } from "react";
import { useSolverStore } from "@/state/useSolverStore";
import * as THREE from "three";

export function VlmLatticeOverlay() {
  const panels = useSolverStore((s) => s.panels);
  const results = useSolverStore((s) => s.results);

  const latticeLines = useMemo(() => {
    if (!panels || panels.length === 0) return null;

    const positions: number[] = [];

    // Bound vortex lines (quarter-chord)
    for (const panel of panels) {
      positions.push(
        panel.boundA[0], panel.boundA[1], panel.boundA[2],
        panel.boundB[0], panel.boundB[1], panel.boundB[2]
      );
    }

    // Trailing vortex stubs (from TE to short distance downstream)
    const wakeLength = 2; // Short visual stub
    for (const panel of panels) {
      // Only draw at panel edges (first and last chordwise)
      if (panel.chordIndex === 0) {
        positions.push(
          panel.teLeft[0], panel.teLeft[1], panel.teLeft[2],
          panel.teLeft[0] + wakeLength, panel.teLeft[1], panel.teLeft[2]
        );
      }
      if (panel.chordIndex === 7) { // Assuming 8 chordwise panels
        positions.push(
          panel.teRight[0], panel.teRight[1], panel.teRight[2],
          panel.teRight[0] + wakeLength, panel.teRight[1], panel.teRight[2]
        );
      }
    }

    return new THREE.Float32BufferAttribute(positions, 3);
  }, [panels]);

  if (!latticeLines) return null;

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[latticeLines.array, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#FF6600" linewidth={1} transparent opacity={0.6} />
    </lineSegments>
  );
}
