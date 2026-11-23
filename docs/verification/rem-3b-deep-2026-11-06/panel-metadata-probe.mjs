import { generateVlmPanels, solveVlmCase } from '../../../src/vlmSolver.js';
const panels = generateVlmPanels([{ spanM: 8, rootChordM: 1, tipChordM: 1 }], { chordwiseRows: 1, spanwisePanels: 4 });
const options = { alphaDeg: 4, velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8, refChordM: 1 };
for (const input of [panels, panels.map(p => ({...p, y0: p.y0 / 100, y1: p.y1 / 100}))]) {
  const result = solveVlmCase({...options, panels: input});
  console.log(JSON.stringify({wakeLengthM:result.diagnostics.wakeLengthM, cl:result.cl, validity:result.validity}));
}
