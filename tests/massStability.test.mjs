import test from "node:test";
import assert from "node:assert/strict";
import { computeMeshProperties } from "../src/geometry.js";
import { aggregateMassProperties } from "../src/massModel.js";
import { computeStaticStability, simulatePitchResponse } from "../src/stability.js";
import { boxTriangles, trianglesToPositions } from "./fixtures.mjs";

test("aggregates mesh mass and point masses into total CG", () => {
  const mesh = computeMeshProperties(trianglesToPositions(boxTriangles([0, 0, 0], [2, 4, 6])), 1);
  const manifest = {
    components: [
      { id: "mesh", name: "mesh", type: "mesh-volume", massKg: 10, positionM: [0, 0, 0] },
      { id: "payload", name: "payload", type: "point-mass", massKg: 10, positionM: [3, 2, 3] }
    ]
  };
  const mass = aggregateMassProperties(manifest, mesh);
  assert.equal(mass.totalMassKg, 20);
  vectorClose(mass.cg, [2, 2, 3]);
  assert.ok(mass.inertiaCg.yy > mesh.inertiaCg.yy * 10);
});

test("static stability follows neutral point relative to CG", () => {
  const mass = { cg: [2, 0, 0], inertiaCg: { yy: 1000 } };
  const params = baseParams();
  const stable = computeStaticStability({ ...params, neutralPointXM: 3 }, mass);
  assert.equal(stable.stable, true);
  assert.ok(stable.cmAlphaPerRad < 0);
  const unstable = computeStaticStability({ ...params, neutralPointXM: 1 }, mass);
  assert.equal(unstable.stable, false);
  assert.ok(unstable.cmAlphaPerRad > 0);
});

test("pitch simulation returns finite RK4 samples", () => {
  const mass = { cg: [2, 0, 0], inertiaCg: { yy: 18000 } };
  const stability = computeStaticStability(baseParams(), mass);
  const samples = simulatePitchResponse(baseParams(), mass, stability);
  assert.ok(samples.length > 100);
  assert.ok(samples.every((sample) => Number.isFinite(sample.thetaDeg) && Number.isFinite(sample.alphaDeg)));
});

function baseParams() {
  return {
    densityKgM3: 1.225,
    velocityMS: 50,
    alphaMinDeg: -5,
    alphaMaxDeg: 10,
    alphaStepDeg: 1,
    refAreaM2: 20,
    macM: 2,
    neutralPointXM: 3,
    cl0: 0.2,
    clAlphaPerRad: 5,
    cd0: 0.02,
    dragK: 0.05,
    cm0: 0.01,
    pitchDamping: 0.6
  };
}

function vectorClose(actual, expected, tolerance = 1e-9) {
  actual.forEach((value, index) => {
    assert.ok(Math.abs(value - expected[index]) <= tolerance, `${value} not within ${tolerance} of ${expected[index]}`);
  });
}
