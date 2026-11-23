# M0-EVIDENCE-RECONCILE review ledger (2026-11-07)

**Scope.** One ledger linking the contract and audit conditions for SOL-02 / IA-01 and IA-05, IA-02 export provenance, and SOL-08 / IA-03 fixed-claim withholding to executed evidence. This is a documentation and evidence review. It changes no production code or test, closes no finding, and does not clear G0. **G0 remains BLOCKED.**

**Revision reviewed.** Branch `impl/m0`, HEAD `6c625a31f43892f71581fac8cde5a02a4ec9f168` (a documentation follow-up to the tested source and evidence commit `e2e6203`). The working tree holds the uncommitted M0-REVERIFY-3 change to `src/vlmSolver.js` and `tests/aud1.test.mjs`, the M0-REVERIFY-3/4 records and evidence, and this phase's files. The index is empty. All 46 tested executables still match `tested-executables.sha256` (checked in this phase), so M0-REVERIFY-4's browser and replay evidence still describes the current solver.

## Evidence classes

Each condition below names the classes it relies on. Classes are kept separate, and a result in one class does not stand in for another.

| Class | What it is | Artifacts here |
|---|---|---|
| **E1** Rational arithmetic on represented inputs | Python `Fraction` oracle run on the solver's captured binary64 outputs. It imports no solver code. | `oracle-reproduced.json`, identical to `../m0-reverify-4-2026-11-06/oracle-entry.json` |
| **E2** Constructed API probes | Direct calls to exported solver functions, including the frozen and new probes and the test suite's solver assertions. | `ledger-probes-*.json`, `extreme-fit-refusal-probe.json`, `../aud-1-2026-11-06/`, `../aud-2-2026-11-06/`, `../rem-3a-2026-11-06/` |
| **E3** Real browser Run and downloads | Browser Run and both downloads in the in-app browser (M0-REVERIFY-4). This phase rechecked the retained files only. It did not rerun the browser. | `../m0-reverify-4-2026-11-06/browser-downloads.json`, `browser-downloads-recheck.json` |
| **E4** Ordinary benchmark and regression gates | `node --test` targeted, `npm test` and the exact combined runner, run in this phase. | `targeted.*`, `npm.*`, `combined.*` |
| **E5** Frozen replay | Scratch replay of frozen Sol, app and probe scripts. Not rerun here (see L9). | `../m0-reverify-4-2026-11-06/replay/`, `../m0-reverify-4-2026-11-06/replay-comparison.json` |

**Status vocabulary.** *Corroborated (tested inputs)* means the evidence for the tested inputs agrees, with no open acceptance element for those inputs. It says nothing about untested inputs. *Partial* means a named acceptance element is missing. *Owner decision* means acceptance depends on a policy or scientific choice the implementation cannot make. *Limit* means a recorded evidence boundary, which is not a pass.

## Summary

| ID | Condition (source) | Status | Missing acceptance element |
|---|---|---|---|
| L1 | SOL-02 / IA-01: a prescribed green badge must not certify quarantined data | Corroborated at the API and function boundaries; **partial** at the browser boundary | Browser Run of the IA-01 invalid fixture |
| L2 | SOL-02: the check certifies the plotted flow and lattice (yaw, custom lattice) | Corroborated for tested API and zero-yaw browser inputs; **partial** for yaw in the UI | Browser Run at β ≠ 0 |
| L3 | SOL-02 / IA-01 / IA-05 comparison arithmetic: signed relative-delta recovery, true overflow, per-grid reasons, 0°/4° protocol | Corroborated for tested inputs | Commit of the tested solver change (D4); extreme-reference plot boundary (L8) |
| L4 | IA-05: input identity covers all material inputs | **Partial** (collision defect fixed and tested) | Exhaustive field-coverage test; project and mesh identity (M0-9) |
| L5 | SOL-08 / IA-03: the fixed ±5 %/±8 % claim is withheld outside a reviewed envelope | Corroborated for withholding on tested inputs; **owner decision** on any restored claim | Envelope or permanent-withholding decision (D1); independent review of the SOL-05 sidecar |
| L6 | IA-02: quarantined sweeps are withheld in exports, with provenance | Corroborated for tested paths; **partial** | Browser export of an invalid sweep; restore → solve → export sequence; source hash (M0-9); CSV compatibility decision (D2) |
| L7 | Ordinary benchmark gates (VLM-V1/V1b/V2/V3, 1 %/5 %) | Corroborated for the existing gates | Not an uncertainty or external validation claim |
| L8 | Extreme-reference plotted sweep (three samples) | **Limit**, with an owner decision | Refusal policy for the plotted fit (D3) |
| L9 | Frozen replay and never-reached checks | Unchanged from M0-REVERIFY-4 | Not rerun; expected stops retained |

