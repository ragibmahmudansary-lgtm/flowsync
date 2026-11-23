# Implementation Status

Canonical status rollup across milestones. Updated per implementation phase. Detailed
per-milestone trackers live in [`milestones/`](milestones/); chronological detail lives in
[`IMPLEMENTATION_CHANGELOG.md`](IMPLEMENTATION_CHANGELOG.md); the live continuity
checkpoint is [`CURRENT_HANDOFF.md`](CURRENT_HANDOFF.md).

**Current implementation revision** — M0 in progress on `impl/m0` at
`6c625a31f43892f71581fac8cde5a02a4ec9f168`, with uncommitted M0-REVERIFY-3
solver and regression changes, M0-REVERIFY-4 evidence and record updates, and the M0-EVIDENCE-RECONCILE review ledger (documentation and evidence only).
The earlier committed source and evidence are at `e2e62030e49dc7b597fbc4f90981263f8943f2e5`.
See [CURRENT_HANDOFF.md](CURRENT_HANDOFF.md) for verification and limitations.
**Queue P2 (2026-11-07):** P2-0 baselines done (evidence only, no source change); see [QUEUE_STATE.json](QUEUE_STATE.json) and the [baseline README](../verification/drone-baseline-2026-11-07/README.md). Milestone rows below are unchanged by P2-0.
Plan baseline **v1.0** (2026-10-23), immutable.

## Milestone rollup

| Milestone | Scope | Status | Gate |
|---|---|---|---|
| Phase 0 | Workspace discovery + audited baseline committed | **done** | — |
| **M0** | Application and data correctness (VLM numerics + app correctness) | **in progress** | **G0 BLOCKED** |
| M1a | Core contracts (topology, hash, surfaces/bodies/components, spatial index, selection, import, schemas) | planned | G1a |
| M1b/M2/M3 | CFD platform build-out | deferred (needs owner input **Q-1**) | — |
| M4a | OpenFOAM pin, 2-D NACA 0012 case | planned (needs owner input **Q-4**); independent of M0 | — |
| M5–M7 | Solver, validation, reporting | planned | — |

## M0 progress (this milestone, detailed in [`milestones/M0.md`](milestones/M0.md))

| Track | Task | Status |
|---|---|---|
| M0a | M0-10 exact topology | **tested** (26/26 pass, `2c6ec84`) |
| M0a | M0-6, M0-7 planform by slicing | planned |
| M0a | M0-8 stability verdict gating | planned |
| M0a | M0-9 hash + restore validation | planned |
| M0a | M0-11..M0-14 staleness / degraded / labels | planned |
| M0a | M0-15, M0-16 hygiene + demo report | planned |
| M0b | M0-1 induced drag + Trefftz | **tested** (41/41 pass, `af416b4`) |
| M0b | M0-2 multi-row VLM | **tested** (54/54 pass, `d57783a`; lattice, guard, wake ≥ 10 b, R1/R2 badge, label) |
| M0b | REM-1 Sol review remediation (M0-3 entry prerequisites) | **tested** (71/71 pass; exact-flow badge, corruption quarantine, input validation, claim scoping — [`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)) |
| M0b | **M0-4** relative singularity cutoff (SOL-01 full fix, VLM-V5) | **tested** (73/73 pass; per-quantity relative cutoffs + rounding-robust auto-N; VLM-V5 1e-3..1e3 ≤ 2e-14 on C_L/C_Di/C_m/Γ — [`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)) |
| M0b | **SOL-06** drag significance / numerical cancellation policy (forward-error tolerance replaces the qS floor; raw preservation + explicit suppression) | **tested** (78/78 pass; qS/reference-area invariance, no dead band (C_Di(0.001°) = 2.64e-10), scale-consistent tolerance — [`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)) |
| M0b | **M0-3** sweep conversion verification + incidence/c-4 convention (review §7.2, VLM-V6 with incidence) | **tested** (85/85 pass; sweep conversion verified single, `sectionAt` unchanged; incidence now rotates about the local c/4 (DEC-M0-3-1), projected c/4 line = input ± 1.4e-14 at any incidence; zero-incidence byte-identical — [`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)) |
| M0b | **M0-5** linear-window guard + fit/trim contract (SOL-09, VLM-V7/V8) | **tested** (101/101 pass; §2.5 fit contract: ≥ 3 converged window points + 5 % adjacent-pair consistency + fitted intercept; trim reported only with C_L(α_trim) > 0 inside the sampled sweep or explicitly "not determined"; undetermined derivatives are null with status — no NaN, no "Unstable"; verdict rule set enforced at the solver source (DEC-M0-5-4); VLM-V8 seed placeholder = warning — [`SOL_FINDING_DISPOSITIONS.md`](SOL_FINDING_DISPOSITIONS.md)) |

