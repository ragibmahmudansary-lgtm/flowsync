import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const dir = process.argv[2];
const read = (stem, n) => {
  const file = `${stem} (${n}).json`;
  const bytes = readFileSync(join(dir, file));
  return { file, sha256: createHash('sha256').update(bytes).digest('hex'), value: JSON.parse(bytes) };
};
const outputs = [];
for (const [projectNo, resultNo, area, rows, claim, badge, coverage] of [
  [17, 18, 3e-307, 4, 'prescribed R1 vs R2', 'green', true],
  [18, 19, 2e-307, 4, 'withheld', 'amber', false],
  [19, 20, 2.12e-307, 3, 'withheld', 'amber', false],
  [20, 21, 3e-307, 3, 'current lattice vs 2x refined lattice', 'amber', true]
]) {
  const { value: project, ...projectFile } = read('airflow-project', projectNo);
  const { value: result, ...resultFile } = read('airflow-vlm-results', resultNo);
  assert.equal(project.schema, 'airflow.browser-project');
  assert.equal(result.schema, 'airflow.vlm-results');
  assert.equal(project.version, 1);
  assert.equal(result.version, 1);
  for (const key of ['resolutionCheck', 'resolution', 'provenance', 'validity', 'uncertaintyLabel', 'uncertaintyScope']) {
    assert.deepEqual(project.analysis[key], result[key]);
  }
  const { resolutionCheck: check, provenance, uncertaintyLabel, series } = result;
  assert.deepEqual([check.claim, check.badge, check.coverage.coversPlottedLattice], [claim, badge, coverage]);
  assert.equal(provenance.referenceSource, 'bounds');
  assert.equal(provenance.inputs.refAreaM2, area);
  assert.equal(provenance.inputs.chordwiseRows, rows);
  assert.equal(provenance.inputs.seedReferencePlaceholder, true);
  assert.equal(check.inputIdentity.seedReferencePlaceholder, true);
  assert.equal(check.inputIdentity.refAreaM2, area);
  assert.deepEqual(check.coverage.latticeCounts, result.resolution.spanwisePanels);
  assert.deepEqual(check.coverage.alphaDeg, [0, 4]);
  assert.deepEqual(check.inputIdentity.alphaProtocolDeg, [0, 4]);
  assert.equal(check.coverage.betaDeg, 0);
  assert.deepEqual(check.gates, { clAlpha: .01, cdi: .05 });
  assert.equal(uncertaintyLabel, 'unverified: fixed Tier-0 uncertainty claim unavailable');
  assert.deepEqual(series.map(p => p.alphaDeg), [0, 4]);
  for (const point of series) {
    assert.equal(point.availability, 'available');
    assert.equal(point.validity.status, 'warning');
    assert.ok(point.validity.messages.some(message => message.includes('bounds-seed placeholder')));
    for (const field of ['cl', 'cdi', 'cd', 'cm', 'liftN', 'dragN', 'momentNm']) {
      assert.ok(Number.isFinite(point[field]));
      assert.equal(project.analysis.series.find(p => p.alphaDeg === point.alphaDeg)[field], point[field]);
    }
  }
  const reason = grid => `${grid} two-point lift slope is nonfinite`;
  if (area === 2e-307) {
    assert.deepEqual(check.comparisonValidity, { valid: false, reasons: [reason('coarse'), reason('fine')] });
    assert.equal(check.withholdingReason, [reason('coarse'), reason('fine')].join('; '));
    assert.equal(check.deltaClAlpha, null);
    assert.equal(check.deltaCdi, null);
    for (const [grid, label] of [[check.r1, 'coarse'], [check.r2, 'fine']]) {
      assert.deepEqual(grid.validity, { valid: false, reasons: [reason(label)] });
      assert.equal(grid.clAlphaTwoPointPerRad, null);
      assert.equal(grid.cdiAt4Deg, null);
    }
  } else {
    assert.equal(check.withinGates, true);
    assert.ok([check.deltaClAlpha, check.deltaCdi, check.r1.clAlphaTwoPointPerRad,
      check.r2.clAlphaTwoPointPerRad].every(Number.isFinite));
  }
  if (area === 2.12e-307) {
    assert.equal(check.withholdingReason, reason('coarse'));
    assert.deepEqual(check.currentGrid.validity, { valid: false, reasons: [reason('coarse')],
      current: { valid: false, reasons: [reason('coarse')] }, refined: { valid: true, reasons: [] } });
    for (const key of ['deltaClAlpha', 'deltaCdi']) assert.equal(Object.hasOwn(check.currentGrid, key), false);
  } else if (rows === 3) {
    assert.equal(check.currentGrid.claim, 'compared');
    assert.equal(check.currentGrid.validity.valid, true);
    assert.equal(check.currentGrid.withinGates, false);
    assert.ok(check.currentGrid.deltaClAlpha > .01 && check.currentGrid.deltaCdi <= .05);
  }
  outputs.push({ area, rows, projectFile, resultFile, check, provenance, series });
}
const { value: entry, ...entryFile } = read('airflow-project', 16);
assert.deepEqual(entry.analysis.resolutionCheck, outputs[3].check);
console.log(JSON.stringify({ preCustomProject: entryFile, finalPairs: outputs }, null, 2));