---

## L1 — SOL-02 / IA-01: prescribed badge must not certify quarantined data

- **Requirement.** `../sol/REVIEW.md` SOL-02 (lines 83–100). `../independent-2026-11-06/REPORT.md` IA-01 (lines 17–33): "Fix the prescribed-path validity gate and expose comparison validity before accepting SOL-02."
- **Source.** `src/vlmSolver.js:1304` (`runVlmResolutionCheck`), which carries the comparison validity and withholding. `src/app.js:385` (`resolutionBadgeText`) is the display consumer.
- **Evidence.**
  - E2, working tree: [`ledger-probes-working-tree.json`](ledger-probes-working-tree.json). For the IA-01 fixture (8 m wing with a coplanar forward surface at x = −4 m, V = 40 m/s, S = 8 m², c = 1 m, reference (0.4, 0, 0)), the badge is **amber**, the claim is **withheld**, both deltas are **null**, and both R1 and R2 are invalid.
  - E2, pre-remediation control: [`ledger-probes-pre-remediation-control.json`](ledger-probes-pre-remediation-control.json), run on `git show 9a66316:src/vlmSolver.js`, the audited commit. The badge is **green** and claim "prescribed R1 vs R2", with ΔC_Lα = 0.002815183047210505 and ΔC_Di = 0.009969859818699689. These reproduce the audit's 0.2815 % and 0.9970 %.
  - E2, tests: `tests/aud1.test.mjs` case 1 asserts amber, withheld, null delta, the "alpha 0" reason and the rendered "withheld" text through the unchanged `resolutionBadgeText` body from `src/app.js`. It passed in the targeted run (E4).
- **Observed outcome.** Withheld, with the reason "coarse sweep is quarantined or missing; coarse alpha 0 case is invalid or nonfinite; fine sweep is quarantined or missing; fine alpha 0 case is invalid or nonfinite". The green state and the 0.2815 % value are gone.
- **Remaining acceptance gap.**
  - The UI check runs the unchanged app function body. It is not a browser Run. The AUD-1 record says the same.
  - The validity gate is a logic condition. No rational oracle applies to it.
- **Status.** Corroborated at the API and function boundaries. **Partial** at the browser boundary.

## L2 — SOL-02: the check certifies the plotted flow and lattice

