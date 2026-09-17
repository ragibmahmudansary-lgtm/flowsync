import type { BoundingBox, CadFace } from "@/core/types";

export interface RawFaceMesh {
  name: string;
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
}

export const PALETTE = [
  "#4F86C6",
  "#5FA777",
  "#8E7CC3",
  "#C98A4B",
  "#5BA3A3",
  "#7A8B99",
  "#D4768A",
  "#6B8E23",
];

export function computeFlatNormals(
  position: Float32Array,
  index: Uint32Array
): Float32Array {
  const normals = new Float32Array(position.length);
  for (let t = 0; t < index.length; t += 3) {
    const ia = index[t] * 3,
      ib = index[t + 1] * 3,
      ic = index[t + 2] * 3;
    const ax = position[ib] - position[ia],
      ay = position[ib + 1] - position[ia + 1],
      az = position[ib + 2] - position[ia + 2];
    const bx = position[ic] - position[ia],
      by = position[ic + 1] - position[ia + 1],
      bz = position[ic + 2] - position[ia + 2];
    let nx = ay * bz - az * by,
      ny = az * bx - ax * bz,
      nz = ax * by - ay * bx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    for (const vi of [ia, ib, ic]) {
      normals[vi] = nx;
      normals[vi + 1] = ny;
      normals[vi + 2] = nz;
    }
  }
  return normals;
}

/** Per-face engineering properties: area, centroid, area-weighted normal, bbox. */
export function buildFace(
  id: string,
  name: string,
  format: string,
  position: Float32Array,
  normal: Float32Array,
  index: Uint32Array,
  baseColor: string
): CadFace {
  let safeNormal = normal;
  if (
    safeNormal.length !== position.length ||
    safeNormal.every((v) => v === 0)
  )
    safeNormal = computeFlatNormals(position, index);

  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.length; i += 3)
    for (let a = 0; a < 3; a++) {
      const v = position[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }

  let area = 0,
    cx = 0,
    cy = 0,
    cz = 0,
    nx = 0,
    ny = 0,
    nz = 0;
  for (let t = 0; t < index.length; t += 3) {
    const ia = index[t] * 3,
      ib = index[t + 1] * 3,
      ic = index[t + 2] * 3;
    const ax = position[ib] - position[ia],
      ay = position[ib + 1] - position[ia + 1],
      az = position[ib + 2] - position[ia + 2];
    const bx = position[ic] - position[ia],
      by = position[ic + 1] - position[ia + 1],
      bz = position[ic + 2] - position[ia + 2];
    const crossX = ay * bz - az * by,
      crossY = az * bx - ax * bz,
      crossZ = ax * by - ay * bx;
    const triArea = 0.5 * Math.hypot(crossX, crossY, crossZ);
    area += triArea;
    cx += triArea * (position[ia] + position[ib] + position[ic]) / 3;
    cy += triArea * (position[ia + 1] + position[ib + 1] + position[ic + 1]) / 3;
    cz += triArea * (position[ia + 2] + position[ib + 2] + position[ic + 2]) / 3;
    nx += crossX;
    ny += crossY;
    nz += crossZ;
  }
  const nLen = Math.hypot(nx, ny, nz) || 1;

  return {
    id,
    name,
    format,
    position,
    normal: safeNormal,
    index,
    area,
    centroid: area > 0 ? [cx / area, cy / area, cz / area] : [0, 0, 0],
    avgNormal: [nx / nLen, ny / nLen, nz / nLen],
    bbox: { min, max },
    baseColor,
  };
}

export function combineBounds(faces: CadFace[]): BoundingBox {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const f of faces)
    for (let a = 0; a < 3; a++) {
      if (f.bbox.min[a] < min[a]) min[a] = f.bbox.min[a];
      if (f.bbox.max[a] > max[a]) max[a] = f.bbox.max[a];
    }
  return { min, max };
}