## Validity of displayed numbers

Until M0 completes, several displayed values remain scientifically invalid (per
`../audits/DISCREPANCY_REGISTER.md`): recognised wing area (DR-03), pitch response
(DR-05), wing-alone stability verdict (DR-06). The VLM core's DR-01 sign/magnitude
defect was fixed in `af416b4` and the DR-02 resolution sensitivity is resolved by the
M0-2 multi-row lattice. The independent Sol review (2026-10-23,
`../verification/sol/REVIEW.md`) falsified broader claims and its conditions are now
binding: REM-1 quarantines numerically corrupted results (small scales — SOL-01,
elliptic M > 8 tip mode — SOL-03, near-field/Trefftz inconsistency beyond the approved
1 % gate) and makes the resolution badge report the exact plotted flow and
applicable lattice comparison. REM-3a withholds the fixed uncertainty claim pending
a reviewed envelope. M0-4 then corrected the small-scale corruption itself (relative singularity
cutoffs + rounding-robust auto-N prescription; VLM-V5 scale invariance ≤ 2e-14 across
1e-3..1e3), so small scales are no longer quarantined — pending independent
confirmation. Quarantined outputs are shown as **unavailable**. The remaining values are
**not** to be presented as validated, and **G0 stays BLOCKED pending independent Sol
re-verification** — apparent corrections recorded here do not close review findings.

### AUD-1 checkpoint — 2026-11-06
IA-01/IA-05 implementation in working tree: comparison point validity and complete structured identity, with display and snapshot propagation. Verification and outstanding limits are recorded in CURRENT_HANDOFF.md and docs/verification/aud-1-2026-11-06/. Independent re-verification is pending; G0 remains BLOCKED. IA-02, IA-03, IA-04, IA-06, IA-07 and IA-08 remain open.


AUD-2 / IA-02: export quarantine and versioned provenance JSON implemented/tested, pending independent re-verification. CSV consumers must migrate. SOL-07 remains open; G0 BLOCKED. See `../verification/aud-2-2026-11-06/README.md`.

### REM-3a checkpoint (2026-11-06)
IA-03 / SOL-05 / SOL-08: conservative all-case fixed-claim withholding and benchmark sidecar implemented and tested, pending independent re-verification; scientific envelope and contract claim remain open. The earlier zero-yaw-only scope statement is superseded. AUD-1 and AUD-2 also remain pending independent re-verification. G0 BLOCKED. See `../verification/rem-3a-2026-11-06/`.

**REM-3b partial, 2026-11-06:** Trefftz circulation type validation implemented/tested; IA-04 remains open beyond this boundary and IA-07 sweep/resource bounds remain unimplemented. Independent re-verification required; G0 BLOCKED. See `../verification/rem-3b-2026-11-06/README.md`.

**REM-3b continuation partial, 2026-11-06:** sweep progress/resource guards and strict Run inputs implemented, but API validation and acceptance coverage remain incomplete. IA-04/IA-07 open, G0 BLOCKED. See `../verification/rem-3b-cont-2026-11-06/README.md`.


REM-3b continuation (2026-11-06): endpoint count corrected and tested, but IA-04/IA-07 remain partial and open. Remaining API validation, operational-boundary and integration coverage require completion; see `docs/verification/rem-3b-review-2026-11-06/README.md` and current handoff. No independent re-verification; G0 remains BLOCKED.


**REM-3b validation continuation, 2026-11-06:** Partial geometry, lattice, case and resolution input checks and representable sweep progress added. IA-04/IA-07 remain open; comprehensive boundary tests and independent review remain. G0 BLOCKED. See `docs/verification/rem-3b-validation-2026-11-06/README.md` and current handoff.


### REM-3b continuation checkpoint (2026-11-06)

REM-3b remains partial. Negative cd0 and degenerate supplied panels now fail explicitly; these checks and existing work require compatibility review and independent re-verification. Targeted 13 individual tests passed; full and boundary verification remains incomplete. See `docs/verification/rem-3b-resume-2026-11-06/README.md`. IA-04 and IA-07 remain open; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.