- **Requirement.** `../sol/REVIEW.md` SOL-02 acceptance: exact plotted flow in the check, complete identity and coverage, custom lattices compared with a refined lattice, and β ≠ 0 coverage. `../../implementation/SOL_FINDING_DISPOSITIONS.md` SOL-02 acceptance criteria.
- **Source.** `src/app.js:338` puts `betaDeg: params.flowYawDeg` into `sweepInputs`. `runVlmAnalysis` (`src/vlmSolver.js:1312`) then runs the check on the same options (`:1318`), so the badge certifies the plotted flow. `runVlmResolutionCheck` (`:1304`) is the standalone entry. Identity is at `:1366`, and the custom comparison is `compareLatticeWithRefined` (`:1496`).
- **Evidence.**
  - E2, working tree, [`ledger-probes-working-tree.json`](ledger-probes-working-tree.json), SOL-02 fixture (8 m wing, V = 40 m/s, S = 8 m², referencePoint (0.25, 0, 0)):
    - β = 0 gives green, claim "prescribed R1 vs R2", ΔC_Lα = 0.002604545932077925 (0.2605 %) and ΔC_Di = 0.010512702176665865 (1.0513 %). The identity records β = 0.
    - β = 5° gives identity β = 5, **amber**, ΔC_Lα = 0.01752425309329866 (1.7524 %) and ΔC_Di = 0.05170673842746727 (5.1707 %). This matches the SOL-02 table.
    - A custom 1×4 lattice gives claim "current lattice vs 2x refined lattice", **amber**, current-grid ΔC_Lα = 0.03688596741236277 and ΔC_Di = 0.04144796263611684. R1/R2 agreement is not used as convergence evidence.
  - E2, pre-remediation control (`9a66316`) gives identical numbers for these fixtures. The β-forwarding defect is therefore historical (REM-1, `84cf90f`) and was not reproduced here.
  - E1, M0-REVERIFY-4 oracle, five real-flow states: prescribed and custom deltas match ([`../m0-reverify-4-2026-11-06/oracle-entry.json`](../m0-reverify-4-2026-11-06/oracle-entry.json)).
  - E3, browser, zero yaw: the custom 3×12 / refined 6×24 comparison at S = 3e-307 m² shows amber with coverage. Its currentGrid ΔC_Lα = 0.01727881816338002 and ΔC_Di = 0.006221550604309943 equal the oracle's custom flow rows to printed precision ([`browser-downloads-recheck.json`](browser-downloads-recheck.json) against `oracle-entry.json`, checked this phase).
  - E4: `tests/solFindings.test.mjs` SOL-02 tests passed in the targeted and combined runs.
- **Observed outcome.** The check identity follows the plotted flow. Yawed and custom comparisons are amber when a gate fails. A custom convergence claim is never granted by R1/R2 agreement. The earlier 0 °-only certification is not reproduced.
- **Remaining acceptance gap.**
  - All browser evidence is at zero yaw, so β ≠ 0 coverage at the UI boundary is missing.
  - The yaw result is shown at the API boundary only.
- **Status.** Corroborated for the tested API and zero-yaw browser inputs. **Partial** for yaw at the browser boundary.

## L3 — Comparison arithmetic: signed relative-delta recovery, true overflow, per-grid reasons

- **Requirement.** `../../implementation/milestones/M0.md` M0-REVERIFY-3 and 4 entries. The 0°/4° protocol and the 1 %/5 % gates stay unchanged.
- **Source.** `src/vlmSolver.js:1449` (`resolutionDeltas`). The signed-subtraction correction is the uncommitted working-tree change. `git diff -- src/vlmSolver.js` shows it, and the HEAD control in L3 is the committed `6c625a3` solver.
- **Evidence.**
  - E1, [`oracle-reproduced.json`](oracle-reproduced.json). It is byte-identical to the retained `../m0-reverify-4-2026-11-06/oracle-entry.json` (`cmp` reports no difference). Eleven constructed comparisons and five real-flow states pass. Maximum errors are 6.67e-17 for slopes (tolerance 1e-14 relative), 2.44e-16 for ordinary deltas (1e-15 absolute), and 1.19e-16 for the huge finite delta (1e-14 relative).
  - E2, [`../m0-reverify-4-2026-11-06/head-control-comparison.json`](../m0-reverify-4-2026-11-06/head-control-comparison.json) (M0-REVERIFY-4). Only the two signed-overflow rows differ between the working tree and HEAD. Not rerun in this phase.
  - E2, [`ledger-probes-head-control.json`](ledger-probes-head-control.json). Run on `git show HEAD:src/vlmSolver.js`. It equals the working tree on the L1, L2, L4 and L5 fixtures, which is expected because the working-tree change touches only the signed-overflow path.
  - E3, browser: prescribed R1/R2 at S = 3e-307 m² gives green, 0.2605 % and 1.0513 %. The download hashes equal the M0-REVERIFY-4 record (eight files, checked this phase), and `check-browser.mjs` passes ([`browser-downloads-recheck.json`](browser-downloads-recheck.json), exit 0).
  - E4: targeted 59/59 (19 files), `npm test` 160/160 (29 files), combined 160/160 (29 files), all exit 0 with zero skips.
