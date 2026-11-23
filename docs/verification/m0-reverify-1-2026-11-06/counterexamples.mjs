import * as v from '../../../src/vlmSolver.js';
const wing = { name: 'constructor', spanM: 8, rootChordM: 1, tipChordM: 1 };
const base = { surfaces: [wing], velocityMS: 40, densityKgM3: 1.225, refAreaM2: 8,
  refChordM: 1, referencePoint: [.4, 0, 0], chordwiseRows: 4, betaDeg: 3.25,
  alphaMinDeg: 0, alphaMaxDeg: 4, alphaStepDeg: 2 };
const ordinary = v.runVlmAnalysis(base);
const seeded = v.runVlmAnalysis({ ...base, seedReferencePlaceholder: true });
console.log(JSON.stringify({
  probe: 'seed', sameIdentity: JSON.stringify(ordinary.resolutionCheck.inputIdentity) ===
    JSON.stringify(seeded.resolutionCheck.inputIdentity),
  firstValidity: ordinary.series[1].validity, secondValidity: seeded.series[1].validity,
  identity: seeded.resolutionCheck.inputIdentity
}));
for (const refAreaM2 of [1e-306, 2e-307, 1e-307]) {
  const r = v.runVlmResolutionCheck({ ...base, betaDeg: 0, refAreaM2 });
  console.log(JSON.stringify({ probe: 'resolution overflow', refAreaM2,
    status: r.comparisonValidity, badge: r.badge, claim: r.claim, r1: r.r1.validity, r2: r.r2.validity,
    slopeR1: String(r.r1.clAlphaTwoPointPerRad), slopeR2: String(r.r2.clAlphaTwoPointPerRad), cdiR1: r.r1.cdiAt4Deg }));
}
