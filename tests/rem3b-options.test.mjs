import test from 'node:test';
import assert from 'node:assert/strict';
import {generateVlmPanels} from '../src/vlmSolver.js';
const wing = [{spanM:8,rootChordM:1,tipChordM:1}];
test('explicit malformed lattice options are rejected', () => {
  for (const options of [null, false, '', 'auto', [], 1n]) assert.throws(() => generateVlmPanels(wing, options), /options/i);
});