- **Observed outcome.** Finite recovery gives 1.3333333333333333 and 4. A true aggregate overflow nulls both metrics while both grids stay valid. A nonfinite fine slope nulls the metrics, with the coarse grid valid and the fine grid invalid.
- **Remaining acceptance gap.**
  - The oracle works on represented binary64 inputs and establishes no general rounding behaviour or aircraft accuracy.
  - The signed-overflow inputs are constructed API inputs. No real flow state reaches opposite-signed overflow.
  - The tested solver change is uncommitted (D4).
- **Status.** Corroborated for the tested inputs. Commit pending (D4).

## L4 — IA-05: input identity covers all material inputs

- **Requirement.** `../independent-2026-11-06/REPORT.md` IA-05 (lines 72–80): include geometry placement, wake length and all material inputs in identities.
- **Source.** `src/vlmSolver.js:1366` (`inputIdentity`). `normalizeSurfaces` at `:1788` records name, planform, span, root and tip chord, sweep, dihedral, incidence, and root x and z. The wake is `wake.lengthFactor` and `wake.lengthM`. `seedReferencePlaceholder` is recorded explicitly.
- **Evidence.**
  - E2, working tree, [`ledger-probes-working-tree.json`](ledger-probes-working-tree.json), `ia05`: moving the canard (x −4 → 4, z 0 → 0.6) changes the identity. A wake factor of 200 changes it. The base wake length is 80 m. An omitted seed flag equals `false`, and `true` differs and records the placeholder.
  - E2, pre-remediation control (`9a66316`): the moved canard gives an **identical** identity (the collision reproduces), wake length is not recorded, and seed `true` equals `false`. These are the audited defects, now corrected.
  - E2, `tests/aud1.test.mjs` case 2 passed in the targeted run.
  - E3, exported JSON: `resolutionCheck.inputIdentity` in the downloads records surface placement (x 17 m, z 5.604 m) and the seed flag.
- **Observed outcome.** The collision and seed-flag defects are fixed for the tested fields.
- **Remaining acceptance gap.**
  - No test enumerates every solver option against the identity, so completeness is argued from the code and the probes, not proven.
  - The identity belongs to one comparison check. It is not a project or mesh identity. `sourceName` is `samolot.stl`, a name, not a hash (DEC-03, DR-07; scheduled for M0-9).
- **Status.** **Partial.** The collision defect is corroborated for tested fields. Exhaustive coverage and project identity remain open.

## L5 — SOL-08 / IA-03: the fixed ±5 %/±8 % claim is withheld

- **Requirement.** `../independent-2026-11-06/REPORT.md` IA-03 (lines 47–61). `../sol/REVIEW.md` SOL-08 (line 185). `../../implementation/SOL_FINDING_DISPOSITIONS.md` SOL-08: the approved label is kept only for in-envelope results, and a changed claim needs contract review.
- **Source.** `src/vlmSolver.js:72` (`UNCERTAINTY_LABEL`, retained as provenance and never returned). `:76–79` (`UNCERTAINTY_SCOPE`). `:80–81` (`UNCERTAINTY_UNVERIFIED_LABEL`). The unverified label is returned at `:1031`, `:1258` and `:1441`. `src/app.js:820–822` still compares against the legacy label, so that branch is unreachable. `src/projectState.js:66` and `src/app.js:963` persist the withheld values.
- **Evidence.**
  - E2, working tree, [`ledger-probes-working-tree.json`](ledger-probes-working-tree.json), `ia03`: the four frozen fixtures (1×4 lattice, 12×48 lattice, α = 35°, AR = 1) all return the unverified label. CL values match the frozen values to ≤ 1.1e-16 absolute. The 12×48 case gives 0.32780813008741133 against 0.32780813008741144, a rounding-level difference from the REM-3b-R frame change. No tolerance is used for this label.
  - E2, pre-remediation control (`9a66316`): all four fixtures return the legacy ±5 %/±8 % label, as does the zero-yaw comparison. The audit defect reproduces.
  - E2, `tests/rem3a.test.mjs`: the display test runs the real renderer and asserts the withheld wording.
  - E3, browser: `check-browser.mjs` asserts the unverified label on all four result files. The check passed this phase.
  - E4: VLM-V3 1 %/5 % and the other gates are unchanged.
