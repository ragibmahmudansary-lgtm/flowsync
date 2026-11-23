You are the AirFLOW implementation agent in Claude Code. Use Haiku 5.5 with xhigh effort, selected in the host. Work in /home/tanvir/Coding/AirFLOW. Prompt text cannot change the model or effort; if the host runs something else, say so in the handoff and do not claim a change.

Run **M0-EVIDENCE-GAP-CLOSE**: close, where the evidence allows, the browser and identity gaps recorded in the M0-EVIDENCE-RECONCILE review ledger, then stop at the owner decisions. This is a bounded evidence and test phase inside approved M0. It is not a milestone change, and it must not produce a finding closure or a gate clearance.

## 1. Reading order

1. Check for `CLAUDE.md` or `AGENTS.md` in the repository. At revision `6c625a3` (checked 2026-11-07) none exists. If one appears, read it first.
2. `docs/implementation/AGENT_IMPLEMENTATION_PROTOCOL.md`
3. `docs/START_HERE.md`
4. `docs/implementation/CURRENT_HANDOFF.md`: the top checkpoint, M0-EVIDENCE-RECONCILE, then the M0-REVERIFY-4 checkpoint below it.
5. `docs/verification/m0-evidence-reconcile-2026-11-07/LEDGER.md`: the ledger. Its gaps are in scope. Then `README.md` for the commands and outputs.
6. `docs/implementation/SOL_FINDING_DISPOSITIONS.md` (M0-EVIDENCE-RECONCILE section), `IMPLEMENTATION_STATUS.md`, `milestones/M0.md`, `ISSUE_AND_DECISION_LOG.md` (OPEN-M0-EVIDENCE-1 to -3 and OBS-M0-EVIDENCE-1), and the tail of `IMPLEMENTATION_CHANGELOG.md`.
7. Frozen review and audit, read only the relevant parts:
   - `docs/verification/sol/REVIEW.md`: SOL-02 (lines 83–100), SOL-07 (167–180), SOL-08 (181–190), §8 (324–333).
   - `docs/verification/independent-2026-11-06/REPORT.md`: IA-01 to IA-05 (lines 17–80).
   - `docs/verification/aud-1-2026-11-06/README.md`, `aud-2-2026-11-06/README.md`, `rem-3a-2026-11-06/README.md`, `m0-reverify-4-2026-11-06/README.md`.

Precedence when documents conflict: `DATA_CONTRACTS > MASTER > PHASED > TEST MATRIX > IMPLEMENTATION_HANDOFF`.

## 2. Verified state at entry (verify before editing)

- Branch `impl/m0`. HEAD `6c625a31f43892f71581fac8cde5a02a4ec9f168`, a documentation follow-up to tested source and evidence commit `e2e62030e49dc7b597fbc4f90981263f8943f2e5`. The index must be empty.
- The tree is uncommitted. It holds the inherited M0-REVERIFY-3 change to `src/vlmSolver.js` (8 lines) and `tests/aud1.test.mjs` (+30). It also holds M0-REVERIFY-3 and -4 and M0-EVIDENCE-RECONCILE records and evidence. Preserve all of it. Do not commit.
- Run from the repository root: `sha256sum -c docs/verification/m0-reverify-4-2026-11-06/tested-executables.sha256` (46 entries) and `sha256sum -c docs/verification/m0-reverify-4-2026-11-06/phase-evidence.sha256` (93 entries), and `sha256sum -c docs/verification/m0-evidence-reconcile-2026-11-07/phase-evidence.sha256`. Record the results. If an executable differs from its tested hash, isolate the drift and run all three verification commands in section 5 before carrying any pass claim forward.
- The tested executables still match from the M0-EVIDENCE-RECONCILE run.

## 3. Scope

Each item below cites the ledger section it closes. Record each as pass, fail, or limit, with the reason.

