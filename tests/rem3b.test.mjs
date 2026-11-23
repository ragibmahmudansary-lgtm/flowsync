import test from 'node:test';
import assert from 'node:assert/strict';
import { trefftzDrag } from '../src/vlmSolver.js';

const panel = { boundA: [0, -0.5, 0], boundB: [0, 0.5, 0], boundMidpoint: [0, 0, 0] };
test('IA-04 rejects missing or nonnumeric circulation instead of zero', () => {
  for (const value of [null, '', false, '1', undefined, NaN, Infinity]) {
    assert.throws(() => trefftzDrag([panel], [value], 1, [1, 0, 0]), /circulation\[0\]/);
  }
  assert.equal(trefftzDrag([panel], [0], 1, [1, 0, 0]).dragNTrefftz, 0);
});