- **Observed outcome.** No output in any tested state carries the ±5 %/±8 % claim.
- **Remaining acceptance gap.**
  - **D1, owner decision:** no envelope is defined, so no result can meet the "in-envelope" condition. Keep permanent withholding, or define a reviewed geometry, resolution, α, yaw and flow envelope before restoring any claim. The IA-03 finding says zero yaw alone is insufficient.
  - The SOL-05 benchmark sidecar (`../rem-3a-2026-11-06/BENCHMARK_SIDECAR.md`) awaits independent review.
- **Status.** Corroborated for withholding on tested inputs. **Owner decision** for any restored claim.

## L6 — IA-02: quarantined sweeps are withheld in exports, with provenance

- **Requirement.** `../sol/REVIEW.md` line 329 (every plot or export needs reference values, method, domain, source and validity). `../independent-2026-11-06/REPORT.md` IA-02 (lines 34–46). DATA_CONTRACTS §2.7 validity records.
- **Source.** `src/app.js:938–969` (`exportResults`, JSON only, schema `airflow.vlm-results` version 1). `src/app.js:933–936` (`exportProject`). `src/app.js:1067` (`downloadBlob`). The CSV writer that AUD-2 replaced no longer exists. A search of `src/app.js` finds no CSV path.
- **Evidence.**
  - E3, browser, M0-REVERIFY-4: eight download files in `/home/tanvir/Downloads` (four project, four result). Their hashes equal the M0-REVERIFY-4 record (checked this phase). Each result has `provenance` (inputs, `referenceSource` "bounds", `seedReferencePlaceholder` true, `sourceName` "samolot.stl", `massSource` "assumedUniform"), `validity` (warning, with the VLM-V8 placeholder message and insufficient-linear-data notes), `resolutionCheck` (coverage, comparison validity, withholding), `uncertaintyLabel`, `uncertaintyScope` and `limitations`.
  - E2, [`../aud-2-2026-11-06/app-post.json`](../aud-2-2026-11-06/app-post.json) (frozen probe, function boundary). The invalid sweep that previously exported CL = 0.9448874856350236 as a CSV row now exports JSON with `availability: "withheld"` and null `cl`, `cdi`, `cm` and loads. The validity record is kept, and the literal value does not appear in the export. Checked this phase. The probe's `method` and `provenance` are null because it fabricates a minimal result.
  - E2, `tests/aud2.test.mjs` (three cases) passed in the targeted run.
  - E1: the comparison values in the downloads equal the oracle's real-flow values (L2, L3).
- **Observed outcome.** Invalid sweep values are withheld. Valid exports carry method, provenance, coverage and validity. No CSV is produced.
- **Remaining acceptance gap.**
  - The invalid-sweep export has not been exercised in a browser. The AUD-2 probe is function-level.
  - The restore → solve → export sequence is untested (AUD-2 README).
  - Source identity is a name, not a hash (M0-9).
  - **D2, owner decision:** the CSV removal is a breaking change. AUD-2 says consumers must migrate.
- **Status.** **Partial.** Tested paths are corroborated.

## L7 — Ordinary benchmark gates

- **Evidence.** E4. This phase's targeted (59/59, 22.27 s), `npm test` (160/160, 26.00 s) and combined (160/160, 208.69 s) runs all exited 0 with zero skips. VLM-V2 matched-lift took 43.23 s in the combined run. Earlier runs took 39.46 s, 42.09 s and 41.87 s, so this is ordinary variation. No timeout occurred and no workaround was used. VLM-V1/V1b/V2/V3 gates were not edited.
- **Scope.** These are benchmark gates against approximate references. They are not uncertainty bands, and they are not external validation (SOL-08).
- **Status.** Corroborated for the existing gates.

## L8 — Extreme-reference plotted sweep: refusal (limit)

