// M0-EVIDENCE-RECONCILE minimal reproduction of the extreme-reference fit refusal.
// At a 3e-307 m^2 reference area the plotted three-sample sweep throws
// "Nonfinite sweep fit or stability output" while the two-sample sweep (and the
// 0/4 deg comparison) returns. Read-only: prints JSON, writes nothing.
// Usage (repository root): node docs/verification/m0-evidence-reconcile-2026-11-07/extreme-fit-refusal-probe.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dut = await import(pathToFileURL(resolve(here, '../../../src/vlmSolver.js')).href);
const wing = { name: 'wing', spanM: 8, rootChordM: 1, tipChordM: 1 };
const base = {
  surfaces: [wing], velocityMS: 40, densityKgM3: 1.225, refChordM: 1, referencePoint: [0.4, 0, 0]
};
const sweepSummary = (label, options) => {
  try {
    const r = dut.runVlmSweep(options);
    return { label, outcome: 'returned', sweepStatus: r.validity?.status ?? null, points: r.series.length, clAlphaPerRadFit: r.clAlphaPerRad ?? null };
  } catch (error) {
    return { label, outcome: 'threw', message: error.message };
  }
};
const comparisonSummary = (label, options) => {
  try {
    const c = dut.runVlmResolutionCheck(options);
    return { label, outcome: 'returned', badge: c.badge, claim: c.claim, deltaClAlpha: c.deltaClAlpha ?? null, deltaCdi: c.deltaCdi ?? null };
  } catch (error) {
    return { label, outcome: 'threw', message: error.message };
  }
};
const results = [];
for (const area of [3e-307, 2e-307]) {
  results.push(sweepSummary(`sweep 0/2/4 deg, S=${area}`, { ...base, refAreaM2: area, alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 2 }));
  results.push(sweepSummary(`sweep 0/4 deg, S=${area}`, { ...base, refAreaM2: area, alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 4 }));
  results.push(comparisonSummary(`comparison 0/4 deg, S=${area}`, { ...base, refAreaM2: area }));
}
console.log(JSON.stringify({ module: 'src/vlmSolver.js (working tree)', results }, null, 2));
