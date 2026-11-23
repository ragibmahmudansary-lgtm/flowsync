import test from 'node:test';
import assert from 'node:assert/strict';
import {runVlmSweep, runVlmResolutionCheck, solveVlmCase} from '../src/vlmSolver.js';

const base = {alphaMinDeg:0, alphaMaxDeg:0, alphaStepDeg:1};
test('public solver entry points reject absent or malformed option objects explicitly', () => {
  for (const call of [runVlmSweep, runVlmResolutionCheck, solveVlmCase]) {
    for (const value of [undefined, null, [], 'bad'])
      assert.throws(() => call(value), /options object/i);
  }
});
test('sweep and resolution reject absent, non-array and empty surfaces explicitly', () => {
  for (const call of [runVlmSweep, runVlmResolutionCheck]) {
    for (const surfaces of [undefined, null, {}, []])
      assert.throws(() => call({...base, surfaces}), /at least one lifting surface/i);
  }
});
