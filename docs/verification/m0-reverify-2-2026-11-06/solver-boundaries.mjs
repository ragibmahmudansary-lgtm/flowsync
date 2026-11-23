import assert from 'node:assert/strict';
import { runVlmAnalysis, runVlmResolutionCheck, runVlmSweep } from '../../../src/vlmSolver.js';

const base = {
  surfaces: [{ name: 'Review wing', spanM: 8, rootChordM: 1, tipChordM: 1 }],
  refAreaM2: 8, refChordM: 1, referencePoint: [0.4, 0, 0],
  velocityMS: 40, densityKgM3: 1.225, betaDeg: 0,
  alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4
};
const prescribed = { chordwiseRows: 4, spanwisePanels: 'auto' };
const custom = { chordwiseRows: 3, spanwisePanels: 12 };
const grids = [prescribed, { chordwiseRows: 8, spanwisePanels: 'auto' },
  custom, { chordwiseRows: 6, spanwisePanels: 24 }];
const radianInterval = 4 * (Math.PI / 180);
const numberOrOverflow = value => Number.isFinite(value) ? value : String(value);

const seedVariants = [undefined, false, true].map(flag => {
  const result = runVlmAnalysis({ ...base, ...custom, betaDeg: 3.25,
    ...(flag === undefined ? {} : { seedReferencePlaceholder: flag }) });
  return { identity: result.resolutionCheck.inputIdentity, coverage: result.resolutionCheck.coverage,
    badge: result.resolutionCheck.badge,
    comparison: result.resolutionCheck.currentGrid,
    cases: result.series.map(({ alphaDeg, cl, cdi, validity }) => ({ alphaDeg, cl, cdi, validity })) };
});
const [omitted, explicit, seeded] = seedVariants;
assert.deepEqual(omitted, explicit);
assert.deepEqual({ ...explicit.identity, seedReferencePlaceholder: true }, seeded.identity);
assert.deepEqual(explicit.coverage, seeded.coverage);
assert.deepEqual(explicit.comparison, seeded.comparison);
assert.ok(explicit.cases.every(point => point.validity.status === 'ok'));
assert.ok(seeded.cases.every((point, i) => point.cl === explicit.cases[i].cl && point.cdi === explicit.cases[i].cdi &&
  point.validity.status === 'warning' && point.validity.messages.some(message => message.includes('bounds-seed placeholder'))));
console.log(JSON.stringify({ probe: 'seed-variants', omitted, explicit, seeded }));

for (const refAreaM2 of [2e-307, 2.09e-307, 2.1e-307, 3e-307, 2e-306]) {
  const options = { ...base, refAreaM2 };
  const samples = grids.map(grid => {
    const { series, resolution } = runVlmSweep({ ...options, ...grid });
    assert.deepEqual(series.map(point => point.alphaDeg), [0, 4]);
    assert.ok(series.every(point => point.validity.status === 'ok' &&
      [point.cl, point.cdi, point.cd, point.cm, point.liftN, point.dragN, point.momentNm].every(Number.isFinite)));
    const [lo, hi] = series;
    // Independent two-point arithmetic from the case outputs. Divide once by
    // the angle interval in radians, with no large intermediate product.
    const expectedSlope = (hi.cl - lo.cl) / radianInterval;
    return { resolution, series: series.map(({ alphaDeg, cl, cdi, validity }) => ({ alphaDeg, cl, cdi, validity })),
      expectedSlope: numberOrOverflow(expectedSlope),
      degreesFirstProduct: numberOrOverflow((hi.cl - lo.cl) / 4 * 180) };
  });
  const checks = [prescribed, custom].map(grid => {
    const check = runVlmResolutionCheck({ ...options, ...grid });
    assert.deepEqual(runVlmAnalysis({ ...options, ...grid }).resolutionCheck, check);
    assert.deepEqual(check.coverage.alphaDeg, [0, 4]);
    assert.deepEqual(check.gates, { clAlpha: 0.01, cdi: 0.05 });
    assert.match(check.uncertaintyLabel, /unverified/);
    return check;
  });
  console.log(JSON.stringify({ probe: 'slope', refAreaM2, samples, checks }));
}
