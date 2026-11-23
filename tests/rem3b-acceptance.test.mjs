import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateVlmPanels, runVlmResolutionCheck, runVlmSweep, solveVlmCase, trefftzDrag } from '../src/vlmSolver.js';

const wing = { name: 'Wing', spanM: 8, rootChordM: 1, tipChordM: 1 };
const base = { surfaces: [wing], chordwiseRows: 1, spanwisePanels: 4,
  alphaDeg: 4, velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8, refChordM: 1 };
const panels = generateVlmPanels([wing], base);
const vectors = JSON.parse(readFileSync(new URL('../docs/verification/rem-3b-sol-2026-11-06/decimal-oracle.json', import.meta.url)));

test('decimal sweep matches independent rational counts and binary64 rounding', () => {
  for (const { name, inputs, expected } of vectors) {
    const [alphaMinDeg, alphaMaxDeg, alphaStepDeg] = inputs.map(Number);
    const solve = () => runVlmSweep({ ...base, alphaMinDeg, alphaMaxDeg, alphaStepDeg });
    if (typeof expected === 'string') assert.throws(solve, new RegExp(expected), name);
    else assert.deepEqual(solve().series.map(p => p.alphaDeg), expected, name);
  }
});

test('wake span follows each named group’s bound endpoints, including translated panels', () => {
  const original = generateVlmPanels([wing], base);
  const translated = original.map(p => {
    const shift = q => [q[0] + 6, q[1] + 20, q[2] + 1];
    return { ...p, surfaceName: 'Second wing', y0: p.y0 + 20, y1: p.y1 + 20,
      boundA: shift(p.boundA), boundB: shift(p.boundB), boundMidpoint: shift(p.boundMidpoint), controlPoint: shift(p.controlPoint) };
  });
  const solve = (panels, overrides) => solveVlmCase({ ...base, surfaces: undefined, panels, ...overrides });
  assert.equal(solve(original).cl, solveVlmCase(base).cl);
  const both = [...original, ...translated];
  assert.equal(solve(both, { betaDeg: 6 }).diagnostics.largestSurfaceSpanM, 8);
  assert.equal(solve(both).diagnostics.wakeLengthM, 80);
  assert.equal(solve(both, { wakeLengthFactor: 100 }).diagnostics.wakeLengthM, 100);
  assert.throws(() => solve(original.map(p => ({ ...p, y0: p.y0 / 100, y1: p.y1 / 100 }))), /span.*bound endpoints/);
  assert.throws(() => solve(original.map(p => ({ ...p, boundMidpoint: [p.boundMidpoint[0] + 0.01, p.boundMidpoint[1], p.boundMidpoint[2]] }))), /midpoint/);
  assert.throws(() => solve(original.map(p => ({ ...p, widthLengthRatio: 9 }))), /width\/length/);
});

test('surface identity rejects duplicates and handles names inherited from Object.prototype', () => {
  assert.throws(() => generateVlmPanels([wing, { ...wing, name: 'wING' }], base), /duplicate.*surface name/i);
  const check = runVlmResolutionCheck({ ...base, surfaces: [{ ...wing, name: 'constructor' }], chordwiseRows: 4, spanwisePanels: 'auto' });
  assert.deepEqual(check.coverage.latticeCounts, { constructor: 32 });
  assert.equal(check.coverage.latticeLabel, 'R1');
  assert.equal(check.inputIdentity.wake.lengthM, 80);
  assert.deepEqual(check.gates, { clAlpha: 0.01, cdi: 0.05 });
});

test('case rejects extreme pressure references, invalid angles and collapsed wakes explicitly', () => {
  for (const patch of [{ refAreaM2: 1e308 }, { refChordM: 1e305 }, { velocityMS: Number.MIN_VALUE }]) {
    assert.throws(() => solveVlmCase({ ...base, ...patch }), /reference.*normalization/i);
  }
  assert.throws(() => solveVlmCase({ ...base, refAreaM2: Number.MIN_VALUE, densityKgM3: 0.001, referencePoint: [0.25, 0, 0] }), /nonfinite.*coefficient/i);
  assert.throws(() => solveVlmCase({ ...base, betaDeg: 1e308 }), /betaDeg.*radians/);
  const far = generateVlmPanels([wing], base).map(p => {
    const shift = q => [1e20, q[1], q[2]];
    return { ...p, boundA: shift(p.boundA), boundB: shift(p.boundB),
      boundMidpoint: shift(p.boundMidpoint), controlPoint: [1e20 + 16384, p.controlPoint[1], 0] };
  });
  assert.throws(() => solveVlmCase({ ...base, alphaDeg: 0, panels: far }), /wake endpoint/);
});

test('Trefftz rejects malformed optional data, retaining omitted normalizer and numeric zero', () => {
  const drag = (opts, gamma = new Float64Array([1, 1, 1, 1])) => trefftzDrag(panels, gamma, 1, [1, 0, 0], opts);
  for (const value of [null, false, '', '0', NaN, Infinity]) {
    assert.throws(() => drag({ nearFieldDragN: value }), /near-field drag input/i);
  }
  for (const key of ['qS', 'wakeLengthM']) {
    for (const value of [null, false, '1', -1, 0, Infinity]) {
      assert.throws(() => drag({ [key]: value }), new RegExp(key));
    }
  }
  assert.throws(() => drag({ qS: Number.MIN_VALUE }), /nonfinite.*coefficient/i);
  assert.throws(() => drag({}, new Array(4)), /circulation\[0\]/);
  assert.equal(drag({ nearFieldDragN: 0 }, new Float64Array(4)).dragNNearField, 0);
  assert.ok(Number.isNaN(drag().cdiTrefftz));
});
