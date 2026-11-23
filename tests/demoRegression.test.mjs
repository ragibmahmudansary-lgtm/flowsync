import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSTL } from "../src/stlParser.js";
import { mapPositions, DEFAULT_AXIS_MAPPING } from "../src/axisMapping.js";
import { computeMeshProperties } from "../src/geometry.js";

test("demo STL regression metrics", () => {
  const bytes = readFileSync("assets/airbus-a320-cfd-1.snapshot.7/samolot.stl");
  const parsed = parseSTL(bytes);
  assert.equal(parsed.triangleCount, 197772);
  const positions = mapPositions(parsed.positions, DEFAULT_AXIS_MAPPING, 1);
  const props = computeMeshProperties(positions, 1);
  close(props.bounds.size[0], 37.4378, 0.01);
  close(props.bounds.size[1], 33.9772, 0.01);
  close(props.bounds.size[2], 11.2080, 0.01);
  assert.equal(props.topology.componentCount, 1);
  assert.equal(props.topology.boundaryEdges, 28);
  assert.equal(props.topology.nonManifoldEdges, 5);
  assert.equal(props.topology.degenerateTriangles, 0);
});

function close(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}