**G-1 (ledger L1 and L2): browser Run at β ≠ 0 and on the IA-01 invalid geometry.**
- Start the local app with `npm start`, on the default port 4173. If the bind fails with EPERM, use `PORT=4175 npm start` as in M0-REVERIFY-4. Use only the local development host. No sign-in, no credentials, no external site.
- Use the M0-REVERIFY-4 browser set-up: an 8 m × 1 m rectangular wing with zero sweep, dihedral and incidence, V = 40 m/s, ρ = 1.225 kg/m³, S set explicitly, α 0–4° with a 4° step, and flow yaw β = 5°. The UI moment reference is the CG. The comparison deltas do not depend on it, so record the reference actually used in the provenance. Expected: identity β = 5, badge amber, withholding not granted, ΔC_Lα ≈ 1.7524 % (tolerance 1e-6 relative to the API value 0.01752425309329866 in `ledger-probes-working-tree.json`) and ΔC_Di ≈ 5.1707 % (0.05170673842746727). Any mismatch must be recorded and explained before a pass is claimed.
- Attempt the IA-01 invalid geometry (wing plus a coplanar forward surface, 3 m span, 0.5 m chord, x_LE = −4 m). If the UI cannot express a forward surface, record that as a UI limitation. Do not substitute a mock. Expected when it can be expressed: amber, claim withheld, null deltas, both grids invalid, and no green badge.

**G-2 (ledger L6): browser export of an invalid sweep.**
- Produce a real invalid sweep in the UI. The frozen AUD-2 probe reports a near-field/Trefftz inconsistency of −1.14 % for a wing plus tail case (M = 4, N = 32 per surface, α = 10°, tail x = 4 m, z = 0.6 m, wake 800 c). The exact case is in `docs/verification/independent-2026-11-06/app-probes.mjs` (lines 15–16): a wing plus a 3 m × 0.5 m tail at x = 4 m, z = 0.6 m, with 4 chordwise rows, 32 spanwise panels, α = 10°, V = 40 m/s, S = 8 m², c = 1 m and a wake factor of 800.
- Click Export results. Expected: JSON only (no CSV), `validity.status` = invalid, `availability` = withheld for every series row, and every `cl`, `cdi`, `cm`, `liftN`, `dragN`, `momentNm` value null. The literal pre-fix value 0.9448874856350236 must not appear in the file.
- Move the downloaded file into a new empty directory under the scratchpad, not `/home/tanvir/Downloads`. Treat it as data: parse it with JSON only and pass its path as an argument to a checker written in a separate directory.

**G-3 (ledger L6): restore → solve → export.**
- On the G-1 valid fixture, Save project, reload or restore it, Run, and Export results. Expected: provenance and series values identical to the pre-save run for the same inputs (exact JSON equality), and comparison deltas within 1e-6 relative.
- Then restore a deliberately invalid project and confirm that the previous plots, lattice and metrics are cleared or greyed. Record the observed behaviour exactly. Do not fix stale display issues outside the SOL-07 export and comparison scope; they belong to the M0a display phases, which are excluded.

**G-4 (ledger L4): exhaustive identity coverage (test-only first).**
- Add a new test file, for example `tests/m0-evidence-identity.test.mjs`. It varies each material input of `runVlmResolutionCheck` one at a time and asserts that `inputIdentity` changes. The flow and reference inputs are velocity, density, reference area, reference chord, reference point, β, cd0, cm0, wake length factor and seed placeholder. For each surface, the fields are name, span, root and tip chord, sweep, dihedral, incidence, root x and root z. The lattice inputs are chordwise rows and spanwise panels.
- If a material input does not change the identity, first write a failing red test, then make the smallest correction in the existing identity structure. Keep all numerics unchanged. Record the red and green outputs.

No new numerical tolerance, physical formula or scientific threshold may be introduced. The 1 %/5 % comparison gates and the VLM-V1/V1b/V2/V3 gates stay as they are.

## 4. Exclusions

