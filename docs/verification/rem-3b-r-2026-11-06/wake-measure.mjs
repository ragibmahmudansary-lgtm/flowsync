import { solveVlmCase, trefftzDrag } from '../../../src/vlmSolver.js';
const wing = { spanM: 132.9, rootChordM: 64, tipChordM: 64, incidenceDeg: 2 };
for (const [alphaDeg, betaDeg] of [[0, 0], [3, 8]]) {
  for (const [x, z] of [[0, 0], [1e16, 0], [1e17, 0], [1e18, 0], [1e18, -1e18]]) {
    const result = solveVlmCase({
      surfaces: [{...wing, xLeadingRootM: x, zRootM: z}], alphaDeg, betaDeg,
      velocityMS: 40, densityKgM3: 1.225, refAreaM2: wing.spanM * 64, refChordM: 64,
      chordwiseRows: 1, spanwisePanels: 4, referencePoint: [x, 0, z]
    });
    const { cl, cdi, cdiNearField, cm, totalForce, circulation, dragNTrefftzRaw, dragNNearFieldRaw, validity } = result;
    console.log(JSON.stringify({ kind: 'case', alphaDeg, betaDeg, x, z, cl, cdi, cdiNearField, cm,
      totalForce, circulation, dragNTrefftzRaw, dragNNearFieldRaw, validity: validity.status,
      wakeM: result.diagnostics.wakeLengthM, truncations: result.diagnostics.kernelTruncations }));
  }
}
for (const x of [0, 1e16, 1e18]) {
  const panels = [{boundA: [x, -0.5, -x], boundB: [x, 0.5, -x], boundMidpoint: [x, 0, -x]}];
  const result = trefftzDrag(panels, [1], 1, [1, 0.3, 0.2]);
  console.log(JSON.stringify({ kind: 'analytic projection', x, expectedDrag: 1 / Math.PI,
    drag: result.dragNTrefftz, rawDrag: result.dragNTrefftzRaw, suppression: result.trefftzSuppression }));
}