### REM-3b audit checkpoint (2026-11-06)

Explicit malformed lattice options now fail rather than default; legacy numeric options remain. A fresh probe shows endpoint snapping may add a sample beyond the supplied end (1 − Number.EPSILON, step 1). This remains unfixed. IA-04/IA-07 remain open, pending completion and independent re-verification; G0 remains BLOCKED. See `docs/verification/rem-3b-audit-2026-11-06/README.md` and CURRENT_HANDOFF.md.


### REM-3b decimal continuation — 2026-11-06

REM-3b remains partial: exact shortest-decimal sweep construction replaces the four-epsilon snap. Focused regressions and operational-boundary tests are recorded in `../verification/rem-3b-decimal-2026-11-06/README.md`; full API audit and automated app boundary remain open. G0 BLOCKED.

### REM-3b challenge checkpoint — 2026-11-06

Partial and uncommitted. Independent decimal vectors and the real 2048-panel solve boundary passed; an extreme finite reference previously returned infinite moment as valid, now explicitly refused with a red-before-fix regression. Complete API/compatibility audit and reusable actual-app error boundary remain. Combined individual runner timeout remains unexplained. IA-04/IA-07 remain open; IA-06/08, SOL-07 display, proximity and elliptic science remain unresolved. AUD-1/AUD-2/REM-3a await independent re-verification. G0 BLOCKED. See `../verification/rem-3b-challenge-2026-11-06/README.md` and CURRENT_HANDOFF.md. Operational caps are not scientific acceptance.

REM-3b investigation remains partial: sweep offset overflow is now refused and regression tested. Full API/compatibility audit, reusable actual-app error boundary, combined-run timeout and independent verification remain outstanding. G0 remains BLOCKED.


### REM-3b follow-up checkpoint (2026-11-06)

The actual Run handler now has a reusable VM boundary regression covering real solver refusal and a simulated resolution-check failure; both clear stored results and set error status. This is limited coverage, not a DOM or full display test. No production behavior or scientific threshold changed. See `docs/verification/rem-3b-followup-2026-11-06/README.md`. REM-3b, IA-04/IA-07 and the broader app/API audit remain incomplete; prior AUD-1, AUD-2 and REM-3a await independent re-verification. G0 remains BLOCKED. No finding is closed.

## REM-3b deep continuation — 2026-11-06

Partial, uncommitted: generated nonfinite/degenerate panels are refused; a supplied-panel metadata inconsistency can change wake length and CL while reporting ok and remains unresolved. The combined individual-test runner timed out; no aggregate pass is claimed. See `docs/verification/rem-3b-deep-2026-11-06/README.md` and CURRENT_HANDOFF. IA-04/IA-07 remain open, prior AUD-1/AUD-2/REM-3a await independent re-verification; G0 remains BLOCKED. No scientific acceptance or finding closure is implied.

## REM-3b Sol checkpoint — 2026-11-06

IA-04/SOL-10 numeric input and REM-3b's ordinary geometry, sweep and Run corrections are implemented and targeted-tested, pending independent re-verification. IA-07 acceptance remains partial. A large x translation can shorten a noncollapsed rounded wake and quantize the chord. The corrected test-only matched-lift search allowed the prescribed single-process runner to pass 149 tests. See [REM-3b Sol evidence](../verification/rem-3b-sol-2026-11-06/README.md) and CURRENT_HANDOFF for actual results and the REM-3b-R task. AUD-1, AUD-2 and REM-3a await independent re-verification. G0 remains **BLOCKED**.

## REM-3b-R checkpoint — 2026-11-06

Translated wake and cumulative work corrections are implemented/tested, pending independent re-verification of IA-04/IA-07. The next bounded task is M0-REVERIFY-1, covering AUD-1, AUD-2, REM-3a and REM-3b. See [evidence](../verification/rem-3b-r-2026-11-06/README.md) and [the current handoff](CURRENT_HANDOFF.md). IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science remain open. G0 remains **BLOCKED**.


## M0-REVERIFY-1 — 2026-11-06

