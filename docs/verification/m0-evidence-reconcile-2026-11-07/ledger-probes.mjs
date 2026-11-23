// M0-EVIDENCE-RECONCILE constructed API probe (2026-11-07).
// Reproduces the independent-audit fixtures for IA-01 (SOL-02 badge quarantine),
// IA-03 (SOL-08 fixed-claim label), IA-05 (input identity) and the SOL-02 yaw and
// custom-lattice checks. The solver module path is an argument so the same frozen
// fixtures can run against the working tree and a HEAD-only scratch control.
// It writes JSON to stdout only and does not overwrite any frozen result.
//
// Usage (repository root):
//   node docs/verification/m0-evidence-reconcile-2026-11-07/ledger-probes.mjs            # working tree
//   node docs/verification/m0-evidence-reconcile-2026-11-07/ledger-probes.mjs <solver.js> # control copy
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const modulePath = process.argv[2] ? resolve(process.argv[2]) : resolve(here, '../../../src/vlmSolver.js');
const dut = await import(pathToFileURL(modulePath).href);

// Frozen label text as written by the approved contract and the HEAD solver.
const LEGACY_LABEL = 'flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %';
const V = 40;
const RHO = 1.225;

const out = { module: modulePath, ia03: [], ia01: null, ia05: null, sol02: [], sol02Custom: null };
const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

// ---- IA-03 / SOL-08: fixed-claim label on the four independent-audit fixtures.
// Base options are the frozen measure.mjs opts(): 8 m x 1 m rectangle, alpha 4 deg.
const wing = (b = 8, c = 1, extra = {}) => ({ name: 'wing', spanM: b, rootChordM: c, tipChordM: c, ...extra });
const opts = (extra = {}) => ({
  surfaces: [wing()], velocityMS: V, densityKgM3: RHO, refAreaM2: 8, refChordM: 1,
  referencePoint: [0.4, 0, 0], alphaDeg: 4, ...extra
});
for (const extra of [
  { chordwiseRows: 1, spanwisePanels: 4 },
  { chordwiseRows: 12, spanwisePanels: 48 },
  { alphaDeg: 35 },
  { surfaces: [wing(1)], refAreaM2: 1 }
]) {
  try {
    const r = dut.solveVlmCase(opts(extra));
    out.ia03.push({
      extra, cl: r.cl ?? null, cdi: r.cdi ?? null, validityStatus: r.validity?.status ?? null,
      uncertaintyLabel: r.uncertaintyLabel ?? null, uncertaintyScope: r.uncertaintyScope ?? null,
      legacyLabelShown: r.uncertaintyLabel === LEGACY_LABEL
    });
  } catch (error) {
    out.ia03.push({ extra, error: error.message });
  }
}

// ---- IA-01 / SOL-02: prescribed badge with a coplanar forward surface (AUD-1 fixture).
const wingA = { name: 'wing', spanM: 8, rootChordM: 1, tipChordM: 1 };
const canardA = { name: 'canard', spanM: 3, rootChordM: 0.5, tipChordM: 0.5, xLeadingRootM: -4 };
const ia01Base = {
  surfaces: [wingA, canardA], velocityMS: V, densityKgM3: RHO, refAreaM2: 8, refChordM: 1,
  referencePoint: [0.4, 0, 0]
};
{
  const check = dut.runVlmResolutionCheck(ia01Base);
  out.ia01 = {
    badge: check.badge, claim: check.claim, withinGates: check.withinGates,
    deltaClAlpha: check.deltaClAlpha ?? null, deltaCdi: check.deltaCdi ?? null,
    withholdingReason: check.withholdingReason ?? null,
    r1Valid: check.r1?.validity?.valid ?? null, r2Valid: check.r2?.validity?.valid ?? null,
    uncertaintyLabel: check.uncertaintyLabel ?? null
  };
}

// ---- IA-05: identity must distinguish placement, wake length and the seed flag.
{
  const idBase = dut.runVlmResolutionCheck(ia01Base).inputIdentity;
  const idMoved = dut.runVlmResolutionCheck({
    ...ia01Base, surfaces: [wingA, { ...canardA, xLeadingRootM: 4, zRootM: 0.6 }]
  }).inputIdentity;
  const idWake = dut.runVlmResolutionCheck({ ...ia01Base, wakeLengthFactor: 200 }).inputIdentity;
  const seedBase = {
    surfaces: [{ name: 'Wing', spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 }],
    velocityMS: V, densityKgM3: RHO, refAreaM2: 8, refChordM: 1, referencePoint: [0.25, 0, 0]
  };
  const idSeedOmitted = dut.runVlmResolutionCheck(seedBase).inputIdentity;
  const idSeedFalse = dut.runVlmResolutionCheck({ ...seedBase, seedReferencePlaceholder: false }).inputIdentity;
  const idSeedTrue = dut.runVlmResolutionCheck({ ...seedBase, seedReferencePlaceholder: true }).inputIdentity;
  out.ia05 = {
    movedCanardIdentityEqualToBase: JSON.stringify(idBase) === JSON.stringify(idMoved),
    wakeFactor200IdentityEqualToBase: JSON.stringify(idBase) === JSON.stringify(idWake),
    wakeLengthM: idBase.wake?.lengthM ?? null,
    seedOmittedEqualToFalse: JSON.stringify(idSeedOmitted) === JSON.stringify(idSeedFalse),
    seedTrueEqualToFalse: JSON.stringify(idSeedTrue) === JSON.stringify(idSeedFalse),
    seedTrueRecordsPlaceholder: idSeedTrue.seedReferencePlaceholder ?? null
  };
}

// ---- SOL-02: yaw and custom-lattice checks on the SOL-02 test fixture.
const badgeBase = {
  surfaces: [{ name: 'Wing', spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, xLeadingRootM: 0, zRootM: 0 }],
  velocityMS: V, densityKgM3: RHO, refAreaM2: 8, refChordM: 1, referencePoint: [0.25, 0, 0]
};
for (const betaDeg of [0, 5]) {
  const check = dut.runVlmResolutionCheck({ ...badgeBase, betaDeg });
  out.sol02.push({
    betaDeg, identityBetaDeg: check.inputIdentity?.betaDeg ?? null, badge: check.badge, claim: check.claim,
    withinGates: check.withinGates, deltaClAlpha: check.deltaClAlpha ?? null, deltaCdi: check.deltaCdi ?? null,
    coversPlottedLattice: check.coverage?.coversPlottedLattice ?? null, uncertaintyLabel: check.uncertaintyLabel ?? null
  });
}
{
  const check = dut.runVlmResolutionCheck({ ...badgeBase, chordwiseRows: 1, spanwisePanels: 4 });
  out.sol02Custom = {
    badge: check.badge, claim: check.claim, latticeLabel: check.coverage?.latticeLabel ?? null,
    coversPlottedLattice: check.coverage?.coversPlottedLattice ?? null,
    withholdingReason: check.withholdingReason ?? null,
    currentGridClaim: check.currentGrid?.claim ?? null,
    currentGridDeltaClAlpha: check.currentGrid?.deltaClAlpha ?? null,
    currentGridDeltaCdi: check.currentGrid?.deltaCdi ?? null,
    currentGridWithinGates: check.currentGrid?.withinGates ?? null,
    uncertaintyLabel: check.uncertaintyLabel ?? null
  };
}

console.log(JSON.stringify(plain(out), null, 2));
