import type { Vec3, CadFace, ComponentType } from "@/core/types";
import { cross, dot, scale, sub } from "@/core/math";

export interface ComponentMassProperties {
  component: ComponentType;
  volume: number;
  mass: number;
  density: number;
  cg: Vec3;
  fallback: boolean;
}

/**
 * Compute volume and CG of a closed surface using the divergence theorem.
 * Volume = (1/3) ∮ r·n dA
 * CG = (1/V) ∫ r dV = (1/4V) ∮ r (r·n) dA
 *
 * For triangulated surfaces, this becomes a sum over triangles.
 */
export function computeComponentProperties(
  faces: CadFace[],
  componentMap: Record<string, ComponentType>
): ComponentMassProperties[] {
  // Group faces by component
  const groups = new Map<ComponentType, CadFace[]>();
  for (const face of faces) {
    const comp = componentMap[face.id] || "unassigned";
    if (!groups.has(comp)) groups.set(comp, []);
    groups.get(comp)!.push(face);
  }

  const results: ComponentMassProperties[] = [];

  for (const [component, compFaces] of groups) {
    if (component === "unassigned") continue;

    let volume = 0;
    let cgx = 0, cgy = 0, cgz = 0;
    let fallback = false;

    for (const face of compFaces) {
      const pos = face.position;
      const idx = face.index;

      for (let t = 0; t < idx.length; t += 3) {
        const i0 = idx[t] * 3;
        const i1 = idx[t + 1] * 3;
        const i2 = idx[t + 2] * 3;

        const v0: Vec3 = [pos[i0], pos[i0 + 1], pos[i0 + 2]];
        const v1: Vec3 = [pos[i1], pos[i1 + 1], pos[i1 + 2]];
        const v2: Vec3 = [pos[i2], pos[i2 + 1], pos[i2 + 2]];

        // Triangle normal (outward)
        const e1 = sub(v1, v0);
        const e2 = sub(v2, v0);
        const n = cross(e1, e2);
        const area = 0.5 * Math.hypot(n[0], n[1], n[2]);

        if (area < 1e-12) continue;

        // Centroid of triangle
        const cx = (v0[0] + v1[0] + v2[0]) / 3;
        const cy = (v0[1] + v1[1] + v2[1]) / 3;
        const cz = (v0[2] + v1[2] + v2[2]) / 3;

        // r·n (dot product of centroid with normal)
        const rDotN = cx * n[0] + cy * n[1] + cz * n[2];

        // Volume contribution: (1/3) * r·n * dA
        const dV = (1 / 3) * rDotN;
        volume += dV;

        // CG contribution: (1/4) * r * (r·n) * dA
        cgx += 0.25 * cx * rDotN;
        cgy += 0.25 * cy * rDotN;
        cgz += 0.25 * cz * rDotN;
      }
    }

    // Check if volume is reasonable
    if (Math.abs(volume) < 1e-6) {
      // Fallback: use bounding box volume estimate
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const face of compFaces) {
        for (let i = 0; i < face.position.length; i += 3) {
          const x = face.position[i], y = face.position[i + 1], z = face.position[i + 2];
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
        }
      }
      volume = (maxX - minX) * (maxY - minY) * (maxZ - minZ) * 0.5; // Rough estimate
      cgx = (minX + maxX) / 2 * volume;
      cgy = (minY + maxY) / 2 * volume;
      cgz = (minZ + maxZ) / 2 * volume;
      fallback = true;
    }

    const cg: Vec3 = volume > 0 ? [cgx / volume, cgy / volume, cgz / volume] : [0, 0, 0];

    results.push({
      component,
      volume: Math.abs(volume),
      mass: 0, // Will be set later with density
      density: 0, // Will be set later
      cg,
      fallback,
    });
  }

  return results;
}

/**
 * Compute overall CG from component masses and CGs.
 */
export function computeCG(
  components: Array<{ mass: number; cg: Vec3 }>
): { cg: Vec3; totalMass: number } {
  let totalMass = 0;
  let cgx = 0, cgy = 0, cgz = 0;

  for (const comp of components) {
    totalMass += comp.mass;
    cgx += comp.mass * comp.cg[0];
    cgy += comp.mass * comp.cg[1];
    cgz += comp.mass * comp.cg[2];
  }

  if (totalMass < 1e-9) {
    return { cg: [0, 0, 0], totalMass: 0 };
  }

  return {
    cg: [cgx / totalMass, cgy / totalMass, cgz / totalMass],
    totalMass,
  };
}
