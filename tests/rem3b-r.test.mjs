import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as vlm from '../src/vlmSolver.js';

const expected = JSON.parse(readFileSync(new URL('../docs/verification/rem-3b-r-2026-11-06/wake-oracle.json', import.meta.url)));
const base = {
  surfaces: [{spanM: 132.9, rootChordM: 64, tipChordM: 64, incidenceDeg: 2}],
  velocityMS: 40, densityKgM3: 1.225, refAreaM2: 132.9 * 64, refChordM: 64,
  spanwisePanels: 4, chordwiseRows: 1
};

function checkEquivalent(result, oracle) {
  // Same-method VLM oracle tolerance from the frozen independent report.
  for (const key of ['cl', 'cdi', 'cdiNearField', 'cm']) {
    assert.ok(Math.abs(result[key] / oracle[key] - 1) <= 1e-9, `${key}: ${result[key]} vs ${oracle[key]}`);
  }
}

test('generated cases and sweeps match independent axial and oblique oracles after large translation', () => {
  for (const oracle of [expected.axial, expected.oblique]) {
    for (const [x, z] of [[0, 0], [1e16, 0], [1e17, 0], [1e18, 0], [1e18, -1e18]]) {
      const options = {
        ...base, alphaDeg: oracle.alphaDeg, betaDeg: oracle.betaDeg,
        surfaces: [{...base.surfaces[0], xLeadingRootM: x, zRootM: z}], referencePoint: [x, 0, z]
      };
      const result = vlm.solveVlmCase(options);
      assert.equal(result.diagnostics.wakeLengthM, oracle.wakeM);
      assert.equal(result.diagnostics.kernelTruncations, 0);
      assert.equal(result.validity.status, 'ok');
      checkEquivalent(result, oracle);
      result.circulation.forEach((value, index) => assert.ok(Math.abs(value / oracle.gamma[index] - 1) <= 1e-9));
      result.totalForce.forEach((value, index) => {
        assert.ok(Math.abs(value - oracle.force[index]) <= 1e-9 * Math.max(...oracle.force.map(Math.abs)));
      });
      assert.ok(result.panels.every(panel => panel.boundA[1] === panel.y0 && panel.boundB[1] === panel.y1));
      const sweep = vlm.runVlmSweep({...options, alphaMinDeg: oracle.alphaDeg, alphaMaxDeg: oracle.alphaDeg, alphaStepDeg: 1});
      checkEquivalent(sweep.series[0], oracle);
    }
  }
});

test('finite wake uses the prescribed vector even when a world endpoint addition rounds it', () => {
  const measure = (x, z) => vlm.inducedVelocityHorseshoe(
    [x + 128, 8, z + 128],
    {boundA: [x, -16, z], boundB: [x, 16, z]},
    [1, 0, 0], 1329
  );
  assert.deepEqual(measure(1e18, -1e18), measure(0, 0));
});

test('standalone Trefftz projects a relative displacement for oblique yaw at a large offset', () => {
  for (const x of [0, 1e18]) {
    const panels = [{boundA: [x, -0.5, -x], boundB: [x, 0.5, -x], boundMidpoint: [x, 0, -x]}];
    const result = vlm.trefftzDrag(panels, [1], 1, [1, 0.3, 0.2]);
    assert.ok(Math.abs(result.dragNTrefftz * Math.PI - 1) <= 1e-12);
    assert.equal(result.trefftzSuppression.suppressedToZero, false);
  }
});

const workBase = {
  surfaces: [{spanM: 10, rootChordM: 1, tipChordM: 1}],
  velocityMS: 40, densityKgM3: 0, refAreaM2: 10, refChordM: 1,
  alphaMinDeg: 0, alphaMaxDeg: 3, alphaStepDeg: 1,
  spanwisePanels: 128, chordwiseRows: 16
};
const workLimit = /synchronous work limit/;

test('sweep preflights aggregate work, accepting exactly four maximum-case equivalents', () => {
  // Invalid density acts as a sentinel at solve entry. The in-budget plan
  // reaches it without spending four large dense solves in the test suite.
  assert.throws(() => vlm.runVlmSweep(workBase), /density must be positive/);
  for (const alphaMaxDeg of [4, 200]) {
    assert.throws(() => vlm.runVlmSweep({...workBase, alphaMaxDeg}), workLimit);
  }
});

test('resolution preflights the dense cap and cumulative prescribed/custom work before solving', () => {
  const custom = {...workBase, chordwiseRows: 8, spanwisePanels: 64};
  assert.throws(() => vlm.runVlmResolutionCheck(custom), /density must be positive/);
  assert.throws(() => vlm.runVlmResolutionCheck({...custom, spanwisePanels: 128}), /VLM panel resource limit/);
  const large = {...custom, surfaces: [{spanM: 32, rootChordM: 1, tipChordM: 1}]};
  assert.throws(() => vlm.runVlmResolutionCheck(large), workLimit);
});

test('one Run preflights the sweep plus R1, R2 and the custom refinement as a unit', () => {
  const custom = {...workBase, chordwiseRows: 8, spanwisePanels: 64};
  const over = {...custom, alphaMaxDeg: 49};
  assert.throws(() => vlm.runVlmSweep(over), /density must be positive/);
  assert.throws(() => vlm.runVlmResolutionCheck(over), /density must be positive/);
  assert.throws(() => vlm.runVlmAnalysis(over), workLimit);
  assert.throws(() => vlm.runVlmAnalysis(custom), /density must be positive/);
});
