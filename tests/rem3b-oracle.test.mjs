import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runVlmSweep } from '../src/vlmSolver.js';
const vectors = JSON.parse(readFileSync(new URL('../docs/verification/rem-3b-challenge-2026-11-06/decimal-oracle.json', import.meta.url)));
const base = {surfaces:[{spanM:8,rootChordM:1,tipChordM:1}],chordwiseRows:1,spanwisePanels:4,velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1};
test('decimal samples match independent decimal arithmetic vectors', () => {
 for (const [alphaMinDeg, alphaMaxDeg, alphaStepDeg, expected] of vectors) {
  const actual = runVlmSweep({...base,alphaMinDeg,alphaMaxDeg,alphaStepDeg}).series.map(p => p.alphaDeg);
  assert.deepEqual(actual, expected, `range ${alphaMinDeg}..${alphaMaxDeg} by ${alphaStepDeg}`);
 }
});
