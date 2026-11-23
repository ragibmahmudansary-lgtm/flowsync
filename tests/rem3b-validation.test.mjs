import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiftingSurface, generateVlmPanels, runVlmResolutionCheck, runVlmSweep, solveVlmCase} from '../src/vlmSolver.js';
const wing = {spanM:8, rootChordM:1, tipChordM:1};
const options = {surfaces:[wing], velocityMS:40, densityKgM3:1.225, refAreaM2:8, refChordM:1};
test('explicit malformed geometry is refused rather than defaulted', () => {
  for (const patch of [{sweepDeg:null}, {incidenceDeg:'1'}, {planform:'other'}, {rootChordM:0, macM:1}, {tipChordM:false, macM:1}])
    assert.throws(() => createLiftingSurface({...wing,...patch}));
});
test('lattice settings reject invalid or silently clamped counts', () => {
  for (const opts of [{chordwiseRows:0}, {chordwiseRows:1.5}, {spanwisePanels:3}, {spanwisePanels:'bad'}])
    assert.throws(() => generateVlmPanels([wing],opts));
});
test('resolution check rejects malformed beta rather than silently changing flow', () => {
  assert.throws(() => runVlmResolutionCheck({...options,betaDeg:null}));
});
test('sweep rejects duplicate representable samples before execution', () => {
  assert.throws(() => runVlmSweep({...options, chordwiseRows:1, spanwisePanels:4, alphaMinDeg:2**53, alphaMaxDeg:2**53+4, alphaStepDeg:1.1}), /represent|advance/i);
});
test('case rejects malformed wake, reference point and supplied panels', () => {
  const base = {...options, chordwiseRows:1, spanwisePanels:4};
  for (const patch of [{wakeLengthFactor:null}, {wakeLengthFactor:-1}, {referencePoint:[0,0,null]}, {panels:'bad'}])
    assert.throws(() => solveVlmCase({...base,...patch}));
});
