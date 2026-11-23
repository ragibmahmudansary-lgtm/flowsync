import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { computeTopology } from "../src/core/topology.js";
import { parseSTL } from "../src/stlParser.js";
import { mapPositions, DEFAULT_AXIS_MAPPING } from "../src/axisMapping.js";
import { boxTriangles, trianglesToPositions } from "./fixtures.mjs";

// ---------------------------------------------------------------------------
// Independent oracle. This is a deliberately separate implementation of the
// topology definitions in docs/implementation/ISSUE_AND_DECISION_LOG.md (M0-10).
// It welds on the shortest round-trip string of each float64 (a different
// mechanism from the module's typed-array bit hash) and NEVER imports the module
// under test. If it agrees with the module, the module is not returning constants.
// ---------------------------------------------------------------------------

function referenceTopology(positions) {
  const triangleCount = Math.floor(positions.length / 9);
  const vertexMap = new Map();
  const coords = [];
  function weld(x, y, z) {
    const key = `${String(x)}|${String(y)}|${String(z)}`;
    let id = vertexMap.get(key);
    if (id === undefined) {
      id = coords.length / 3;
      coords.push(x, y, z);
      vertexMap.set(key, id);
    }
    return id;
  }

  const parent = new Int32Array(triangleCount);
  for (let i = 0; i < triangleCount; i += 1) parent[i] = i;
  function find(v) {
    let cur = v;
    while (parent[cur] !== cur) {
      parent[cur] = parent[parent[cur]];
      cur = parent[cur];
    }
    return cur;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }

  const edgeTris = new Map();
  const triangleKeys = new Set();
  let duplicateTriangles = 0;
  let degenerateTriangles = 0;

  for (let tri = 0, i = 0; tri < triangleCount; tri += 1, i += 9) {
    const a = weld(positions[i], positions[i + 1], positions[i + 2]);
    const b = weld(positions[i + 3], positions[i + 4], positions[i + 5]);
    const c = weld(positions[i + 6], positions[i + 7], positions[i + 8]);
    const sorted = [a, b, c].sort((p, q) => p - q);
    const triKey = `${sorted[0]},${sorted[1]},${sorted[2]}`;
    if (triangleKeys.has(triKey)) duplicateTriangles += 1;
    else triangleKeys.add(triKey);

    if (a === b || b === c || a === c) {
      degenerateTriangles += 1;
      continue;
    }
    for (const [u, v] of [[a, b], [b, c], [c, a]]) {
      const key = u < v ? `${u},${v}` : `${v},${u}`;
      const list = edgeTris.get(key);
      if (list === undefined) edgeTris.set(key, [tri]);
      else list.push(tri);
    }
  }

  for (const list of edgeTris.values()) {
    for (let k = 1; k < list.length; k += 1) union(list[0], list[k]);
  }

  let boundaryEdges = 0;
  let manifoldEdges = 0;
  let nonManifoldEdges = 0;
  for (const list of edgeTris.values()) {
    if (list.length === 1) boundaryEdges += 1;
    else if (list.length === 2) manifoldEdges += 1;
    else nonManifoldEdges += 1;
  }

  const components = new Set();
  for (let tri = 0; tri < triangleCount; tri += 1) components.add(find(tri));

  return {
    uniqueVertices: coords.length / 3,
    uniqueEdges: edgeTris.size,
    manifoldEdges,
    boundaryEdges,
    nonManifoldEdges,
    duplicateTriangles,
    degenerateTriangles,
    componentCount: components.size
  };
}

function assertMatchesOracle(positions, label) {
  const oracle = referenceTopology(positions);
  const module = computeTopology(positions);
  for (const key of Object.keys(oracle)) {
    assert.equal(module[key], oracle[key], `${label}: module.${key}=${module[key]} != oracle.${key}=${oracle[key]}`);
  }
  return oracle;
}

test("module matches independent oracle on a closed box", () => {
  const oracle = assertMatchesOracle(trianglesToPositions(boxTriangles()), "box");
  assert.equal(oracle.boundaryEdges, 0);
  assert.equal(oracle.nonManifoldEdges, 0);
  assert.equal(oracle.componentCount, 1);
});

test("module matches oracle on degenerate, duplicate, non-manifold and disconnected cases", () => {
  // Degenerate: two welded corners coincide.
  const degenerate = Float64Array.from([0, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.equal(assertMatchesOracle(degenerate, "degenerate").degenerateTriangles, 1);

  // Non-manifold: three triangles share edge (0,0,0)-(1,0,0).
  const nonManifold = Float64Array.from([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    0, 0, 0, 1, 0, 0, 0, 0, 1,
    0, 0, 0, 1, 0, 0, 0, -1, 0
  ]);
  const nm = assertMatchesOracle(nonManifold, "non-manifold");
  assert.equal(nm.nonManifoldEdges, 1);

  // Disconnected: two separate triangles.
  const disconnected = Float64Array.from([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
    5, 0, 0, 6, 0, 0, 5, 1, 0
  ]);
  assert.equal(assertMatchesOracle(disconnected, "disconnected").componentCount, 2);

  // Duplicate: a closed box plus one repeated triangle.
  const dup = trianglesToPositions([...boxTriangles(), boxTriangles()[0]]);
  assert.equal(assertMatchesOracle(dup, "duplicate").duplicateTriangles, 1);
});

test("reference mesh independently yields the audited 28/5/0/1 topology", () => {
  const bytes = readFileSync("assets/airbus-a320-cfd-1.snapshot.7/samolot.stl");
  const parsed = parseSTL(bytes);
  assert.equal(parsed.triangleCount, 197772);
  const positions = mapPositions(parsed.positions, DEFAULT_AXIS_MAPPING, 1);

  // Independent oracle, computed without importing the module under test.
  const oracle = referenceTopology(positions);
  assert.equal(oracle.boundaryEdges, 28);
  assert.equal(oracle.nonManifoldEdges, 5);
  assert.equal(oracle.degenerateTriangles, 0);
  assert.equal(oracle.componentCount, 1);

  // The module must reproduce the independently derived reference values.
  const module = computeTopology(positions);
  assert.equal(module.boundaryEdges, 28);
  assert.equal(module.nonManifoldEdges, 5);
  assert.equal(module.degenerateTriangles, 0);
  assert.equal(module.componentCount, 1);
  assert.equal(module.uniqueVertices, oracle.uniqueVertices);
  assert.equal(module.uniqueEdges, oracle.uniqueEdges);
});