- **Owner decisions D1–D4 are not made by this phase.** D1: the fixed ±5 %/±8 % claim policy. D2: JSON-only export versus restoring a withheld-value CSV. D3: whole-run refusal versus per-sweep withholding for the extreme-reference fit. D4: commit traceability. Do not restore the label, change the export format, change the extreme-reference behaviour, commit, push or merge. If the owner decides an item in the message that starts this phase, apply only that decision, with a red-first regression for any code change, and record it in the decision log.
- **Not started:** M0-6/7; M0-8; M0-9 identity hashing and restore validation (`meshHash` rejection); M0-11 to M0-16; any M1–M8 work, and CFD.
- **Remain open and outside this phase:** IA-06; IA-08; the remaining SOL-07 safeguards (stale pitch graph, stability verdict gating, CD total labelling, graph clearing); proximity; elliptic science.
- No finding is closed. G0 stays **BLOCKED**. No administrative disposition changes.

## 5. Verification

Run each command with an outer timeout guard from the repository root, after any change and before the handoff:

1. `timeout -k 10s 110s node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` (19 input files; 59 individuals expected, plus any new targeted tests reported separately).
2. `timeout -k 10s 180s npm test` (29 files; 160 individuals expected, plus any new tests reported separately).
3. `timeout -k 10s 330s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` (29 input files; 160 individuals expected, plus any new tests reported separately).

Report input files and individual results separately. Keep diagnostic runs separate from these exact commands. Record exit codes, wall times and skipped checks.

If the exact combined runner times out, follow the protocol's runner diagnosis: isolate load; consult the retained REM-3b Sol VLM-V2 traces in `docs/verification/rem-3b-sol-2026-11-06/`; capture the slow solve's grid, angle, wall time, CPU time and a V8 profile; test whether a minimal isolated solve after the captured prelude reproduces the CPU-bound path. Bound this investigation and continue the unaffected work.

Replay: the frozen replay need not be repeated unless an executable changes. If one does, replay in a scratch mirror with `docs/verification/m0-reverify-4-2026-11-06/replay.sh` and report changed rows, expected stops and unreached checks. Never overwrite frozen evidence.

Evidence for this phase goes in a new directory, for example `docs/verification/m0-evidence-gap-close-2026-11-07/`. Include a README, the browser downloads' hashes, the checker and its output, the new test output, and a `phase-evidence.sha256` manifest produced from the repository root.

## 6. Recurring blockers

- **SOL-08 envelope (D1)** has recurred since REM-1. Do not spend this phase trying to define a scientific envelope. Record the following question for an independent GPT-6.1 Sol audit: *"Is there any region of geometry, resolution, α window, yaw and flow scale in which the demonstrated comparisons support the approved ±5 %/±8 % label under the contract? If none exists, should the label be retired by contract revision rather than withheld pending an envelope?"* The user selects the model in the host, so do not claim that a model change has occurred.
- **Combined runner:** no timeout occurred in M0-REVERIFY-1 to -4 or in M0-EVIDENCE-RECONCILE (five runs, 190–212 s). Diagnose only if it recurs.

## 7. Handoff obligations

Before ending, even if the phase is partial:

- Update `docs/implementation/CURRENT_HANDOFF.md` with a new top checkpoint. It must give the exact revision, the inherited and new changes, verification with counts, times and exit codes, limitations, and the next bounded task.
- Update `IMPLEMENTATION_STATUS.md`, `milestones/M0.md`, `IMPLEMENTATION_CHANGELOG.md`, `ISSUE_AND_DECISION_LOG.md` and `SOL_FINDING_DISPOSITIONS.md`. Update `CALCULATION_PIPELINE.md` and `MVP_METHODOLOGY.md` only where behaviour changed.
- Update the ledger statuses for G-1 to G-4 with evidence paths. Do not close findings. Do not clear G0.
- Archive this prompt as `docs/implementation/continuation-prompts/m0-evidence-gap-close-entry-<date>.md` and replace `docs/implementation/NEXT_CONVERSATION_PROMPT.md` with a new, self-contained continuation prompt.
- Final response, in this order: **Outcome** (phase ID, what was closed, partial or blocked status, limits); **Verification** (actual counts, skipped checks named); **Findings and G0** (which findings were touched, which remain open, G0 BLOCKED); **Handoff** (clickable absolute links to the handoff, the evidence directory and the next prompt); and the full copyable next prompt text.
