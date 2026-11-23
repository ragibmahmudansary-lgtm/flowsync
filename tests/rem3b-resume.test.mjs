import test from 'node:test';
import assert from 'node:assert/strict';
import {generateVlmPanels, solveVlmCase, runVlmSweep} from '../src/vlmSolver.js';
const wing = {spanM:8, rootChordM:1, tipChordM:1};
const base = {surfaces:[wing], velocityMS:40, densityKgM3:1.225, refAreaM2:8, refChordM:1, chordwiseRows:1, spanwisePanels:4};
test('negative profile drag is refused, not silently converted to zero', () => {
  assert.throws(() => runVlmSweep({...base,alphaMinDeg:0,alphaMaxDeg:0,alphaStepDeg:1,cd0:-0.1}), /cd0/i);
});
test('degenerate supplied panels are refused before solving', () => {
  const panel = generateVlmPanels([wing], {chordwiseRows:1,spanwisePanels:4})[0];
  for (const patch of [{normal:[0,0,0]}, {boundB:panel.boundA}, {widthLengthRatio:0}, {y1:panel.y0}])
    assert.throws(() => solveVlmCase({...base,panels:[{...panel,...patch}]}), /panel/i);
});
