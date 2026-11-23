import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as v from '../../../src/vlmSolver.js';
import { createProjectSnapshot } from '../../../src/projectState.js';

const write = (id, data) => console.log(JSON.stringify({ id, ...data }));
const wing = { name: 'constructor', spanM: 8, rootChordM: 1, tipChordM: 1 };
const base = { surfaces: [wing], velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8,
  refChordM: 1, referencePoint: [.4, 0, 0], alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 2 };
const compare = v.runVlmAnalysis({ ...base, betaDeg: 3.25, spanwisePanels: 16,
  chordwiseRows: 2, wakeLengthFactor: 93 });
const check = compare.resolutionCheck;
assert.deepEqual(check.inputIdentity.lattices.current.spanwisePanels, { constructor: 16 });
assert.deepEqual(check.inputIdentity.lattices.refined.spanwisePanels, { constructor: 32 });
assert.equal(check.inputIdentity.betaDeg, 3.25);
assert.equal(check.inputIdentity.wake.lengthM, 93);
assert.equal(check.claim, 'current lattice vs 2x refined lattice');
assert.deepEqual(check.coverage.alphaDeg, [0, 4]);
assert.deepEqual(check.gates, { clAlpha: .01, cdi: .05 });
const front = { name: 'front', spanM: 3, rootChordM: .5, tipChordM: .5, xLeadingRootM: -4 };
const blocked = v.runVlmAnalysis({ ...base, surfaces: [wing, front] });
assert.equal(blocked.resolutionCheck.claim, 'withheld');
assert.equal(blocked.resolutionCheck.badge, 'amber');
assert.equal(blocked.resolutionCheck.coverage.coversPlottedLattice, false);
assert.equal(blocked.resolutionCheck.deltaClAlpha, null);
assert.equal(blocked.resolutionCheck.deltaCdi, null);
const snapshot = JSON.parse(JSON.stringify(createProjectSnapshot({ lastVlm: compare })));
assert.deepEqual(snapshot.analysis.resolutionCheck, check);
write('resolution', { status: check.claim, identity: check.inputIdentity, coverage: check.coverage,
  refused: blocked.resolutionCheck.comparisonValidity, snapshotCoverage: snapshot.analysis.resolutionCheck.coverage });

const app = readFileSync(new URL('../../../src/app.js', import.meta.url), 'utf8');
function exportResult(result) {
  const start = app.indexOf('function exportResults()');
  const body = app.slice(start, app.indexOf('\nfunction ', start + 1));
  let output;
  runInNewContext(body + '\nexportResults()', { state: { lastVlm: result },
    downloadBlob: (file, content, type) => { output = { file, payload: JSON.parse(content), type }; } });
  return output;
}
const keys = ['cl', 'cdi', 'cd', 'cm', 'liftN', 'dragN', 'momentNm'];
for (const result of [compare, blocked, { ...compare, validity: undefined },
  { ...compare, series: [{ ...compare.series[0], validity: undefined }] }]) {
  const payload = exportResult(result).payload;
  assert.equal(payload.schema, 'airflow.vlm-results');
  assert.match(payload.uncertaintyLabel, /unverified/);
  const shouldWithhold = result !== compare;
  for (const point of payload.series) {
    assert.equal(point.availability, shouldWithhold ? 'withheld' : 'available');
    assert.ok(keys.every(k => shouldWithhold ? point[k] === null : Number.isFinite(point[k])));
  }
  write('export', { availability: payload.series.map(p => p.availability), validity: payload.validity?.status ?? null,
    pointValidity: payload.series.map(p => p.validity?.status ?? null), uncertainty: payload.uncertaintyLabel });
}
const one = { boundA: [0, -.5, 0], boundB: [0, .5, 0], boundMidpoint: [0, 0, 0] };
for (const circulation of [null, [], Array(1), [null], [''], ['1'], [false], [NaN], [Infinity]]) {
  assert.throws(() => v.trefftzDrag([one], circulation, 1, [1, 0, 0]), /circulation/);
}
assert.equal(v.trefftzDrag([one], new Float64Array([0]), 1, [1, 0, 0]).dragNTrefftz, 0);
const translatedOne = { boundA: [1e18, -.5, -1e18], boundB: [1e18, .5, -1e18],
  boundMidpoint: [1e18, 0, -1e18] };
