import { useAeroStore } from "@/state/useAeroStore";
import { useRecognitionStore } from "@/state/useRecognitionStore";
import { neutralPointX } from "@/modules/solver/stability";
import { useSolverStore } from "@/state/useSolverStore";

export function CgMarker() {
  const cgX = useAeroStore((s) => s.cgX);
  const cgZ = useAeroStore((s) => s.cgZ);
  const rec = useRecognitionStore((s) => s.result);
  const results = useSolverStore((s) => s.results);

  if (cgX === null || cgZ === null || !rec?.wing) return null;

  const wing = rec.wing;
  const momentRefX = wing.macX + 0.25 * wing.mac;

  // Compute neutral point from results
  let npX = momentRefX;
  if (results.length > 1) {
    npX = neutralPointX(results, wing.mac, momentRefX);
  }

  // CG marker (green sphere)
  const cgPosition: [number, number, number] = [cgX, 0, cgZ];

  // NP marker (red sphere)
  const npPosition: [number, number, number] = [npX, 0, wing.macX + 0.25 * wing.mac];

  return (
    <group>
      {/* CG marker */}
      <mesh position={cgPosition}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#22C55E" />
      </mesh>
      {/* CG cross */}
      <lineSegments position={cgPosition}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([-0.3, 0, 0, 0.3, 0, 0, 0, -0.3, 0, 0, 0.3, 0]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#22C55E" linewidth={2} />
      </lineSegments>

      {/* NP marker */}
      <mesh position={npPosition}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#EF4444" />
      </mesh>
    </group>
  );
}
