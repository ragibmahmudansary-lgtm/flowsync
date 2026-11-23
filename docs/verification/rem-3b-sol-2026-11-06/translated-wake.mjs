import {solveVlmCase} from '../../../src/vlmSolver.js';
for (const x of [0, 1e16, 1e17, 1e18]) {
  const options = {
    surfaces: [{spanM: 132.9, rootChordM: 64, tipChordM: 64, xLeadingRootM: x, incidenceDeg: 2}],
    alphaDeg: 0, velocityMS: 40, densityKgM3: 1.225, refChordM: 64, refAreaM2: 132.9 * 64,
    chordwiseRows: 1, spanwisePanels: 4, referencePoint: [x, 0, 0]
  };
  try {
    const result = solveVlmCase(options);
    const panel = result.panels[0];
    const origin = panel.boundA[0];
    const nominalM = result.diagnostics.wakeLengthM;
    // At alpha=beta=0 the offset has only an x component. Reconstruct the
    // stored endpoint and subtract its bound origin using binary64 arithmetic.
    console.log(JSON.stringify({x, origin, nominalM, actualXDisplacement: (origin + nominalM) - origin,
      controlXFromBoundM: panel.controlPoint[0] - panel.boundMidpoint[0],
      controlZFromBoundM: panel.controlPoint[2] - panel.boundMidpoint[2],
      cl: result.cl, validity: result.validity}));
  } catch (error) {
    console.log(JSON.stringify({x, error: error.message}));
  }
}
