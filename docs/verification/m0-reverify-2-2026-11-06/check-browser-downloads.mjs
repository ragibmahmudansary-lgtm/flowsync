import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Reproduction: pass the directory with the downloads from the documented
// browser sequence. Filenames below are the ones assigned by this browser.
const dir = process.argv[2];
const rows = [
  ['entry-prescribed-overflow', 1, 3, 'withheld'],
  ['entry-custom-overflow', 2, 4, 'withheld'],
  ['entry-custom-usable', 3, 5, 'current lattice vs 2x refined lattice'],
  ['entry-custom-representable', 4, 6, 'withheld'],
  ['entry-prescribed-representable', 5, 7, 'withheld'],
  ['entry-seed-true', 6, 8, 'prescribed R1 vs R2'],
  ['entry-seed-false', 7, 9, 'prescribed R1 vs R2'],
  ['final-prescribed-overflow', 8, 10, 'withheld'],
  ['final-prescribed-split', 9, 11, 'withheld'],
  ['final-prescribed-representable', 10, 12, 'prescribed R1 vs R2'],
  ['final-custom-overflow', 11, 13, 'withheld'],
  ['final-custom-uncovered', 12, 14, 'withheld'],
  ['final-custom-representable', 13, 15, 'current lattice vs 2x refined lattice'],
  ['final-seed-true', 14, 16, 'prescribed R1 vs R2'],
  ['final-seed-false', 15, 17, 'prescribed R1 vs R2']
];
const read = (stem, number) => JSON.parse(readFileSync(join(dir, `${stem} (${number}).json`), 'utf8'));
const measured = Object.fromEntries(rows.map(([key, projectNo, resultNo, claim]) => {
  const project = read('airflow-project', projectNo);
  const result = read('airflow-vlm-results', resultNo);
  assert.equal(project.schema, 'airflow.browser-project');
  assert.equal(result.schema, 'airflow.vlm-results');
  assert.equal(project.version, 1);
  assert.equal(result.version, 1);
  for (const field of ['resolutionCheck', 'provenance', 'validity', 'resolution', 'uncertaintyLabel', 'uncertaintyScope']) {
    assert.deepEqual(project.analysis[field], result[field]);
  }
  const { resolutionCheck: check, provenance, validity, uncertaintyLabel, series } = result;
  const seeded = !key.endsWith('seed-false');
  assert.equal(check.claim, claim);
  assert.equal(check.inputIdentity.seedReferencePlaceholder, seeded);
  assert.equal(provenance.inputs.seedReferencePlaceholder, seeded);
  assert.equal(provenance.referenceSource, seeded ? 'bounds' : 'recognized');
  assert.deepEqual(check.inputIdentity.alphaProtocolDeg, [0, 4]);
  assert.deepEqual(check.coverage.alphaDeg, [0, 4]);
  assert.equal(check.coverage.betaDeg, provenance.inputs.betaDeg);
  assert.equal(check.coverage.coversPlottedLattice, claim !== 'withheld');
  assert.match(uncertaintyLabel, /unverified/);
  assert.deepEqual(check.gates, { clAlpha: 0.01, cdi: 0.05 });
  assert.deepEqual(series.map(point => point.alphaDeg), [0, 4]);
  assert.ok(series.every(point => point.availability === 'available' &&
    [point.cl, point.cdi, point.cd, point.cm, point.liftN, point.dragN, point.momentNm].every(Number.isFinite) &&
    point.validity.status === (seeded ? 'warning' : 'ok') &&
    point.validity.messages.some(message => message.includes('bounds-seed placeholder')) === seeded));
  if (claim === 'withheld') {
    assert.equal(check.badge, 'amber');
    assert.match(check.withholdingReason, /two-point lift slope is nonfinite/);
  }
  if (!check.comparisonValidity.valid) {
    assert.equal(check.deltaClAlpha, null);
    assert.equal(check.deltaCdi, null);
  }
  for (const grid of [check.r1, check.r2]) {
    if (!grid.validity.valid) {
      assert.equal(grid.clAlphaTwoPointPerRad, null);
      assert.equal(grid.cdiAt4Deg, null);
    } else {
      assert.ok(Number.isFinite(grid.clAlphaTwoPointPerRad));
      assert.ok(Number.isFinite(grid.cdiAt4Deg));
    }
  }
  if (check.currentGrid?.claim === 'withheld') {
    assert.equal(Object.hasOwn(check.currentGrid, 'deltaClAlpha'), false);
    assert.equal(Object.hasOwn(check.currentGrid, 'deltaCdi'), false);
    assert.equal(check.currentGrid.validity.current.valid, false);
    assert.equal(check.currentGrid.validity.refined.valid, false);
  }
  return [key, { projectNo, resultNo, validity, uncertaintyLabel, provenance, check, series }];
}));
for (const stage of ['entry', 'final']) {
  const yes = measured[`${stage}-seed-true`], no = measured[`${stage}-seed-false`];
  assert.deepEqual(yes.check.inputIdentity, { ...no.check.inputIdentity, seedReferencePlaceholder: true });
  assert.deepEqual(yes.provenance.inputs, { ...no.provenance.inputs, seedReferencePlaceholder: true });
  assert.deepEqual(yes.check.coverage, no.check.coverage);
  assert.deepEqual(yes.series.map(({ validity, ...point }) => point), no.series.map(({ validity, ...point }) => point));
}
for (const key of ['final-prescribed-overflow', 'final-custom-overflow']) {
  const { r1, r2 } = measured[key].check;
  assert.equal(r1.validity.valid, false);
  assert.equal(r2.validity.valid, false);
}
assert.equal(measured['final-prescribed-split'].check.r1.validity.valid, false);
assert.equal(measured['final-prescribed-split'].check.r2.validity.valid, true);
assert.equal(measured['final-custom-uncovered'].check.withinGates, true);
assert.equal(measured['final-custom-uncovered'].check.coverage.coversPlottedLattice, false);
console.log(JSON.stringify(measured, null, 2));
