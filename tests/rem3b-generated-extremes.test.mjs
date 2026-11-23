import test from 'node:test';
import assert from 'node:assert/strict';
import { generateVlmPanels } from '../src/vlmSolver.js';

test('panel generator refuses nonfinite and degenerate derived geometry', () => {
  const options = { chordwiseRows: 1, spanwisePanels: 4 };
  for (const surface of [
    { spanM: 1e308, rootChordM: 1e307, tipChordM: 1e307 },
    { spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 1e308 },
    { spanM: 8, rootChordM: 1, tipChordM: 1, incidenceDeg: 1e308 },
  ]) assert.throws(() => generateVlmPanels([surface], options), /generated panel.*geometry/i);
  assert.equal(generateVlmPanels([{spanM:8,rootChordM:1,tipChordM:1}], options).length, 4);
});