const obliqueDrag = v.trefftzDrag([translatedOne], [1], 1, [1, -.26, .13]).dragNTrefftz;
assert.ok(Math.abs(obliqueDrag * Math.PI - 1) <= 1e-12);
assert.throws(() => v.solveVlmCase({ ...base, refAreaM2: Number.MAX_VALUE }), /normalization/);
assert.throws(() => v.solveVlmCase({ ...base, referencePoint: [Number.MAX_VALUE, 0, 0], alphaDeg: 4 }), /Nonfinite moment/);
assert.throws(() => v.runVlmSweep({ ...base, cd0: Number.MAX_VALUE }), /Nonfinite sweep output/);
assert.throws(() => v.runVlmSweep({ ...base, alphaMinDeg: 2 ** 53, alphaMaxDeg: 2 ** 53 + 4, alphaStepDeg: 1 }), /distinct advancing/);
assert.deepEqual(v.runVlmSweep({ ...base, alphaMinDeg: .3, alphaMaxDeg: .1, alphaStepDeg: .1 }).series.map(p => p.alphaDeg), [.1, .2, .3]);
write('input-guards', { badCirculationForms: 9, numericZero: 'accepted', obliqueUnitDrag: obliqueDrag,
  finiteDerivedRefusals: 3, grid: [.1, .2, .3] });

const oracle = JSON.parse(readFileSync(new URL('./translation-oracle.json', import.meta.url)));
const surface = (name, spanM, rootChordM, tipChordM, sweepDeg, dihedralDeg, incidenceDeg, xLeadingRootM, zRootM) =>
  ({ name, spanM, rootChordM, tipChordM, sweepDeg, dihedralDeg, incidenceDeg, xLeadingRootM, zRootM });
const surfaces = [surface('main', 10, 3, 1.75, 12, 6, -3, 0, 0),
  surface('tail', 6, 2, 1.2, -8, 3, 2, 384, 256)];
const translate = (x, z) => ({
  surfaces: surfaces.map(s => ({ ...s, xLeadingRootM: s.xLeadingRootM + x, zRootM: s.zRootM + z })),
  referencePoint: [x + 128, .2, z + 128], velocityMS: 31, densityKgM3: 1.17, refAreaM2: 28,
  refChordM: 2.2, chordwiseRows: 2, spanwisePanels: 4
});
function relativeError(actual, expected) {
  const error = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(error <= 1e-9, `${actual} vs ${expected} (${error})`);
  return error;
}
function vectorError(actual, expected) {
  const error = Math.max(...actual.map((a, i) => Math.abs(a - expected[i]))) / Math.max(...expected.map(Math.abs));
  assert.ok(error <= 1e-9, `${actual} vs ${expected} (${error})`);
  return error;
}
for (const [x, z] of [[0, 0], [2 ** 54, -(2 ** 54)], [1e18, -1e18]]) {
  const options = translate(x, z);
  for (const [start, beta] of [[0, 0], [3, -7]]) {
    const swept = v.runVlmSweep({ ...options, alphaMinDeg: start, alphaMaxDeg: start + 2,
      alphaStepDeg: 1, betaDeg: beta });
    const errors = [];
    for (const point of swept.series) {
      const r = v.solveVlmCase({ ...options, alphaDeg: point.alphaDeg, betaDeg: beta });
      const expected = oracle.find(p => p.alpha === point.alphaDeg && p.beta === beta);
      assert.equal(r.validity.status, 'ok');
      assert.equal(r.diagnostics.wakeLengthM, expected.wake);
      assert.equal(r.diagnostics.kernelTruncations, 0);
      for (const k of ['cl', 'cdi', 'cdiNearField', 'cm']) {
        errors.push(relativeError(r[k], expected[k]), relativeError(point[k], expected[k]));
      }
      errors.push(relativeError(r.dragNNearFieldRaw, expected.rawNear), relativeError(r.dragNTrefftzRaw, expected.rawTrefftz),
        vectorError(r.totalForce, expected.force), vectorError(r.totalMoment, expected.moment),
        vectorError(r.circulation, expected.gamma));
      assert.ok(r.panels.every(p => p.y0 === p.boundA[1] && p.y1 === p.boundB[1]));
    }
    const first = swept.panels[0];
    write('translation', { x, z, start, beta, cl: swept.series[0].cl, cm: swept.series[0].cm,
      worldControlMinusBoundX: first.controlPoint[0] - first.boundMidpoint[0], maxError: Math.max(...errors) });
  }
}
const local = translate(0, 0);
const raw = v.generateVlmPanels(local.surfaces, local);
const supplied = v.solveVlmCase({ ...local, panels: raw });
const world = translate(1e18, -1e18);
const rounded = v.generateVlmPanels(world.surfaces, world);
const roundedResult = (() => {
  try { return v.solveVlmCase({ ...world, panels: rounded }).validity.status; }
  catch (error) { return error.message; }
})();
assert.equal(supplied.validity.status, 'ok');
assert.notEqual(roundedResult, 'ok');
assert.throws(() => v.solveVlmCase({ ...local, panels: raw.map(p => ({ ...p, y1: p.y1 + 1 })) }), /span edges/);
const separated = raw.map(p => p.surfaceName !== 'tail' ? p : { ...p, y0: p.y0 + 20, y1: p.y1 + 20,
  ...Object.fromEntries(['boundA', 'boundB', 'boundMidpoint', 'controlPoint']
    .map(k => [k, [p[k][0], p[k][1] + 20, p[k][2]]])) });
