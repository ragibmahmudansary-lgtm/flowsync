import type { RawFaceMesh } from "./faceProperties";

interface WeldedVertex {
  x: number;
  y: number;
  z: number;
  triIdx: number;
}

/**
 * Position-welded dihedral-angle BFS segmentation.
 * Adaptive angle thresholds [28, 35, 45]° — picks the one that gives
 * the most physically meaningful split (2–2000 regions). Hard cap 2000
 * folds remainder into a single region. Per-region compaction.
 */
export function segmentMesh(shell: RawFaceMesh): RawFaceMesh[] {
  const { position, index } = shell;
  const triCount = index.length / 3;

  if (triCount < 4) return [shell];

  // 1. Compute per-triangle normals
  const triNormals = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    const ia = index[t * 3] * 3,
      ib = index[t * 3 + 1] * 3,
      ic = index[t * 3 + 2] * 3;
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
    triNormals[t * 3] = nx / len;
    triNormals[t * 3 + 1] = ny / len;
    triNormals[t * 3 + 2] = nz / len;
  }

  // 2. Weld vertices by position (round to 6 decimals)
  const vertexMap = new Map<string, number[]>(); // hash → [triIdx, ...]
  const TOL = 1e-6;
  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const vi = index[t * 3 + v];
      const x = Math.round(position[vi * 3] / TOL) * TOL;
      const y = Math.round(position[vi * 3 + 1] / TOL) * TOL;
      const z = Math.round(position[vi * 3 + 2] / TOL) * TOL;
      const key = `${x},${y},${z}`;
      let arr = vertexMap.get(key);
      if (!arr) {
        arr = [];
        vertexMap.set(key, arr);
      }
      if (!arr.includes(t)) arr.push(t);
    }
  }

  // 3. Build triangle adjacency (sharing a welded vertex)
  const triAdj = new Array<Set<number>>(triCount);
  for (let t = 0; t < triCount; t++) triAdj[t] = new Set();
  for (const tris of vertexMap.values()) {
    for (let i = 0; i < tris.length; i++)
      for (let j = i + 1; j < tris.length; j++) {
        triAdj[tris[i]].add(tris[j]);
        triAdj[tris[j]].add(tris[i]);
      }
  }

  // 4. BFS with dihedral angle threshold
  const trySegment = (angleDeg: number): number[] => {
    const cosThreshold = Math.cos((angleDeg * Math.PI) / 180);
    const region = new Int32Array(triCount).fill(-1);
    let regionCount = 0;

    for (let start = 0; start < triCount; start++) {
      if (region[start] !== -1) continue;
      region[start] = regionCount;
      const queue = [start];
      while (queue.length) {
        const cur = queue.shift()!;
        const cnx = triNormals[cur * 3],
          cny = triNormals[cur * 3 + 1],
          cnz = triNormals[cur * 3 + 2];
        for (const nb of triAdj[cur]) {
          if (region[nb] !== -1) continue;
          const dot =
            cnx * triNormals[nb * 3] +
            cny * triNormals[nb * 3 + 1] +
            cnz * triNormals[nb * 3 + 2];
          if (dot >= cosThreshold) {
            region[nb] = regionCount;
            queue.push(nb);
          }
        }
      }
      regionCount++;
    }
    return Array.from({ length: regionCount }, () => 0).map(
      (_, r) => region.filter((x) => x === r).length
    );
  };

  // Try adaptive thresholds
  const thresholds = [28, 35, 45];
  let bestAngle = 35;
  let bestScore = Infinity;

  for (const angle of thresholds) {
    const sizes = trySegment(angle);
    // Prefer 2–500 regions with reasonable size distribution
    const score = Math.abs(sizes.length - 50); // want ~50 regions
    if (sizes.length >= 2 && sizes.length <= 2000 && score < bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  // Final segmentation
  const cosThreshold = Math.cos((bestAngle * Math.PI) / 180);
  const region = new Int32Array(triCount).fill(-1);
  let regionCount = 0;

  for (let start = 0; start < triCount; start++) {
    if (region[start] !== -1) continue;
    region[start] = regionCount;
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      const cnx = triNormals[cur * 3],
        cny = triNormals[cur * 3 + 1],
        cnz = triNormals[cur * 3 + 2];
      for (const nb of triAdj[cur]) {
        if (region[nb] !== -1) continue;
        const dot =
          cnx * triNormals[nb * 3] +
          cny * triNormals[nb * 3 + 1] +
          cnz * triNormals[nb * 3 + 2];
        if (dot >= cosThreshold) {
          region[nb] = regionCount;
          queue.push(nb);
        }
      }
    }
    regionCount++;
  }

  // Hard cap: fold regions beyond 2000 into last bucket
  if (regionCount > 2000) {
    for (let t = 0; t < triCount; t++)
      if (region[t] >= 2000) region[t] = 1999;
    regionCount = 2000;
  }

  // 5. Per-region compaction
  const results: RawFaceMesh[] = [];
  for (let r = 0; r < regionCount; r++) {
    const tris: number[] = [];
    for (let t = 0; t < triCount; t++) if (region[t] === r) tris.push(t);
    if (tris.length === 0) continue;

    // Remap vertices
    const oldToNew = new Map<number, number>();
    const newPos: number[] = [];
    const newNorm: number[] = [];
    const newIdx: number[] = [];

    for (const t of tris) {
      for (let v = 0; v < 3; v++) {
        const oldVi = index[t * 3 + v];
        let newVi = oldToNew.get(oldVi);
        if (newVi === undefined) {
          newVi = newPos.length / 3;
          oldToNew.set(oldVi, newVi);
          newPos.push(
            position[oldVi * 3],
            position[oldVi * 3 + 1],
            position[oldVi * 3 + 2]
          );
          newNorm.push(
            triNormals[t * 3],
            triNormals[t * 3 + 1],
            triNormals[t * 3 + 2]
          );
        }
        newIdx.push(newVi);
      }
    }

    results.push({
      name: `Region_${r + 1}`,
      position: Float32Array.from(newPos),
      normal: Float32Array.from(newNorm),
      index: Uint32Array.from(newIdx),
    });
  }

  return results;
}
