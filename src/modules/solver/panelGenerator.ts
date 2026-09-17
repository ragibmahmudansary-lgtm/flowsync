import type { Vec3, VlmStation } from "@/core/types";

export interface VlmSurfaceInput {
  id: string;
  name: string;
  stations: VlmStation[];
}

export interface VlmPanel {
  // Panel corner points (in flow plane, z=0 for flat panels)
  leLeft: Vec3;
  leRight: Vec3;
  teLeft: Vec3;
  teRight: Vec3;
  // Corners in order for rendering: [leLeft, leRight, teRight, teLeft]
  corners: [Vec3, Vec3, Vec3, Vec3];
  // Bound vortex endpoints (quarter-chord)
  boundA: Vec3;
  boundB: Vec3;
  // Control point (three-quarter chord)
  controlPoint: Vec3;
  // Normal vector (for no-penetration BC)
  normal: Vec3;
  // Panel area
  area: number;
  // Local chord
  chord: number;
  // Spanwise position (y at panel center)
  y: number;
  // Surface membership
  surfaceId: string;
  // Index within surface
  spanIndex: number;
  chordIndex: number;
}

/**
 * Generate VLM panels from lifting surface stations.
 * Each station defines a spanwise section with LE, TE, and z.
 * Panels are generated between adjacent stations (spanwise) and
 * subdivided chordwise.
 */
export function generatePanels(
  surfaces: VlmSurfaceInput[],
  spanwisePanels: number,
  chordwisePanels: number
): VlmPanel[] {
  const panels: VlmPanel[] = [];

  for (const surface of surfaces) {
    const stations = surface.stations;
    if (stations.length < 2) continue;

    // Sort stations by y
    const sorted = [...stations].sort((a, b) => a.y - b.y);

    // Interpolate to uniform spanwise distribution
    const yMin = sorted[0].y;
    const yMax = sorted[sorted.length - 1].y;
    const spanwiseStations: VlmStation[] = [];

    for (let i = 0; i <= spanwisePanels; i++) {
      const y = yMin + (yMax - yMin) * (i / spanwisePanels);
      // Find bracketing stations
      let lo = sorted[0], hi = sorted[sorted.length - 1];
      for (let j = 0; j < sorted.length - 1; j++) {
        if (sorted[j].y <= y && sorted[j + 1].y >= y) {
          lo = sorted[j];
          hi = sorted[j + 1];
          break;
        }
      }
      const t = hi.y !== lo.y ? (y - lo.y) / (hi.y - lo.y) : 0;
      spanwiseStations.push({
        y,
        xLe: lo.xLe + t * (hi.xLe - lo.xLe),
        xTe: lo.xTe + t * (hi.xTe - lo.xTe),
        z: lo.z + t * (hi.z - lo.z),
      });
    }

    // Generate panels between adjacent spanwise stations
    for (let si = 0; si < spanwisePanels; si++) {
      const s0 = spanwiseStations[si];
      const s1 = spanwiseStations[si + 1];

      for (let ci = 0; ci < chordwisePanels; ci++) {
        const t0 = ci / chordwisePanels;
        const t1 = (ci + 1) / chordwisePanels;

        // LE and TE at this chordwise station
        const xLe0 = s0.xLe + t0 * (s0.xTe - s0.xLe);
        const xLe1 = s0.xLe + t1 * (s0.xTe - s0.xLe);
        const xRe0 = s1.xLe + t0 * (s1.xTe - s1.xLe);
        const xRe1 = s1.xLe + t1 * (s1.xTe - s1.xLe);
        const zLe0 = s0.z;
        const zRe0 = s1.z;

        // Panel corners
        const leLeft: Vec3 = [xLe0, s0.y, zLe0];
        const leRight: Vec3 = [xRe0, s1.y, zRe0];
        const teLeft: Vec3 = [xLe1, s0.y, zLe0];
        const teRight: Vec3 = [xRe1, s1.y, zRe0];

        // Bound vortex at quarter-chord
        const qA: Vec3 = [
          xLe0 + 0.25 * (xLe1 - xLe0),
          s0.y,
          zLe0,
        ];
        const qB: Vec3 = [
          xRe0 + 0.25 * (xRe1 - xRe0),
          s1.y,
          zRe0,
        ];

        // Control point at three-quarter chord
        const cp: Vec3 = [
          (xLe0 + xRe0) / 2 + 0.75 * ((xLe1 + xRe1) / 2 - (xLe0 + xRe0) / 2),
          (s0.y + s1.y) / 2,
          (zLe0 + zRe0) / 2,
        ];

        // Panel normal (from cross product of chord and span vectors)
        const chordVec = [
          (xLe1 + xRe1) / 2 - (xLe0 + xRe0) / 2,
          0,
          0,
        ];
        const spanVec = [
          0,
          s1.y - s0.y,
          zRe0 - zLe0,
        ];
        const nx = chordVec[1] * spanVec[2] - chordVec[2] * spanVec[1];
        const ny = chordVec[2] * spanVec[0] - chordVec[0] * spanVec[2];
        const nz = chordVec[0] * spanVec[1] - chordVec[1] * spanVec[0];
        const nLen = Math.hypot(nx, ny, nz) || 1;
        const normal: Vec3 = [nx / nLen, ny / nLen, nz / nLen];

        // Panel area (trapezoid approximation)
        const cLeft = xLe1 - xLe0;
        const cRight = xRe1 - xRe0;
        const dy = s1.y - s0.y;
        const area = 0.5 * (cLeft + cRight) * dy;

        const chord = 0.5 * (cLeft + cRight);
        const y = (s0.y + s1.y) / 2;

        panels.push({
          leLeft,
          leRight,
          teLeft,
          teRight,
          corners: [leLeft, leRight, teRight, teLeft],
          boundA: qA,
          boundB: qB,
          controlPoint: cp,
          normal,
          area,
          chord,
          y,
          surfaceId: surface.id,
          spanIndex: si,
          chordIndex: ci,
        });
      }
    }
  }

  return panels;
}