const shiftedRaw = v.solveVlmCase({ ...local, panels: separated });
assert.equal(shiftedRaw.diagnostics.wakeLengthM, 100);
write('supplied', { supplied: supplied.validity.status, roundedResult, offsetGroupWake: shiftedRaw.diagnostics.wakeLengthM });

const work = p => p ** 2 * (4096 + p);
const limit = 4 * work(2048);
const sentinel = { ...base, densityKgM3: 0 };
const only = (spanM) => [{ ...wing, spanM }];
const invoke = (call, options, message) => assert.throws(() => call({ ...sentinel, ...options }), message);
const dense = /VLM panel resource limit is 2048/;
const budget = /synchronous work limit/;
const solveEntry = /density must be positive/;
const two = [{ ...wing }, { ...wing, name: 'second' }];
assert.equal(v.generateVlmPanels(two, { spanwisePanels: 128, chordwiseRows: 16 }).length, 4096);
assert.throws(() => v.generateVlmPanels(two, { spanwisePanels: 129, chordwiseRows: 16 }), /generation resource limit is 4096/);
const lattice = { surfaces: only(10), spanwisePanels: 128, chordwiseRows: 16, alphaStepDeg: 1 };
invoke(v.runVlmSweep, { ...lattice, alphaMaxDeg: 3 }, solveEntry);
invoke(v.runVlmSweep, { ...lattice, alphaMaxDeg: 4 }, budget);
invoke(v.runVlmSweep, { ...lattice, spanwisePanels: 129 }, dense);
invoke(v.runVlmSweep, { alphaMaxDeg: 200, alphaStepDeg: 1 }, solveEntry);
invoke(v.runVlmSweep, { alphaMaxDeg: 201, alphaStepDeg: 1 }, /Sweep resource limit is 201/);
invoke(v.runVlmResolutionCheck, { surfaces: only(32) }, solveEntry);
invoke(v.runVlmResolutionCheck, { surfaces: only(33) }, dense);
const custom = { ...lattice, spanwisePanels: 64, chordwiseRows: 8 };
invoke(v.runVlmResolutionCheck, { ...custom, spanwisePanels: 65 }, dense);
const resolutionWork = b => 2 * (work(32 * Math.ceil(b / 2)) + work(128 * Math.ceil(b / 2)) + work(512) + work(2048));
const spanBoundary = Array.from({ length: 12 }, (_, i) => 10 + 2 * i).find(b => resolutionWork(b) > limit);
invoke(v.runVlmResolutionCheck, { ...custom, surfaces: only(spanBoundary - 2) }, solveEntry);
invoke(v.runVlmResolutionCheck, { ...custom, surfaces: only(spanBoundary) }, budget);
const maxCombinedPoints = Math.floor((limit - resolutionWork(10)) / work(512));
invoke(v.runVlmSweep, { ...custom, alphaMaxDeg: maxCombinedPoints }, solveEntry);
invoke(v.runVlmAnalysis, { ...custom, alphaMaxDeg: maxCombinedPoints - 1 }, solveEntry);
invoke(v.runVlmAnalysis, { ...custom, alphaMaxDeg: maxCombinedPoints }, budget);
write('work', { limit, perCaseMax: work(2048), atLimit: 4 * work(2048),
  customBoundary: [spanBoundary - 2, spanBoundary].map(span => ({ span, cost: resolutionWork(span) })),
  combinedBoundary: [maxCombinedPoints, maxCombinedPoints + 1].map(samples =>
    ({ samples, cost: resolutionWork(10) + samples * work(512) })) });
