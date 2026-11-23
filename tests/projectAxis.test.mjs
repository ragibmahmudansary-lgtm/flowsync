import test from "node:test";
import assert from "node:assert/strict";
import { mapPositions, validateAxisMapping } from "../src/axisMapping.js";
import { COMPONENT_TYPES, createRecognitionModel } from "../src/recognition.js";
import { createProjectSnapshot, restoreAssignments, validateProjectSnapshot } from "../src/projectState.js";

test("axis mapping rejects duplicate source axes", () => {
  assert.throws(() => validateAxisMapping({ longitudinal: "x", lateral: "-x", vertical: "z" }), /three different/);
  assert.throws(() => mapPositions(Float64Array.from([1, 2, 3]), { longitudinal: "x", lateral: "x", vertical: "z" }), /three different/);
});

test("project snapshot restores recognition assignments for the matching mesh", () => {
  const recognition = createRecognitionModel(6);
  recognition.assignments.set([0, COMPONENT_TYPES.wing, COMPONENT_TYPES.wing, 0, COMPONENT_TYPES.fuselage, 0]);
  const project = createProjectSnapshot({
    sourceName: "fixture.stl",
    rawStl: { triangleCount: 6 },
    unitScale: 1,
    axisMapping: { longitudinal: "x", lateral: "y", vertical: "z" },
    manifest: { version: 1, units: "SI", components: [] },
    recognition,
    recognitionReport: null,
    controls: { velocityInput: "30" },
    meshProperties: {},
    lastVlm: null
  });
  assert.equal(validateProjectSnapshot(project), project);
  assert.deepEqual(Array.from(restoreAssignments(project, 6)), Array.from(recognition.assignments));
  assert.throws(() => restoreAssignments(project, 5), /expects 6 triangles/);
});
