import test from 'node:test';
import assert from 'node:assert/strict';
import { runVlmSweep } from '../src/vlmSolver.js';
const base = {surfaces:[{spanM:8,rootChordM:1,tipChordM:1}], chordwiseRows:1, spanwisePanels:4, velocityMS:40, densityKgM3:1.225, refAreaM2:8, refChordM:1, alphaMinDeg:4, alphaMaxDeg:4, alphaStepDeg:1};
test('finite offsets cannot produce nonfinite sweep outputs', () => {
  for (const offset of [{cd0:1e308}, {cm0:1e308}])
    assert.throws(() => runVlmSweep({...base, ...offset}), /nonfinite sweep output/i);
});
