import assert from 'node:assert/strict';
import { resolutionDeltas, runVlmAnalysis, runVlmResolutionCheck, runVlmSweep } from '../../../src/vlmSolver.js';

const make = ([lo, hi], reverse = false) => {
  const validity = { status: 'ok' };
  const series = [{ alphaDeg: 0, cl: lo, cdi: 0, validity }, { alphaDeg: 4, cl: hi, cdi: 0.01, validity }];
  return { validity, series: reverse ? series.reverse() : series };
};

// Below and above max-binary64 times 4*pi/180, with separation well above
// rounding of the represented samples and radian interval.
const below = 1.255026565750e307;
const above = 1.255026565758e307;
const examples = [
  ['near-max-within', [0, below], [0, 1.25e307]],
  ['near-max-over', [0, above], [0, below]],
  ['adjacent-below-overflow-midpoint', [0, 1.2550265657538346e307], [0, 1.25e307]],
  ['adjacent-above-overflow-midpoint', [0, 1.255026565753835e307], [0, 1.25e307]],
  ['fine-only-over', [0, below], [0, above]],
  ['positive-common-offset', [1.25e308, 1.35e308], [1.25e308, 1.351e308]],
  ['negative-common-offset-reversed', [-1.25e308, -1.35e308], [-1.25e308, -1.351e308], true],
  ['opposite-signs', [0, 1e307], [0, -1.1e307], true],
  ['opposite-signs-swapped', [0, -1.1e307], [0, 1e307]],
  ['true-delta-overflow', [0, 0], [0, 1e307]]
];
for (const [id, a, b, reverse] of examples) {
  const coarse = make(a, reverse), fine = make(b);
  console.log(JSON.stringify({ id, coarse, fine, comparison: resolutionDeltas(coarse, fine) }));
}

const base = {
  surfaces: [{ name: 'Independent rectangular wing', spanM: 8, rootChordM: 1, tipChordM: 1 }],
  refAreaM2: 8, refChordM: 1, referencePoint: [0.4, 0, 0],
  velocityMS: 40, densityKgM3: 1.225, alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4
};
const prescribed = { chordwiseRows: 4, spanwisePanels: 'auto' };
const custom = { chordwiseRows: 3, spanwisePanels: 12 };
const grids = [prescribed, { chordwiseRows: 8, spanwisePanels: 'auto' },
  custom, { chordwiseRows: 6, spanwisePanels: 24 }];
for (const area of [8, 3e-307, 2e-307, 2.09e-307, 2.1e-307, 2.12e-307]) {
  const options = { ...base, refAreaM2: area };
  const sweeps = grids.map(grid => {
    const { series, validity, resolution } = runVlmSweep({ ...options, ...grid });
    assert.ok(series.every(p => [p.cl, p.cdi, p.cd, p.cm, p.liftN, p.dragN, p.momentNm].every(Number.isFinite)));
    return { validity, resolution, series: series.map(({ alphaDeg, cl, cdi, validity }) => ({ alphaDeg, cl, cdi, validity })) };
  });
  const checks = [prescribed, custom].map(grid => {
    const check = runVlmResolutionCheck({ ...options, ...grid });
    assert.deepEqual(runVlmAnalysis({ ...options, ...grid }).resolutionCheck, check);
    return check;
  });
  console.log(JSON.stringify({ id: 'solver', area, sweeps, checks }));
}
const seed = [undefined, false, true].map(flag => {
  const result = runVlmAnalysis({ ...base, ...custom, betaDeg: 3.25,
    ...(flag === undefined ? {} : { seedReferencePlaceholder: flag }) });
  const { resolutionCheck, series } = result;
  return { resolutionCheck, series: series.map(({ cl, cdi, validity }) => ({ cl, cdi, validity })) };
});
assert.deepEqual(seed[0], seed[1]);
assert.deepEqual(seed[2].resolutionCheck, { ...seed[1].resolutionCheck,
  inputIdentity: { ...seed[1].resolutionCheck.inputIdentity, seedReferencePlaceholder: true } });
assert.ok(seed[2].series.every(({ cl, cdi, validity }, i) =>
  cl === seed[1].series[i].cl && cdi === seed[1].series[i].cdi &&
  seed[1].series[i].validity.status === 'ok' && validity.status === 'warning' &&
  validity.messages.some(message => message.includes('bounds-seed placeholder'))));
console.log(JSON.stringify({ id: 'seed', seed }));
