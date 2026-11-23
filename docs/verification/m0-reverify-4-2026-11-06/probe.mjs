import assert from 'node:assert/strict';
import { resolutionDeltas, runVlmAnalysis, runVlmSweep } from '../../../src/vlmSolver.js';

const valid = { status: 'ok' };
function sweep(cl, drag, reverse = false) {
  const series = [
    { alphaDeg: 0, cl: cl[0], cdi: 0, validity: valid },
    { alphaDeg: 4, cl: cl[1], cdi: drag, validity: valid }
  ];
  return { validity: valid, series: reverse ? series.reverse() : series };
}

const largePositive = [3e305, 1.23e307];
const largeNegative = [-2e305, -4.2e306];
for (const [id, coarseCl, fineCl, drag, reverse] of [
  ['signed-positive-coarse', largePositive, largeNegative, [0.013, 0.014], true],
  ['signed-negative-coarse', largeNegative, largePositive, [0.014, 0.013], false],
  ['ordinary-negative', [0.16, -0.14], [-0.07, -0.43], [0.018, 0.019], true],
  ['ordinary-negative-swapped', [-0.07, -0.43], [0.16, -0.14], [0.019, 0.018], false],
  ['floor-active', [0, 3.5e-302], [0, -7e-302], [0, 0], false],
  ['floor-inactive-swapped', [0, -7e-302], [0, 3.5e-302], [0, 0], false],
  ['zero-coarse-finite', [0, 0], [0, -8e-302], [0.013, 0.013], false],
  ['finite-large-final-delta', [0, 0], [0, 1.2e7], [0.013, 0.014], false],
  ['nonfinite-final-delta', [0, 0], [0, 1.3e7], [0.013, 0.014], false],
  ['nonfinite-final-delta-swapped', [0, 1.3e7], [0, 0], [0.014, 0.013], false],
  ['fine-slope-unrepresentable', largePositive, [0, -1.3e307], [0.013, 0.014], false]
]) {
  const coarse = sweep(coarseCl, drag[0], reverse);
  const fine = sweep(fineCl, drag[1]);
  console.log(JSON.stringify({ kind: 'constructed', id, coarse, fine, observed: resolutionDeltas(coarse, fine) }));
}

const base = {
  surfaces: [{ name: 'Audit rectangle', spanM: 8, rootChordM: 1, tipChordM: 1 }],
  refAreaM2: 8, refChordM: 1, referencePoint: [0.4, 0, 0],
  velocityMS: 40, densityKgM3: 1.225, alphaMinDeg: -2, alphaMaxDeg: 2, alphaStepDeg: 2
};
const prescribed = { chordwiseRows: 4, spanwisePanels: 'auto' };
const custom = { chordwiseRows: 3, spanwisePanels: 12 };
const gridOptions = [prescribed, { chordwiseRows: 8, spanwisePanels: 'auto' },
  custom, { chordwiseRows: 6, spanwisePanels: 24 }];

const label = 'unverified: fixed Tier-0 uncertainty claim unavailable';
for (const [id, refAreaM2, betaDeg] of [
  ['ordinary', 8, 0], ['yawed-ordinary', 8, 5], ['slope-recovery', 3e-307, 0],
  ['prescribed-withheld', 2e-307, 0], ['custom-split', 2.12e-307, 0]
]) {
  // Ordinary sweeps exercise comparison angles distinct from plot angles.
  // Extreme references use two samples to avoid overflow in a separate fit.
  const extreme = refAreaM2 < 1;
  const plot = extreme ? { alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4 } : {};
  const options = { ...base, ...plot, refAreaM2, betaDeg };
  const grids = gridOptions.map(grid => {
    const { series, resolution, validity } = runVlmSweep({
      ...options, ...grid, alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4
    });
    assert.deepEqual(series.map(point => point.alphaDeg), [0, 4]);
    assert.ok(series.every(point =>
      ['cl', 'cdi', 'cd', 'cm', 'liftN', 'dragN', 'momentNm'].every(key => Number.isFinite(point[key]))));
    return { series, resolution, validity };
  });
  const comparisons = [prescribed, custom].map(grid => {
    const result = runVlmAnalysis({ ...options, ...grid });
    assert.deepEqual(result.series.map(point => point.alphaDeg), extreme ? [0, 4] : [-2, 0, 2]);
    assert.equal(result.uncertaintyLabel, label);
    return result.resolutionCheck;
  });
  console.log(JSON.stringify({ kind: 'real-flow', id, refAreaM2, betaDeg, grids, comparisons }));
}

const seed = [undefined, false, true].map(flag => {
  const { series, resolutionCheck, uncertaintyLabel } = runVlmAnalysis({
    ...base, ...custom, betaDeg: 3.25, ...(flag === undefined ? {} : { seedReferencePlaceholder: flag })
  });
  assert.equal(uncertaintyLabel, label);
  return { series: series.map(({ alphaDeg, cl, cdi, validity }) => ({ alphaDeg, cl, cdi, validity })), resolutionCheck };
});
assert.deepEqual(seed[0], seed[1]);
assert.deepEqual(seed[2].resolutionCheck, { ...seed[1].resolutionCheck,
  inputIdentity: { ...seed[1].resolutionCheck.inputIdentity, seedReferencePlaceholder: true } });
assert.equal(seed[1].resolutionCheck.inputIdentity.seedReferencePlaceholder, false);
assert.equal(seed[1].resolutionCheck.inputIdentity.betaDeg, 3.25);
for (const [index, { alphaDeg, cl, cdi, validity }] of seed[2].series.entries()) {
  const withoutSeed = seed[1].series[index];
  assert.deepEqual([alphaDeg, cl, cdi], [withoutSeed.alphaDeg, withoutSeed.cl, withoutSeed.cdi]);
  assert.equal(withoutSeed.validity.status, 'ok');
  assert.equal(validity.status, 'warning');
  assert.ok(validity.messages.some(message => message.includes('bounds-seed placeholder')));
}
console.log(JSON.stringify({ kind: 'seed', seed }));
