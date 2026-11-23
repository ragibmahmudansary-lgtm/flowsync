import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = process.argv[2];
const source = (stem, id) => {
  const file = `${stem} (${id}).json`;
  const bytes = readFileSync(join(directory, file));
  return { file, sha256: createHash('sha256').update(bytes).digest('hex'), data: JSON.parse(bytes) };
};
const previous = JSON.parse(readFileSync(new URL('../m0-reverify-3-2026-11-06/browser-downloads.json', import.meta.url)));
const rows = [
  [21, 22, 3e-307, 4, 'prescribed R1 vs R2', 'green', true],
  [22, 23, 2e-307, 4, 'withheld', 'amber', false],
  [23, 24, 3e-307, 3, 'current lattice vs 2x refined lattice', 'amber', true],
  [24, 25, 2.12e-307, 3, 'withheld', 'amber', false]
];
const captures = [];
for (const [projectId, resultId, area, chordRows, claim, badge, coverage] of rows) {
  const { data: project, ...projectFile } = source('airflow-project', projectId);
  const { data: result, ...resultFile } = source('airflow-vlm-results', resultId);
  assert.deepEqual([project.schema, project.version, result.schema, result.version],
    ['airflow.browser-project', 1, 'airflow.vlm-results', 1]);
  for (const field of ['resolutionCheck', 'resolution', 'provenance', 'validity', 'uncertaintyLabel', 'uncertaintyScope']) {
    assert.deepEqual(project.analysis[field], result[field], field);
  }
  const { resolutionCheck: check, provenance, resolution, series, uncertaintyLabel } = result;
  assert.deepEqual([check.claim, check.badge, check.coverage.coversPlottedLattice], [claim, badge, coverage]);
  assert.deepEqual([check.inputIdentity.refAreaM2, provenance.inputs.refAreaM2, provenance.inputs.chordwiseRows],
    [area, area, chordRows]);
  assert.deepEqual([provenance.referenceSource, provenance.inputs.seedReferencePlaceholder, check.inputIdentity.seedReferencePlaceholder],
    ['bounds', true, true]);
  assert.equal(uncertaintyLabel, 'unverified: fixed Tier-0 uncertainty claim unavailable');
  assert.equal(check.uncertaintyLabel, uncertaintyLabel);
  assert.deepEqual(check.coverage.alphaDeg, [0, 4]);
  assert.deepEqual(check.inputIdentity.alphaProtocolDeg, [0, 4]);
  assert.deepEqual(check.gates, { clAlpha: 0.01, cdi: 0.05 });
  assert.equal(check.coverage.betaDeg, provenance.inputs.betaDeg);
  assert.equal(check.coverage.latticeLabel, resolution.label);
  assert.deepEqual(check.coverage.latticeCounts, resolution.spanwisePanels);
  assert.deepEqual(series.map(p => p.alphaDeg), [0, 4]);
  for (const [i, point] of series.entries()) {
    assert.equal(point.availability, 'available');
    assert.equal(point.validity.status, 'warning');
    assert.ok(point.validity.messages.some(message => message.includes('bounds-seed placeholder')));
    for (const field of ['cl', 'cdi', 'cd', 'cm', 'liftN', 'dragN', 'momentNm']) {
      assert.ok(Number.isFinite(point[field]), field);
      assert.equal(point[field], project.analysis.series[i][field], field);
    }
  }
  const baseline = previous.finalPairs.find(row => row.area === area && row.rows === chordRows);
  assert.deepEqual(check, baseline.check);
  assert.deepEqual(provenance, baseline.provenance);
  assert.deepEqual(series, baseline.series);
  captures.push({ area, chordRows, projectFile, resultFile, check, provenance, series, matchesReverify3: true });
}
console.log(JSON.stringify(captures, null, 2));
