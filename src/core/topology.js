// Exact mesh topology classification.
//
// Vertices are welded on exact float64 coordinates (no tolerance). STL shared
// corners are bit-identical after parsing (float32 -> float64 is exact), so exact
// welding recovers the intended topological identification deterministically. A
// signed zero is normalized to +0 so -0 and +0 weld together.
//
// Definitions (M0-10, see docs/implementation/ISSUE_AND_DECISION_LOG.md):
//   degenerate triangle : its three welded vertex ids are not all distinct.
//                         Its edges are skipped entirely.
//   boundary edge       : an edge used by exactly one non-degenerate triangle.
//   manifold edge       : an edge used by exactly two triangles.
//   non-manifold edge   : an edge used by three or more triangles.
//   component           : an edge-connected component of triangles.
//
// Nothing under src/core/ may import three, touch the DOM, or use a bare-specifier
// import (test LINT-T1). This module is dependency free.

// Shared scratch used to hash the exact bit pattern of a float64.
const BIT_BUFFER = new ArrayBuffer(8);
const BIT_FLOAT = new Float64Array(BIT_BUFFER);
const BIT_WORDS = new Uint32Array(BIT_BUFFER);

function normalizeZero(value) {
  return value === 0 ? 0 : value;
}

function hashVertex(x, y, z) {
  let h = 2166136261;
  BIT_FLOAT[0] = x;
  h = Math.imul(h ^ BIT_WORDS[0], 16777619);
  h = Math.imul(h ^ BIT_WORDS[1], 16777619);
  BIT_FLOAT[0] = y;
  h = Math.imul(h ^ BIT_WORDS[0], 16777619);
  h = Math.imul(h ^ BIT_WORDS[1], 16777619);
  BIT_FLOAT[0] = z;
  h = Math.imul(h ^ BIT_WORDS[0], 16777619);
  h = Math.imul(h ^ BIT_WORDS[1], 16777619);
  return h >>> 0;
}

// Exact float64 welder keyed on a typed-array bit hash with exact collision
// resolution (a hash collision can never merge distinct vertices).
function createVertexWelder() {
  const coords = [];
  const buckets = new Map();
  return {
    weld(x, y, z) {
      x = normalizeZero(x);
      y = normalizeZero(y);
      z = normalizeZero(z);
      const hash = hashVertex(x, y, z);
      const bucket = buckets.get(hash);
      if (bucket !== undefined) {
        for (let i = 0; i < bucket.length; i += 1) {
          const id = bucket[i];
          const o = id * 3;
          if (coords[o] === x && coords[o + 1] === y && coords[o + 2] === z) return id;
        }
        const newId = coords.length / 3;
        coords.push(x, y, z);
        bucket.push(newId);
        return newId;
      }
      const id = coords.length / 3;
      coords.push(x, y, z);
      buckets.set(hash, [id]);
      return id;
    },
    get count() {
      return coords.length / 3;
    }
  };
}

function sortedTripleKey(a, b, c) {
  const sorted = [a, b, c].sort((p, q) => p - q);
  return `${sorted[0]},${sorted[1]},${sorted[2]}`;
}

function addEdge(edges, a, b, triangle, union) {
  const key = a < b ? `${a},${b}` : `${b},${a}`;
  const record = edges.get(key);
  if (record === undefined) {
    edges.set(key, { first: triangle, count: 1 });
  } else {
    record.count += 1;
    union(triangle, record.first);
  }
}

export function computeTopology(positions) {
  const triangleCount = Math.floor(positions.length / 9);
  const welder = createVertexWelder();
  const parent = new Int32Array(triangleCount);
  for (let i = 0; i < triangleCount; i += 1) parent[i] = i;

  function find(value) {
    let current = value;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  }

  function union(a, b) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  const edges = new Map();
  const triangleKeys = new Set();
  let duplicateTriangles = 0;
  let degenerateTriangles = 0;

  for (let tri = 0, i = 0; tri < triangleCount; tri += 1, i += 9) {
    const a = welder.weld(positions[i], positions[i + 1], positions[i + 2]);
    const b = welder.weld(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = welder.weld(positions[i + 6], positions[i + 7], positions[i + 8]);

    const triangleKey = sortedTripleKey(a, b, c);
    if (triangleKeys.has(triangleKey)) duplicateTriangles += 1;
    else triangleKeys.add(triangleKey);

    if (a === b || b === c || a === c) {
      degenerateTriangles += 1;
      continue; // skip this triangle's edges entirely
    }

    addEdge(edges, a, b, tri, union);
    addEdge(edges, b, c, tri, union);
    addEdge(edges, c, a, tri, union);
  }

  let boundaryEdges = 0;
  let manifoldEdges = 0;
  let nonManifoldEdges = 0;
  for (const record of edges.values()) {
    if (record.count === 1) boundaryEdges += 1;
    else if (record.count === 2) manifoldEdges += 1;
    else nonManifoldEdges += 1;
  }

  const components = new Map();
  for (let tri = 0; tri < triangleCount; tri += 1) {
    const root = find(tri);
    components.set(root, (components.get(root) || 0) + 1);
  }

  return {
    uniqueVertices: welder.count,
    uniqueEdges: edges.size,
    manifoldEdges,
    boundaryEdges,
    nonManifoldEdges,
    duplicateTriangles,
    degenerateTriangles,
    componentCount: components.size,
    largestComponents: [...components.values()].sort((a, b) => b - a).slice(0, 8)
  };
}
