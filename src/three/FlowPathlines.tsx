import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useSolverStore } from "@/state/useSolverStore";
import { useAeroStore } from "@/state/useAeroStore";
import { useGeometryStore } from "@/state/useGeometryStore";
import { freestreamDirection } from "@/modules/solver/vlmSolver";
import { semiInfiniteVelocity } from "@/modules/solver/biotSavart";
import { add, scale } from "@/core/math";
import type { Vec3 } from "@/core/types";

const COUNT = 220;

function seed(arr: Float32Array, i: number, min: Vec3, max: Vec3, spreadX: boolean) {
  arr[i * 3] = spreadX ? min[0] + Math.random() * (max[0] - min[0]) : max[0] + 1.5;
  arr[i * 3 + 1] = min[1] + Math.random() * (max[1] - min[1]);
  arr[i * 3 + 2] = min[2] + Math.random() * (max[2] - min[2]);
}

/**
 * Steady-flow particle animation: particles advect through
 * V∞ + wake-induced velocity (trailing vortices of the solved lattice).
 * Documented approximation (D-018): steady inviscid visualization,
 * NOT unsteady/CFD pathlines.
 */
export function FlowPathlines() {
  const panels = useSolverStore((s) => s.panels);
  const vizGamma = useSolverStore((s) => s.vizGamma);
  const velocity = useAeroStore((s) => s.velocity);
  const alpha = useAeroStore((s) => s.displayAlphaDeg);
  const model = useGeometryStore((s) => s.model);

  const legs = useMemo(() => {
    if (!panels || !vizGamma) return [];
    const d = freestreamDirection(alpha);
    return panels.map((p, i) => ({ a: p.boundA, b: p.boundB, d, g: vizGamma[i] ?? 0 }));
  }, [panels, vizGamma, alpha]);

  const min: Vec3 = model?.bbox.min ?? [-5, -5, -2];
  const max: Vec3 = model?.bbox.max ?? [5, 5, 2];

  const initial = useMemo(() => {
    const arr = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) seed(arr, i, min, max, true);
    return arr;
  }, [legs.length, min[0], min[1], min[2], max[0], max[1], max[2]]);

  const points = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (!points.current || legs.length === 0) return;
    const dt = Math.min(delta, 0.05);
    const vInf = scale(freestreamDirection(alpha), velocity);
    const attr = points.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;

    for (let i = 0; i < COUNT; i++) {
      const p: Vec3 = [arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]];
      let v = vInf;
      for (const leg of legs) {
        v = add(v, scale(semiInfiniteVelocity(p, leg.a, leg.d), leg.g));
        v = add(v, scale(semiInfiniteVelocity(p, leg.b, leg.d), leg.g));
      }
      arr[i * 3] += v[0] * dt;
      arr[i * 3 + 1] += v[1] * dt;
      arr[i * 3 + 2] += v[2] * dt;
      if (arr[i * 3] < min[0] - 3 || Math.hypot(arr[i * 3 + 1], arr[i * 3 + 2]) > 30)
        seed(arr, i, min, max, false);
    }
    attr.needsUpdate = true;
  });

  if (legs.length === 0) return null;

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initial, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.07} color="#06B6D4" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}