- **Source.** `src/vlmSolver.js:1171` (`solveSweep` throws "Nonfinite sweep fit or stability output produced by VLM inputs."), reached from `runVlmAnalysis` at `:1312`.
- **Minimal reproduction.** [`extreme-fit-refusal-probe.mjs`](extreme-fit-refusal-probe.mjs), output [`extreme-fit-refusal-probe.json`](extreme-fit-refusal-probe.json). At S = 3e-307 m² and at S = 2e-307 m², the three-sample sweep (0/2/4°) **throws**. The two-sample sweep (0/4°) returns with the fit null. The comparison returns, green at 3e-307 and amber-withheld at 2e-307. The first probe in M0-REVERIFY-4 (`../m0-reverify-4-2026-11-06/api-initial.err`) shows the same throw.
- **Observed outcome.** The default plotted sweep fails as a whole at these references, and the comparison is not reached through that path. No numerical value is shown, so this is not a value leak. It is a completeness limit.
- **Status.** **Limit** recorded. **D3, owner decision** on whether the fit should refuse the run or withhold the sweep and keep the comparison. Option (b) would need a red-first regression and explicit authorization.

## L9 — Frozen replay and never-reached checks

- **Not rerun in this phase.** The phase changed no executable, and the 46 tested executables match their hashes. The M0-REVERIFY-4 replay therefore stands. Its 12 stdout streams were byte-identical to M0-REVERIFY-3, all 50 Sol rows and the independent measurement groups matched, and the expected stops held.
- **Expected stops (retained).** Sol stops at the NaN-circulation refusal after 50 rows. The app VM stops at its stale `clearVlmResult` helper. The hang probe refuses the non-advancing sweep. The panel probe refuses forged ordered endpoints.
- **Never reached.** Sol zero-net-lift and final JSON/PSD writes. The app redraw and final JSON checks. Archived multirow and elliptic extractors. The rational sweep-grid oracle and the independent translation reconstruction, which are outside that replay.
- **Status.** Unchanged evidence.

---

## Owner decisions (not made by this phase)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | SOL-08 / IA-03 fixed claim | (a) Keep permanent withholding and retire the ±5 %/±8 % label by a reviewed contract revision. (b) Define a reviewed envelope and an independent audit before restoring any in-envelope claim. | (a) for now. Choose (b) only if a product claim is wanted. This blocker has recurred since REM-1 (see Sol-audit guidance). |
| **D2** | IA-02 export format | (a) Accept JSON-only `airflow.vlm-results` v1. (b) Restore a CSV that carries withheld values and provenance columns. | (a), with the schema documented in the method docs. |
| **D3** | Extreme-reference plotted sweep | (a) Keep the whole-run refusal. (b) Convert the nonfinite fit into per-sweep withholding, so the comparison and valid series still display. | (b) under the quarantine rule, with a red-first regression. Not authorized here. |
| **D4** | Traceability and commit | Commit the tested M0-REVERIFY-3 solver and test change, with or without this phase's records, in one or several commits. | Owner's call. No commit or push has been made. |

**Authorization requested for the smallest gap-closure follow-up (no code change expected):** one in-app browser session on a local development host (`npm start`; M0-REVERIFY-4 needed `PORT=4175` after an EPERM bind on the default port). It would run the L1 IA-01 fixture and a β = 5° Run, export the invalid-sweep result, and perform a restore → solve → export sequence. Each step would be checked against the downloaded files. No sign-in is involved.

## Checks not reached or not performed

- No real browser Run in this phase. E3 is the M0-REVERIFY-4 Run plus this phase's file recheck.
- No browser Run at β ≠ 0 and none on the IA-01 invalid fixture.
- No browser export of an invalid sweep. No restore → solve → export test.
- No exhaustive identity-field enumeration.
- No frozen replay rerun (L9).
- This phase adds no independent review. The only review of the M0-REVERIFY-3 change is M0-REVERIFY-4.

## Recurring blockers

