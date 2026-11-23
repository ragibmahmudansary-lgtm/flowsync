import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPONENT_TYPES,
  buildTriangleAdjacency,
  computeSurfaceReference,
  createRecognitionModel,
  decodeAssignments,
  encodeAssignments,
  growSelection
} from "../src/recognition.js";

test("derives trapezoidal planform reference geometry", () => {
  const positions = trapezoidPositions(10, 4, 2);
  const reference = computeSurfaceReference(positions, [0, 1, 2, 3], { binCount: 24 });
  assert.equal(reference.valid, true);
  close(reference.spanM, 10);
  close(reference.areaM2, 30, 0.8);
  close(reference.aspectRatio, 100 / 30, 0.1);
  assert.ok(reference.rootChordM > reference.tipChordM);
  assert.ok(reference.macM > 2 && reference.macM < 4);
});

test("region growth follows edge adjacency and normal threshold", () => {
  const positions = Float64Array.from([
    0, 0, 0, 1, 0, 0, 1, 1, 0,
    0, 0, 0, 1, 1, 0, 0, 1, 0,
    1, 0, 0, 1, 1, 0, 1, 1, 1
  ]);
  const adjacency = buildTriangleAdjacency(positions);
  const shallow = growSelection(0, positions, adjacency, 20);
  assert.deepEqual([...shallow].sort((a, b) => a - b), [0, 1]);
  const wide = growSelection(0, positions, adjacency, 90);
  assert.deepEqual([...wide].sort((a, b) => a - b), [0, 1, 2]);
});

test("region growth does not accumulate curvature beyond the seed-normal limit", () => {
  const positions = Float64Array.from([
    ...normalFixture(0),
    ...normalFixture(10),
    ...normalFixture(20)
  ]);
  const adjacency = [Int32Array.from([1]), Int32Array.from([0, 2]), Int32Array.from([1])];
  assert.deepEqual([...growSelection(0, positions, adjacency, 15)].sort((a, b) => a - b), [0, 1]);
});

test("region growth respects its explicit face cap", () => {
  const positions = Float64Array.from(Array.from({ length: 10 }, () => normalFixture(0)).flat());
  const adjacency = Array.from({ length: 10 }, (_, index) => Int32Array.from([index - 1, index + 1].filter((value) => value >= 0 && value < 10)));
  assert.equal(growSelection(0, positions, adjacency, 30, 4).size, 4);
});

test("recognition assignments round-trip through run-length encoding", () => {
  const model = createRecognitionModel(8);
  model.assignments.set([0, 0, COMPONENT_TYPES.wing, COMPONENT_TYPES.wing, COMPONENT_TYPES.wing, 0, COMPONENT_TYPES.fuselage, COMPONENT_TYPES.fuselage]);
  assert.deepEqual(Array.from(decodeAssignments(encodeAssignments(model.assignments), 8)), Array.from(model.assignments));
});

function trapezoidPositions(span, rootChord, tipChord) {
  const half = span / 2;
  const points = {
    lr: [0, 0, 0], lrr: [rootChord, 0, 0],
    lt: [1, -half, 0], ltt: [1 + tipChord, -half, 0],
    rt: [1, half, 0], rtt: [1 + tipChord, half, 0]
  };
  return Float64Array.from([
    ...points.lt, ...points.ltt, ...points.lrr,
    ...points.lt, ...points.lrr, ...points.lr,
    ...points.lr, ...points.lrr, ...points.rtt,
    ...points.lr, ...points.rtt, ...points.rt
  ]);
}

function normalFixture(angleDeg) {
  const angle = angleDeg * Math.PI / 180;
  return [0, 0, 0, 1, 0, 0, 0, Math.cos(angle), Math.sin(angle)];
}

function close(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} not within ${tolerance} of ${expected}`);
}
