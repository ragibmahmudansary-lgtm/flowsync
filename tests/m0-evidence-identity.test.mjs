// M0-EVIDENCE-GAP-CLOSE (ledger L4, IA-05): every material input of the
// resolution-check identity must change the identity when it changes.
// Test-only: no production expectation is weakened. A field that does not
// change the identity is a traceability defect and would fail here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runVlmResolutionCheck } from '../src/vlmSolver.js';

const wing = { name: 'Wing', spanM: 8, rootChordM: 1, tipChordM: 1, sweepDeg: 0, dihedralDeg: 0, incidenceDeg: 0, xLeadingRootM: 0, zRootM: 0 };
const canard = { name: 'Canard', spanM: 3, rootChordM: 0.5, tipChordM: 0.5, sweepDeg: 0, dihedralDeg: 0, incidenceDeg: 0, xLeadingRootM: -4, zRootM: 0 };
const base = {
  surfaces: [wing, canard],
  velocityMS: 40,
  densityKgM3: 1.225,
  refAreaM2: 8,
  refChordM: 1,
  referencePoint: [0.25, 0, 0],
  chordwiseRows: 4
};

const identityOf = (options) => JSON.stringify(runVlmResolutionCheck(options).inputIdentity);
const baseIdentity = identityOf(base);

// Flow, reference and seed inputs, each changed to a different value.
const flowAndReference = [
  ['velocityMS', { velocityMS: 41 }],
  ['densityKgM3', { densityKgM3: 1.2 }],
  ['refAreaM2', { refAreaM2: 8.1 }],
  ['refChordM', { refChordM: 1.01 }],
  ['referencePoint', { referencePoint: [0.3, 0, 0] }],
  ['betaDeg', { betaDeg: 5 }],
  ['cd0', { cd0: 0.01 }],
  ['cm0', { cm0: 0.01 }],
  ['wakeLengthFactor', { wakeLengthFactor: 25 }],
  ['seedReferencePlaceholder', { seedReferencePlaceholder: true }]
];

// Lattice inputs (the plotted lattice that the comparison certifies). The base uses the
// automatic spanwise count, so only the explicit-spanwise case takes the custom-lattice path.
const lattice = [
  ['chordwiseRows', { chordwiseRows: 5 }],
  ['spanwisePanels', { spanwisePanels: 10 }]
];

// Per-surface fields, applied separately to the wing (index 0) and the canard (index 1).
// The canard x change keeps it clear of the wing (x = 0.1 would overlap the wing and
// is refused by the Trefftz guard, which is a different result).
const surfaceFields = [
  ['name', { name: 'Wing-B' }],
  ['spanM', { spanM: 8.5 }],
  ['rootChordM', { rootChordM: 1.05 }],
  ['tipChordM', { tipChordM: 0.9 }],
  ['sweepDeg', { sweepDeg: 5 }],
  ['dihedralDeg', { dihedralDeg: 3 }],
  ['zRootM', { zRootM: 0.1 }]
];

test('IA-05 control: identical inputs give an identical identity', () => {
  assert.equal(identityOf(base), baseIdentity);
});

for (const [field, change] of flowAndReference.concat(lattice)) {
  test(`IA-05: changing ${field} changes the input identity`, () => {
    assert.notEqual(identityOf({ ...base, ...change }), baseIdentity, `${field} is absent from the identity`);
  });
}

for (const [index, surfaceName] of [[0, 'wing'], [1, 'canard']]) {
  for (const [field, change] of surfaceFields) {
    test(`IA-05: changing ${surfaceName} ${field} changes the input identity`, () => {
      const surfaces = [wing, canard].map((surface, i) => (i === index ? { ...surface, ...change } : surface));
      assert.notEqual(identityOf({ ...base, surfaces }), baseIdentity, `${surfaceName} ${field} is absent from the identity`);
    });
  }
}

test('IA-05: changing wing incidenceDeg changes the input identity', () => {
  const surfaces = [{ ...wing, incidenceDeg: 1 }, canard];
  assert.notEqual(identityOf({ ...base, surfaces }), baseIdentity, 'wing incidenceDeg is absent from the identity');
});

test('IA-05: changing wing xLeadingRootM changes the input identity', () => {
  const surfaces = [{ ...wing, xLeadingRootM: 0.1 }, canard];
  assert.notEqual(identityOf({ ...base, surfaces }), baseIdentity, 'wing xLeadingRootM is absent from the identity');
});

test('IA-05: changing canard xLeadingRootM to -4.1 changes the input identity', () => {
  const surfaces = [wing, { ...canard, xLeadingRootM: -4.1 }];
  assert.notEqual(identityOf({ ...base, surfaces }), baseIdentity, 'canard xLeadingRootM is absent from the identity');
});

test('IA-05: changing canard incidenceDeg changes the input identity', () => {
  const surfaces = [wing, { ...canard, incidenceDeg: 1 }];
  assert.notEqual(identityOf({ ...base, surfaces }), baseIdentity, 'canard incidenceDeg is absent from the identity');
});

// Known solver limit, recorded rather than hidden: with an explicit 8-strip spanwise
// count (4 chordwise rows), a canard incidence of ±0.5 deg, 1 deg or 2 deg is refused by
// the Trefftz negative-drag guard. A refused case reports no identity, so nothing is compared.
// The automatic lattice above solves these cases. If this stops throwing, review this record.
test('IA-05 known limit: explicit 8-strip canard incidence is refused by the Trefftz guard', () => {
  const explicit = { ...base, spanwisePanels: 8 };
  for (const incidenceDeg of [0.5, -0.5, 1, 2]) {
    const surfaces = [wing, { ...canard, incidenceDeg }];
    assert.throws(() => identityOf({ ...explicit, surfaces }), /Trefftz-plane induced drag is negative/,
      `canard incidence ${incidenceDeg} deg no longer refused; review the known-limit record`);
  }
});