- **SOL-08 envelope (D1)** has appeared in REM-1, REM-3a, REM-3b and M0-REVERIFY-1 through -4 as an open condition. The protocol's Sol-audit guidance applies. The concrete question for an independent GPT-6.1 Sol audit is: *"Is there any region of geometry, resolution, α window, yaw and flow scale in which the demonstrated comparisons support the approved ±5 %/±8 % label under the contract? If none exists, should the label be retired by contract revision rather than withheld pending an envelope?"* The user selects the model in the host. This ledger does not claim a model change.
- **Combined runner timeout** (REM-3b) did not recur. The exact combined runner completed in M0-REVERIFY-1 through -4 (190–212 s each) and in this phase (208.69 s, exit 0). No profiling or workaround was needed in this phase.

## Reproduction (from the repository root)

```bash
EV=docs/verification/m0-evidence-reconcile-2026-11-07
bash $EV/run-verification.sh                       # targeted, npm test, exact combined runner
python3 -I docs/verification/m0-reverify-4-2026-11-06/oracle.py docs/verification/m0-reverify-4-2026-11-06/api-entry.jsonl.gz > $EV/oracle-reproduced.json
node docs/verification/m0-reverify-4-2026-11-06/check-browser.mjs /home/tanvir/Downloads > $EV/browser-downloads-recheck.json
node $EV/ledger-probes.mjs > $EV/ledger-probes-working-tree.json
node $EV/extreme-fit-refusal-probe.mjs > $EV/extreme-fit-refusal-probe.json
```

Controls (solver copies in a scratch directory, not the repository):

```bash
SCR=<your scratch directory>
mkdir -p "$SCR/head-src" "$SCR/pre-src"
git show HEAD:src/vlmSolver.js  > "$SCR/head-src/vlmSolver.js"
git show 9a66316:src/vlmSolver.js > "$SCR/pre-src/vlmSolver.js"
node $EV/ledger-probes.mjs "$SCR/head-src/vlmSolver.js" > $EV/ledger-probes-head-control.json
node $EV/ledger-probes.mjs "$SCR/pre-src/vlmSolver.js"  > $EV/ledger-probes-pre-remediation-control.json
```

Exact outputs, exit codes and timings are in [README.md](README.md).

---

## Gap-closure addendum (2026-11-07)

Full record: [gap-close README](../m0-evidence-gap-close-2026-11-07/README.md) and [browser-results.json](../m0-evidence-gap-close-2026-11-07/browser-results.json). No production code changed. No status below closes a finding or clears G0.

| ID | Earlier status | Now | What changed |
|---|---|---|---|
| L1 | Partial at browser boundary | **Partial** | The IA-01 invalid fixture still cannot be entered in the UI (no forward-surface control). The fixture stays API and function-level. |
| L2 | Partial for yaw in UI | **Corroborated for the β = 5° prescribed check** | Claude in Chrome in the user's Brave gave ΔC_Lα 0.01752425309329866 and ΔC_Di 0.05170673842746727, equal to the API probe at all printed digits. The custom-lattice browser comparison remains as before. |
| L4 | Partial | **Partial, improved** | 32 identity tests now cover every material flow, reference, seed, lattice, wing and canard input. All change the identity. Known limit: explicit 8-strip canard incidence is refused by the Trefftz guard. |
| L6 | Partial | **Partial, improved** | Restore → solve → export is corroborated on the valid fixture (exact provenance, series, validity and uncertainty label; identical deltas). Still open: an invalid-sweep browser export, and the stale-curve behaviour after a refused Run, which is SOL-07 item 3 (M0-11). |
| L5 | Owner decision | Unchanged | No browser evidence bears on the envelope policy. |
| L8 | Limit | Unchanged | Not reproduced in this phase. |

New observations, recorded and not fixed:
- A refused Run clears the badges, diagnostics and export, but the polar and pitch canvases keep their last curves. This is SOL-07 item 3 and M0-11 in the phased plan.
- The built-in browser pane has no WebGL, and the app does not start there. This matches M0-12, degraded mode.
- The solver's Trefftz guard refuses small canard incidence on an explicit 8-strip lattice. This is a solver finding for independent review.
