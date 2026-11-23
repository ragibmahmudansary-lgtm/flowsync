import test from "node:test";
import assert from "node:assert/strict";
import { computeMeshProperties, computePolyhedralMassProperties, computeTopology } from "../src/geometry.js";
import { boxTriangles, tetraTriangles, trianglesToPositions } from "./fixtures.mjs";

test("computes box volume, centroid, and inertia about CG", () => {
  const positions = trianglesToPositions(boxTriangles([0, 0, 0], [2, 4, 6]));
  const props = computePolyhedralMassProperties(positions, 10);
  close(props.volumeM3, 48);
  vectorClose(props.centroid, [1, 2, 3]);
  close(props.inertiaCg.xx, (10 / 12) * (4 ** 2 + 6 ** 2), 1e-8);
  close(props.inertiaCg.yy, (10 / 12) * (2 ** 2 + 6 ** 2), 1e-8);
  close(props.inertiaCg.zz, (10 / 12) * (2 ** 2 + 4 ** 2), 1e-8);
});

test("computes tetrahedron volume and centroid", () => {
  const props = computePolyhedralMassProperties(trianglesToPositions(tetraTriangles()), 1);
  close(props.volumeM3, 1 / 6);
  vectorClose(props.centroid, [0.25, 0.25, 0.25]);
});

test("reports closed box topology", () => {
  const topology = computeTopology(trianglesToPositions(boxTriangles()));
  assert.equal(topology.componentCount, 1);
  assert.equal(topology.boundaryEdges, 0);
  assert.equal(topology.nonManifoldEdges, 0);
});

test("mesh properties include warnings for open surfaces", () => {
  const openBox = boxTriangles().slice(0, -1);
  const props = computeMeshProperties(trianglesToPositions(openBox), 1);
  assert.ok(props.warnings.some((warning) => warning.includes("boundary edges")));
});

test("topology reports duplicate and degenerate triangles", () => {
  const triangles = boxTriangles();
  const duplicateTopology = computeTopology(trianglesToPositions([...triangles, triangles[0]]));
  assert.equal(duplicateTopology.duplicateTriangles, 1);
  const degenerate = Float64Array.from([0, 0, 0, 1, 0, 0, 1, 0, 0]);
  assert.equal(computeTopology(degenerate).degenerateTriangles, 1);
});

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}

function vectorClose(actual, expected, tolerance = 1e-9) {
  actual.forEach((value, index) => close(value, expected[index], tolerance));
}
