import type { Vec3 } from "@/core/types";
import { sub, cross, norm, scale, add } from "@/core/math";

/**
 * Biot-Savart law for a finite vortex filament from A to B with circulation Γ.
 * Returns induced velocity at point P.
 */
export function biotSavart(P: Vec3, A: Vec3, B: Vec3, gamma: number): Vec3 {
  const r1 = sub(P, A);
  const r2 = sub(P, B);
  const dl = sub(B, A);

  const r1Norm = norm(r1);
  const r2Norm = norm(r2);

  if (r1Norm < 1e-9 || r2Norm < 1e-9) return [0, 0, 0];

  const crossProduct = cross(r1, r2);
  const crossNorm = norm(crossProduct);

  if (crossNorm < 1e-12) return [0, 0, 0];

  const dlCrossR1 = cross(dl, r1);
  const dlCrossR1Norm = norm(dlCrossR1);

  if (dlCrossR1Norm < 1e-12) return [0, 0, 0];

  // V = (Γ / 4π) * (r1 × r2) / |r1 × r2|² * (r1·dl/|r1| - r2·dl/|r2|)
  const r1DotDl = (r1[0] * dl[0] + r1[1] * dl[1] + r1[2] * dl[2]) / r1Norm;
  const r2DotDl = (r2[0] * dl[0] + r2[1] * dl[1] + r2[2] * dl[2]) / r2Norm;

  const factor = (gamma / (4 * Math.PI)) * (r1DotDl - r2DotDl) / (crossNorm * crossNorm);

  return scale(crossProduct, factor);
}

/**
 * Induced velocity from a horseshoe vortex: bound vortex AB + two semi-infinite trailing vortices.
 */
export function horseshoeInducedVelocity(
  P: Vec3,
  A: Vec3,
  B: Vec3,
  gamma: number,
  freestreamDir: Vec3
): Vec3 {
  // Bound vortex A→B
  const vBound = biotSavart(P, A, B, gamma);

  // Trailing vortex from A to infinity (along freestream)
  const Ainf = add(A, scale(freestreamDir, 1e6));
  const vTrailA = biotSavart(P, A, Ainf, -gamma);

  // Trailing vortex from B to infinity (along freestream)
  const Binf = add(B, scale(freestreamDir, 1e6));
  const vTrailB = biotSavart(P, B, Binf, gamma);

  return add(add(vBound, vTrailA), vTrailB);
}
