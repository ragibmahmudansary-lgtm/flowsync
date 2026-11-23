import test from 'node:test';
import assert from 'node:assert/strict';
import {runVlmSweep, solveVlmCase, generateVlmPanels} from '../src/vlmSolver.js';
const surface = {spanM:8,rootChordM:1,tipChordM:1};
const base = {surfaces:[surface], chordwiseRows:1, spanwisePanels:4, alphaMinDeg:0, alphaMaxDeg:0, alphaStepDeg:1, velocityMS:40,densityKgM3:1.225,refAreaM2:8,refChordM:1};
test('sweep rejects missing, nonnumeric and nonpositive step values', () => {
  for (const key of ['alphaMinDeg','alphaMaxDeg','alphaStepDeg']) for (const value of [undefined,null,'',NaN,Infinity]) assert.throws(() => runVlmSweep({...base,[key]:value}), new RegExp(key));
  for (const value of [0,-1]) assert.throws(() => runVlmSweep({...base,alphaStepDeg:value}), /alphaStepDeg/);
});
test('explicit invalid case and sweep inputs are not replaced by defaults', () => {
  for (const [key,value] of [['alphaDeg','bad'],['betaDeg',NaN],['cm0','bad']]) {
    if (key === 'cm0') assert.throws(() => runVlmSweep({...base,[key]:value}), /cm0/);
    else assert.throws(() => solveVlmCase({...base,[key]:value}), new RegExp(key));
  }
});
test('excessive sweep and automatic lattice are refused before allocation', () => {
  assert.throws(() => runVlmSweep({...base,alphaMaxDeg:100000}), /resource limit/i);
  assert.throws(() => generateVlmPanels([{...surface,spanM:100000}],{chordwiseRows:4}), /resource limit/i);
});
test('sweep resource boundary and floating point progress', () => {
  assert.equal(runVlmSweep({...base, alphaMaxDeg:200}).series.length, 201);
  assert.throws(() => runVlmSweep({...base, alphaMaxDeg:201}), /resource limit/i);
  assert.throws(() => runVlmSweep({...base, alphaMinDeg:1e17, alphaMaxDeg:1e17}), /cannot advance/);
});