Independent entry checks corroborated the tested AUD-1, AUD-2, REM-3a and REM-3b-R paths, with two residual comparison counterexamples. Comparison identity now records the effective bounds-seed flag. Nonfinite two-point slopes invalidate the corresponding grid summaries. Both corrections are implemented/tested, pending independent review. Final verification passed 57 targeted individuals, 29 npm files and 158 individuals on the prescribed combined runner. [Evidence](../verification/m0-reverify-1-2026-11-06/README.md). M0-REVERIFY-2 is the next bounded task. IA-06, IA-08, remaining SOL-07 safeguards, proximity and elliptic science stay open. **G0 BLOCKED.**

## M0-REVERIFY-2 — 2026-11-06

Independently exercised the bounds-seed identity and true slope-overflow withholding at the solver, browser Run, project snapshot and result-download boundaries. The neighboring representable slope exposed an intermediate degree-conversion overflow. The direct-radian fallback is implemented and tested, pending independent review. Final targeted tests passed 58 individuals across 19 input files. npm passed 29 files, and the exact combined command passed 159 individuals across 29 input files in 207.75 s. The fixed uncertainty claim remains withheld. G0 remains **BLOCKED** and administrative dispositions stay open. See [M0-REVERIFY-2 evidence](../verification/m0-reverify-2-2026-11-06/README.md).

## M0-REVERIFY-3 — 2026-11-06

Independent review corroborated the inherited 0°/4° slope recovery, true overflow and asymmetric grid validity in the tested scope. A signed relative lift-slope delta could still overflow before normalization. Its correction is implemented and tested, pending independent review. The targeted suite passed 59 individuals across 19 files. npm passed 29 files. The exact combined runner passed 160 individuals across 29 input files in 211.78 s. M0-REVERIFY-4 is the next bounded task. Administrative dispositions stay open and **G0 remains BLOCKED**. [Evidence](../verification/m0-reverify-3-2026-11-06/README.md).

## M0-REVERIFY-4 — 2026-11-06

Independent review corroborated the inherited signed relative delta, coarse-denominator floor, aggregate withholding and ordinary comparison behavior on the tested inputs. Prescribed and custom browser Run and both downloads corroborated the real-flow controls. Targeted passed 59 individuals across 19 inputs, npm passed 29 files and the exact combined command passed 160 individuals across 29 inputs in 190.38 s. The review adds evidence and records without an executable change. Administrative dispositions stay open. **G0 BLOCKED.** Next is M0-EVIDENCE-RECONCILE. [Evidence](../verification/m0-reverify-4-2026-11-06/README.md).

## M0-EVIDENCE-RECONCILE — 2026-11-07

Documentation and evidence review of the comparison, export and fixed-claim work. No production or test change. The [review ledger](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md) records each condition's source, evidence class, observed outcome and remaining gap. SOL-02/IA-01 and IA-05 are corroborated for the tested inputs, with yaw at the browser boundary and identity completeness still open. IA-02 exports are corroborated for the tested paths, with the invalid-sweep browser export, restore → solve → export and source hashing open. SOL-08/IA-03 withholding is corroborated, and restoring any claim is an owner decision. The extreme-reference three-sample refusal is a recorded limit. Pending owner decisions: D1 fixed-claim policy, D2 JSON-only export, D3 extreme-reference refusal, D4 commit traceability. Exact verification in this phase: targeted 59 individuals, `npm test` 160 individuals and the exact combined runner 160 individuals, all exit 0. Administrative dispositions stay open and **G0 BLOCKED**. Method documents need no change because behaviour did not change.

## M0-EVIDENCE-GAP-CLOSE — 2026-11-07

Browser checks and identity coverage. Production unchanged. The β = 5° prescribed check and the valid restore → solve → export round trip match the API and the pre-save run exactly, in the user's Brave through Claude in Chrome. Identity coverage now has 32 passing tests, and every material resolution-check input changes the identity. Open: an invalid-sweep browser export (the UI cannot supply the AUD-2 tail), the IA-01 forward surface in the UI, and stale polar and pitch curves after a refused Run (M0-11). Known limit: explicit 8-strip canard incidence is refused by the Trefftz guard. The next bounded task is M0-6 and M0-7. Options: [NEXT_STEP_OPTIONS_2026-11-07.md](NEXT_STEP_OPTIONS_2026-11-07.md). Verification: targeted 59/59, `npm test` 192/192, exact combined 192/192, all exit 0. Administrative dispositions stay open and **G0 BLOCKED**. [Evidence](../verification/m0-evidence-gap-close-2026-11-07/README.md).
