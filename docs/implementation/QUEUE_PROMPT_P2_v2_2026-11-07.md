# AirFLOW M0 implementation queue P2 — prompt v2 (2026-11-07)

Paste everything below the line `--- PROMPT START ---` into a fresh Claude Code session started in `/home/tanvir/Coding/AirFLOW`. The launch notes above the line are for you and are not part of the prompt.

## Launch notes (not part of the prompt)

- **Model and effort.** `/model` Sonnet 5.5. Anthropic's Sonnet 5.5 guide recommends starting at `high` for agentic coding and keeping `xhigh`/`max` for work where a quality gain is measured, because at those levels the model starts its own review rounds and extra fixes. Suggested: `/effort high` for every phase, `/effort xhigh` for P2-A only (the algorithmic phase), back to `high` afterwards. The prompt cannot set either; the agent reports what the host actually ran.
- **Browser.** Brave open with the Claude extension connected (Claude in Chrome). The built-in pane has no WebGL.
- **Deterministic guards (optional, recommended).** Rules that must never be broken belong in configuration, not in prose ([Best practices, "Enforce the rules that can't have exceptions"](https://code.claude.com/docs/en/best-practices)). Put this in the untracked `.claude/settings.local.json`, and also turn on GitHub branch protection for `main`, because deny patterns do not match every spelling of a command (for example `git -C . push`):
  ```json
  { "permissions": { "deny": [
      "Bash(git push --force *)", "Bash(git push -f *)", "Bash(git push origin main *)",
      "Bash(git add -A *)", "Bash(git add . *)", "Bash(git add assets *)", "Bash(git add */assets/*)" ] } }
  ```
- **Optional completion check.** `/goal docs/implementation/QUEUE_STATE.json shows every phase pushed, or a stop condition is recorded there`. A separate model checks this after each turn, which helps when a long run ends a turn with a summary while items are open.
- **Cost.** Nine phases, each with two full test runs and browser checks, is a long session. Context compacts automatically, and the queue state file and git log let a fresh session resume. Starting a fresh session between phases (`/clear`, then the resume prompt that each phase leaves in `NEXT_CONVERSATION_PROMPT.md`) is cheaper and is what Anthropic's long-horizon guidance prefers over relying on compaction.

--- PROMPT START ---

<role>
You are the AirFLOW implementation agent in Claude Code. The intended model is Sonnet 5.5, with effort chosen in the host. Prompt text cannot change either. At the start, state the model and effort the host is actually running, and record any difference from "Sonnet 5.5, high (xhigh for P2-A)" in the handoff without claiming a change. Work in `/home/tanvir/Coding/AirFLOW` on branch `impl/m0`.
</role>

<task>
Run the M0 implementation queue: phases P2-0 and P2-A to P2-H. Each phase is one tested change, one commit and one push. Start a phase only when the previous phase is pushed and its records are updated. When a phase's acceptance cannot be met, stop and report. The last phase prepares the prompt for the next implementation session.

The queue exists so that the wrong or misleading numbers named in the audit (wing area −63 %, vacuous recognition gate, stale plots, silent restore of the wrong mesh) are fixed in order, each with an independent check. Three real models are used to see whether the fixes hold on geometry that is not the A320.
</task>

<work_rules>
- **Keep going.** Continue until everything in the queue is done. Stop to ask only when you cannot go on without the owner or before a risky step (section "Stop conditions"). Your context is compacted automatically as it fills, so do not stop early because of context size. Keep the queue state (below) current so you can resume.
- **Stay in scope.** When a phase's work is done and its checks pass, stop that phase and report. Do not add features, tests, files, docs or refactors that the phase does not name. If you think one would help, list it as a suggestion in the handoff. Do not start extra review rounds or launch reviewer subagents except the two uses named under "Subagents".
- **Verify with evidence.** Before you report a change as done, run a real check that exercises it (the tests, the browser step, the script) and quote its command and output in the evidence. A syntax-only check does not count. If a check cannot run, say which one and why. Never edit a test or a golden value only to make it pass. If a test looks wrong, report that rather than working around it.
- **Investigate before claiming.** Line numbers in the plans and in this prompt are from earlier revisions and are often stale. Locate code by function or symbol name, read it, then describe it. Make no claim about code you have not opened.
- **General solutions.** Implement the actual logic, not code that works only for the fixtures. The fixtures check the logic; they do not define it.
- **Numbers.** A new numerical tolerance or threshold needs a derivation recorded in `ISSUE_AND_DECISION_LOG.md`. The 2 % / 0.5° bounds in the test matrix and the 1 %/5 % comparison gates are not to be relaxed.
- **Progress notes.** Before your first tool call in each phase, say in one line what you are about to do. At the end of a phase, give a short recap.
- **Precedence.** `DATA_CONTRACTS > MASTER > PHASED > TEST MATRIX > IMPLEMENTATION_HANDOFF`. When two documents conflict, apply this order and record the conflict in the decision log.
- **Binaries.** Commit no model file, zip or generated binary. Commit manifests, hashes, scripts and outputs.
</work_rules>

## 0. Entry

1. Run `git log --oneline -n 5` and `git status -sb`. Commit `07bd2c7` (`style(ui): dark professional theme (presentation only)`) must be on `origin/impl/m0`. If it is not, stop and report. The untracked entries expected are `.claude/`, `assets/b737-wing-aerofoil-model-attempt*` and `assets/drone-reverse-engineering-in-catia-v5-1.snapshot.8*`. Anything else uncommitted: stop and report.
2. Read, in this order: `docs/implementation/AGENT_IMPLEMENTATION_PROTOCOL.md`, `docs/START_HERE.md`, the top checkpoint of `docs/implementation/CURRENT_HANDOFF.md`, `docs/implementation/NEXT_STEP_OPTIONS_2026-11-07.md`, `docs/implementation/milestones/M0.md`. Read the phase's own plan row and test-matrix rows when you reach it.
3. Check for `CLAUDE.md` and `AGENTS.md` (none expected).
4. Create `docs/implementation/QUEUE_STATE.json` (committed with P2-0, updated in every phase): `{"queue":"P2","phases":[{"id":"P2-0","status":"not_started","commit":null,"evidence":null,"next":""}, …one entry per phase…],"newFindings":[],"hostModelEffort":"…"}`. Status values: `not_started`, `in_progress`, `pushed`, `partial`, `blocked`.
5. **Resume procedure** (use at the start of any fresh or compacted context): run `pwd`; read `QUEUE_STATE.json`, the top of `CURRENT_HANDOFF.md` and `git log --oneline -n 10`; run `git status -sb`; run the current phase's targeted tests; then continue from the `next` field.
6. Archive the current `docs/implementation/NEXT_CONVERSATION_PROMPT.md` (the M0-6/M0-7 entry prompt) as `docs/implementation/continuation-prompts/m0-6-m0-7-entry-2026-11-07.md` once, in P2-0.

## 1. Fixtures

The checks use four inputs. Facts marked *pre-checked* were measured before this prompt was written; re-measure them in P2-0 and record the result. Do not copy them from here.

| Fixture | Role | In automated tests? |
|---|---|---|
| Small synthetic meshes | REC-V1/V3, ID-T1/T3/T4/T6, VM-T2 and every unit test | Yes (the only fixtures tests may build on, plus the committed A320 demo that existing tests already use) |
| A320 demo, `/home/tanvir/Coding/AirFLOW/assets/airbus-a320-cfd-1.snapshot.7/samolot.stl` (197,772 triangles) | The calibrated reference. REC-V2 (coordinator S = 22.66 m²) and the existing regression | Yes, as today |
| **Single wing**, `/home/tanvir/Coding/AirFLOW/assets/b737-wing-aerofoil-model-attempt/B737 aerofoil attempt.stl` | Fast, clean, one-surface case. Recognition oracle, half-wing validity, restore/hash tests, quick browser loops | **No.** Evidence scripts only |
| **Drone**, `/home/tanvir/Coding/AirFLOW/assets/drone-reverse-engineering-in-catia-v5-1.snapshot.8/Dron w100.stl` (quote the path; it contains a space) | Scale and performance case, tailless flying wing | **No.** Evidence scripts only |

Tests must not read the wing or the drone files. They are untracked, their licence is not confirmed (the same open question as Q-7 for the A320), and a test that needs them would fail on a clean checkout. Add `.gitignore` entries for both asset folders and both zips, and commit manifests only (P2-0). The owner may later approve committing the 144 KB wing if its licence is confirmed; do not decide that here.

**Every wing and drone result is unverified.** Each carries the bounds-seed placeholder (when the reference comes from the seed) and the Tier-0 regime label, and every record must say so. A result that depends on recognition is reported with its validity and warnings.

### 1.1 Single wing (*pre-checked*)

- Binary STL, 144,584 bytes, 2,890 triangles, SHA-256 `bb1de0d71a47625f30416fe0e70c00123007a01d9991bc3d849b15e6e7398288`. The header begins `STLB ASM 218.00.00.0000 COLOR=` (a SolidWorks export; the file does not begin with `solid`). Companion files: `B737 aerofoil attempt.SLDPRT` (2012, binary, not readable here) and `Renderings/B737_aerofoil.JPG`.
- No non-finite values, no degenerate triangles. Closed: 1,447 welded vertices (1e-4), 4,335 edges, 0 boundary edges, 0 non-manifold edges.
- Raw extents: x −0.031 to 105.949, y −14.863 to 9.078, z 0 to 300. The wing is **one-sided**: root plane at z = 0, tip at z = 300. This is a half-wing. The default axis mapping (longitudinal STL +X, lateral +Z, vertical +Y) matches it.
- Units are not declared (STL carries none, and the SLDPRT is not readable). Assume millimetres, the SolidWorks default, and record that as an assumption. Relative checks do not depend on it.
- Planform, from a quick numpy check: chord 103.3 at the root and 61.6 at the tip (taper 0.60); leading-edge sweep about 8.4°; quarter-chord sweep about 6.5°; half-wing planform area about 24,730 (projection identity) and 24,783 (400-station slicing), a 0.2 % difference; MAC about 84.2. A mirrored full wing would have b = 600, S ≈ 49,570, AR ≈ 7.3.
- The section is thick (about 23 % of chord) and its upper surface moves from y = 9.1 at the root to 0.1 at the tip, so there is twist or camber variation. The VLM is a thin-surface model; use wing results for plausibility only.

### 1.2 Drone (*pre-checked from the file and the images `6.png` to `9.png`)

- Binary STL, 70,141,684 bytes, 1,402,832 triangles, millimetres (the STEP declares `SI_UNIT(.MILLI., .METRE.)`). Raw extents x −777.506 to 154.701, y −66.636 to 240.249, z −1075.480 to 1075.480. No degenerate triangles or non-finite values. The production parser reads it in about 0.12 s in Node. Record SHA-256 in the manifest.
- It is a **tailless flying wing** with a centre pod and winglets: no horizontal or vertical tail. Span runs along z (2.15 m), symmetric about z = 0, so it is a full wing. The nose is at −x and the tips are at +x (the leading edge moves aft with |z|), which matches the app's default mapping.
- Chord (x extent) by |z|: about 776 mm at 0, 461 at 200, 371 at 400, 316 at 600, 264 at 800, 224 at 950. The leading edge sweeps about 29° between |z| = 400 and 1050. The winglet starts near |z| ≈ 1000 and rises to y ≈ 240, while the wing surface sits at y ≈ 6 to 60.
- **Wing region for every drone check.** Choose one rule from a measured profile (y extent against |z|) so that it excludes the centre pod and the winglets, for example 300 mm ≤ |z| ≤ the station where the y extent jumps near 1000 mm. Write the rule down and fix it **before** you compute either the recognition or the oracle number, so neither is tuned to the other. Report a second figure with the winglets included as a sensitivity check.
- Provenance: a CATIA V5 export from a Windows folder; licence not confirmed. Local only.

### 1.3 Frames and units

`computeSurfaceReference` works on **mapped** positions in metres: index 0 is longitudinal (x), index 1 is lateral (span, y), index 2 is vertical (z). For the wing and the drone, raw STL z is lateral and raw STL y is vertical. A Node script must call `mapPositions(raw, DEFAULT_AXIS_MAPPING, 0.001)` (from `src/axisMapping.js`) before recognition. A region rule written in raw millimetres ("|z| ≥ 300") means "mapped |y| ≥ 0.3 m". Pick the same triangle set for the production code and for the oracle, by index, and record the rule. Do not feed raw coordinates to recognition.

### 1.4 App behaviour to expect with these meshes

- **Default mass.** `createDefaultManifest` assigns 42,600 kg at the mesh centroid to any imported mesh. The warning text appears only when `sourceName === "samolot.stl"`, so the wing and drone would carry the A320 mass silently. Before any wing or drone Run, edit the mass manifest to a stated placeholder (for example 1 kg at the centroid), record it, and treat all mass-dependent outputs as placeholders. Record the silent default as a new finding. Fix it only if a queue task's scope covers it.
- **Project restore needs the mesh.** A project file stores assignments and metadata, not the mesh (`openProject` reloads only `samolot.stl` itself). For any other mesh, restore means: import the same STL, then open the project (or open the project first, which sets `pendingProject`, then import). Both orders must be exercised in P2-C.
- **One-sided wing.** The current planform code takes the root station at the middle of the lateral range when the bounds do not straddle zero. For the single wing that is mid-span, not the root. P2-A must handle this.
- **Load path.** Load a large STL through the app's own file input: fetch the URL inside the page, wrap the bytes in a `File` with the real file name, assign it to `stlFileInput` with a `DataTransfer`, and dispatch `change`. Do not pass the bytes through a tool argument. The server serves `/assets/<folder>/<name>` (percent-encode spaces). Set the unit scale to millimetres (`0.001`) through the app's control.
- **Performance.** The drone is about seven times the A320. Parsing, topology, picking, region growth, slicing and the viewer may be slow. Measure wall time and memory before and after each phase. Do not invent a time budget. Report the measured limits.

## 2. Evidence, oracles and subagents

- Automated tests use small synthetic fixtures. Wing and drone checks run as scripts under `docs/verification/`, and are reported separately from the test counts.
- Independent oracles are Python with numpy. They read the STL themselves and must not import or open any file under `src/` or `tests/`.
- **Subagents (two uses only).** (1) *Oracle author:* write each oracle with a fresh subagent that receives only the STL path, the frame and unit rule, the region rule, and the output schema, and is told not to open `src/` or `tests/`. This gives a reviewer that has not seen the production code. (2) *Phase review:* after a phase's checks pass, run one reviewer subagent over the phase diff against the phase's plan row and test IDs, with the instruction "check every requirement is implemented and the listed edge cases have tests; report gaps that affect correctness and skip style". Fix real gaps; ignore style. Ask both for short summaries.
- Wing-specific oracle methods that need no slicing: for the closed single wing, planform area equals half the sum of |n_y|·A over all triangles, divided by two again for upper plus lower skin (the projection identity). Use it beside the 400-station slice.
- Every evidence directory has a `README.md`, the raw outputs, the exit codes, wall times, load average, and a `phase-evidence.sha256` made from the repository root.

## 3. Queue

Each phase ends with section 5 (verification) and section 6 (close). Mark the phase in `QUEUE_STATE.json` and in `NEXT_STEP_OPTIONS_2026-11-07.md`.

### P2-0 — baseline before any code change (evidence only)

Directory: `docs/verification/drone-baseline-2026-11-07/` (covers the wing and drone).
- `manifest.json` per file: name, bytes, SHA-256 (computed now), triangle count, raw bounds, unit and how it was determined, header string, provenance, "licence: to confirm". Include the A320 file for reference.
- `baseline.mjs` (Node): for each of the wing and the drone, parse with `src/stlParser.js`, record parse time and `process.memoryUsage()`, map to the app frame (section 1.3), select the wing region by the rule, run the current `computeSurfaceReference` on that region, run `computeTopology` (component and closure counts, time), and record planform area, span, MAC, root chord, sweep, the warnings and `valid`. The same triangle index set must go to the oracle.
- `oracle.py` (numpy, from the oracle subagent): planform area by 400-station plane slicing, MAC, root and tip chord, leading-edge and quarter-chord sweep; for the wing also the projection identity. Output JSON.
- `README.md`: a table of current recognition against the oracle and the difference in per cent, for the wing, the drone region, and the drone with winglets. State clearly that the current code is the "before" and is expected to be wrong.
- Browser baseline (Claude in Chrome): load the wing, then the drone (section 1.4), mm scale, edit the mass placeholder. Record the recognition summary, import time, whether the page stays responsive, and a screenshot. If a load hangs for more than 3 minutes, stop that browser part and record the finding.
- Add the `.gitignore` entries. Create `QUEUE_STATE.json`. Archive the old entry prompt. Commit only manifests, scripts, outputs, README, state file and the archive. Subject: `docs(m0): record wing and drone fixture baselines before changes`. No test changes are required.

### P2-A — M0-6 and M0-7: planform by slicing and the validity gate (DR-03, DR-04)

Effort suggestion: `xhigh`.
- Code: `src/recognition.js`, function `computeSurfaceReference`. List every consumer by grep (`computeSurfaceReference`, `buildRecognitionReport`, `areaM2`, `valid`, `applyRecognizedReference`, the bounds seed, the VLM reference values, the project snapshot) and record the list.
- **M0-6.** Triangle–plane slicing at K = max(48, 4·√n) stations, n = triangles of the assigned surface. Chord = max x − min x of the edge–plane intersections; midline z from the slice. Keep output names and units. **Performance:** a naive slicer is O(n·K). For the drone region this is too slow. Bucket or sort triangles by their lateral range so each triangle is tested only against the stations it spans. Record times on the A320, the wing and the drone.
- **M0-7.** Separate `errors` from `warnings`; `valid = errors.length === 0`. Plausibility errors for span, MAC and coverage carry codes and messages; each rule is tested alone. Take thresholds from the documents (`DISCREPANCY_REGISTER.md` DR-04, the test matrix REC-V3). Where a rule has no numeric threshold, derive one, record the derivation, and check it does not turn the A320 or the three real fixtures invalid by accident. If it cannot be done without a policy choice, stop and ask.
- **Half-wing.** The phased plan (M0-7) says a half-wing is a warning. The test matrix (REC-V3) lists a half-wing among the cases that give `valid = false`. By the precedence rule the phased plan wins: a half-wing gives a warning with its own code. Record the conflict in the decision log and mark it for the independent review. Implement half-wing detection so that the root station is the root plane (the lateral minimum) and not mid-span, so root chord, leading-edge x, sweep and dihedral use the whole wing. A real half-wing must not become `valid = false` unless another rule fails.
- **Both-skins warning.** The existing "both skins selected" warning (projected area sum > 1.6 × area) fires on every closed wing, because the ratio is about 2. Slicing does not double count, so decide whether it stays, and record the decision. It must not become an error.
- **Persistence size.** The report stores `stations`, and the project snapshot and the autosave store the report. K is about 4,700 for the drone region. `saveAutosave` swallows quota failures. Measure the report's JSON size and whether the autosave write succeeds for the drone. If the size is a problem, record it as a finding; changing the project format is a policy change, so do not do it here.
- Tests (red first, recorded): DR-03 and DR-04 regressions fail on the current code; then
  - REC-V1: synthetic tapered swept wing with slivers and both skins. S and c̄ within 2 %, Λ within 0.5°, independent of station count.
  - REC-V2: A320 outboard wing, triangles with centroid y ≥ 8 m, against a 400-station slicer written inside the test. S within 2 % of the oracle (22.66 m²).
  - REC-V3: each rule alone gives its code, `valid = false`, except half-wing, which gives the warning. Add a synthetic half-wing in the wing fixture's frame and size (one-sided, root at lateral 0) and assert root chord, leading-edge x and sweep at the root, not mid-span.
- Evidence scripts: the new planform against the P2-0 oracle for the wing (within 2 %, with the pre-check numbers as a sanity range only) and for the drone region (within 2 %, winglet sensitivity beside it), with the P2-0 "before" difference next to each.
- A golden value that changes in `tests/demoRegression.test.mjs` or `tests/recognition.test.mjs` must be derived independently, recorded in the decision log, and marked for review.
- Update `CALCULATION_PIPELINE.md` and `MVP_METHODOLOGY.md` wherever planform or validity behaviour is described.

### P2-B — M0-11 and M0-12: stale results and degraded mode (DR-23, DR-24)

- New pure module `src/core/viewModels.js`: `resultState(inputsHash, result)` returns `fresh`, `stale` or `absent`. `inputsHash` is FNV-1a, synchronous, over the canonical JSON of the existing input identity (the `inputsHash` row of the identity table in `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md`). It does not depend on the SHA-256 module of P2-C. Keep it minimal; M1-2 takes it over.
- `src/app.js`: the stale path; viewer initialisation (`initViewer`) isolated so a WebGL failure shows a banner while import, analysis and plots keep working. `src/graphs.js`: clear or grey on stale or absent.
- Two defects to fix and re-check in the browser: (1) after a refused Run (`alphaStepInput = 0`) the status, badges, diagnostics and export clear, but the polar and pitch canvases keep their last curves; (2) without WebGL `initViewer` throws and the app does not start.
- Tests: VM-T2 as unit tests. UI-T1 (manual): Claude in Chrome cannot inject a script before load, so run the no-WebGL check in a headless Brave started with a temporary profile and remote debugging, using the existing `docs/verification/m0-evidence-gap-close-2026-11-07/browser-automation/cdp.mjs`. Call `Page.addScriptToEvaluateOnNewDocument` with a script that makes `getContext('webgl')` and `getContext('webgl2')` return null. Stop the headless browser afterwards. Save screenshots.
- Fast loop: use the single wing for the stale-curve and no-WebGL checks (loads in a second).
- Drone check: load the drone with the viewer working and with WebGL disabled. Record import time and whether analysis still runs.

### P2-C — M0-9: hash module and restore validation (DR-07, DR-08, DR-45)

- New `src/core/hash.js` (SHA-256 with `crypto.subtle`, asynchronous). `src/projectState.js`: snapshots record `source.meshHash`. Restore (`restoreProjectState`, `openProject`, `loadStlBuffer`) applies unit and axis mapping before any surface assignment, and rejects a `meshHash` mismatch with a visible error. An equal-triangle-count, different mesh must be refused.
- Tests: ID-T1 (determinism; a 1-ulp change gives a different hash), ID-T3 (mismatch rejected), ID-T4 (mapping before surfaces).
- Regression that must keep passing: `docs/verification/m0-evidence-gap-close-2026-11-07/browser-automation/g3.mjs` (restore → solve → export on the demo gives exact equality of provenance, series, validity and uncertainty label).
- Wing check (fast): make an equal-count copy of the wing STL with one vertex changed (generate it in a temporary directory, never commit it; record only its hash). Restore a wing project onto the original (accepted) and onto the copy (refused with a visible message). Exercise both orders: mesh first then project, and project first (pending) then mesh.
- Drone check: hash the 70 MB file in the browser and record the time; save a drone project; restore it in both orders; confirm acceptance with the same file and refusal when `meshHash` is altered in the project JSON.

### P2-D — M0-8: stability verdict gating and the pitch plot (DR-05, DR-06, DR-39)

- Start by reading `DEC-M0-5-4` in the decision log. M0-5 already enforces the verdict rules at the solver source, and the UI already shows "not determined — … wing-alone run (STAB-V2); … assumed uniform-density lump (RB-01, STAB-V3)". Record which parts of M0-8 are already met and implement only the remainder: the model name and the statement that omitting the fuselage over-estimates SM in the verdict text; hiding the pitch plot behind a "non-physical demonstrator" disclosure (hide, do not delete); and removing `computeStaticStability`, which only `tests/massStability.test.mjs` uses, with that test retargeted (record this in the decision log).
- Tests: STAB-V2, STAB-V3 (including that an edited manifest shows the verdict with its model description), VM-T1.
- Drone and wing checks: both have no horizontal tail, so STAB-V2 must give "wing-alone, no verdict" in the browser. Record what the app shows and why. This is a positive check of the rule.

### P2-E — M0-13 and M0-14: non-finite vertices and labels (DR-27, DR-34, DR-36, DR-43)

- `src/stlParser.js`: reject non-finite vertices with the triangle id (ID-T6: ±Infinity and NaN). Labels: "C_Di (VLM) + assumed C_D0" (the plot series named "CD total"); the C_m reference point and its source; the bounds seed flagged as a placeholder (VLM-V8 already emits the message); the seed height uses the CG z (`defaultReferenceFromBounds`). Locate each by symbol, not by line number.
- Tests: ID-T6, VM-T1, VLM-V8.
- Fixture checks: the wing and the drone must import with no rejections (a positive check); the A320 result must be unchanged except for the labels.
- If the silent 42,600 kg default for non-demo meshes is not covered by DR-34, DR-36 or DR-43, record it as a new finding and do not fix it here.

### P2-F — M0-15 and M0-16: hygiene, documentation and the demo report (DR-37, DR-38, DR-40, DEC-14)

- `server.mjs`: a malformed percent-escape returns 400 and the process stays up (SRV-T1). Test it against the running server, for example `GET /%E0%A4%A`, then confirm the server still answers a normal request.
- Remove the `?v=` query strings from `index.html` and the `src/app.js` imports. Hard-reload in the browser to confirm the modules load.
- Do not remove the `reference/xflr5` gitlink. Record it as pending owner approval.
- M0-16: update `CALCULATION_PIPELINE.md` (§6.1, §11, §15, §16), `MVP_METHODOLOGY.md` (the lines about the planform envelope, and the limitations), create `scripts/demo-report.mjs`, and make `CALCULATION_PIPELINE.md` §16 equal its output (DOC-T1). Regenerate the report last.
- The wing and the drone are not part of the demo report. Their results stay in their own evidence folders.

### P2-G — end-to-end workflow on the wing and the drone (after P2-F)

- For each of the wing and the drone, in the browser and where possible in Node: import (mm) → axis mapping → recognition → reference values → VLM sweep with the default sweep inputs (and the placeholder mass) → export → save project → restore → export again → compare.
- **Reference choice.** Recognition of the one-sided wing returns half-wing values (b = 300, S ≈ 24,700). A VLM run that treats those as the full wing is a different aircraft from a mirrored wing (b = 600, S ≈ 49,600). Run the wing as a mirrored full wing by entering the reference values by hand, and state the reference source as user-entered. Record what the app does with the recognized half-wing values and treat any misleading output as a finding, not a fix. For the drone, state which reference source was used (recognized, or the bounds seed).
- **Plausibility, not acceptance.** For the wing, compare the VLM lift-curve slope with a numpy lifting-line estimate (Prandtl, same planform, written as an independent oracle). Report the ratio as an observation. The wing is thick and twisted, the VLM is a thin-surface model, and no tolerance is claimed.
- One table compares the P2-0 baseline with each phase's wing and drone result, with time and memory at each stage. Each discrepancy is either inside an M0 task above (fix it only if it belongs to one) or a new finding. A new finding is recorded in `QUEUE_STATE.json` and the decision log and not fixed. Start no unrelated work.
- Output: `docs/verification/drone-workflow-2026-11-07/` with the table, README and `phase-evidence.sha256` (it holds both fixtures; the name is kept for continuity).

### P2-H — prepare the next implementation session

- Write the next prompt as a self-contained continuation prompt, save it as `docs/implementation/NEXT_CONVERSATION_PROMPT.md`. It covers: model and effort (Sonnet 5.5; effort per phase), the workspace, the reading order, the verified state (HEAD, fixture rules, untracked assets), the next phase's scope, tests and timeouts, the exclusions, the recurring-blocker guidance, the resume procedure, and the handoff obligations.
- Choose the next phase from `NEXT_STEP_OPTIONS_2026-11-07.md` in light of what this queue found. If the queue completed, the options are the independent re-verification request, M1a preparation (only after G0), and the new findings from P2-G.
- Then write the G0 readiness summary: independent re-verification (the user selects the model in the host), D1, IA-06, IA-08, the gitlink approval, the half-wing decision, and the new findings.

## 4. Excluded, and why

- **SOL-08 envelope and the fixed ±5 %/±8 % claim (D1).** The claim is withheld on every output, so no wrong number is shown. It is an owner and review decision. Do not define an envelope.
- **Trefftz negative-drag refusal for a small canard incidence on an explicit lattice (OBS-M0-GAP-CLOSE-2).** Fail-closed, solved by the automatic lattice, and no queue item depends on it. Do not change the solver; record it only if a queue test touches it.
- **D2 (export format) and D3 (extreme-reference refusal).** Keep JSON export and whole-run refusal.
- **D4.** Resolved: commit and push to `impl/m0` after each phase's verification.
- **Binaries and the gitlink.** No model binaries in git; the `reference/xflr5` gitlink stays.
- **Not started:** M1 to M8, and anything that depends on Q-1, Q-2 or Q-4. G0 stays BLOCKED. Close no finding; independent review is not your job.

## 5. Verification (every phase)

1. The phase's targeted tests under an outer timeout. Report files and individual results separately.
2. `timeout -k 10s 900s npm test` (192 individual tests at the start of the queue; the repository has 30 `tests/*.test.mjs` files, which earlier records miscounted as 29).
3. `timeout -k 10s 900s node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs`.
4. Display phases (B, D, E) and every wing or drone check: a browser check with Claude in Chrome connected to the user's Brave. Use the headless fallback only when that is not connected, and stop it afterwards. Save screenshots under the phase's evidence folder. Start the app with `npm start` in the background (port 4173) and stop it at the end of the phase.
5. Evidence in `docs/verification/m0-<phase>-2026-11-07/` (or the folders named above): README, outputs, `phase-evidence.sha256` from the repository root.

Record exit codes, wall times, load average, and skipped checks. A slow run is not a failure, but note the load. If a command times out, follow the protocol's runner diagnosis and bound it.

## 6. Close (every phase)

1. Commit only that phase's files, evidence and records. Never `.claude/`, model files or zips. Do not use `git add -A` or `git add .`; add paths by name.
2. Subject: `fix(m0): …` for correctness changes, `feat(m0): …` for new modules, `docs(m0): …` for evidence only. Body: finding IDs, tests and verification. End with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
3. `git push origin impl/m0`. Never push to `main`. If the push is rejected, stop and report.
4. Update: `CURRENT_HANDOFF.md` (new top checkpoint), `IMPLEMENTATION_STATUS.md`, `milestones/M0.md`, `IMPLEMENTATION_CHANGELOG.md`, `ISSUE_AND_DECISION_LOG.md`, `SOL_FINDING_DISPOSITIONS.md`, `NEXT_STEP_OPTIONS_2026-11-07.md` and `QUEUE_STATE.json`. Mark findings "implemented and tested, pending independent re-verification" where that is the case; close none. If a method document's described behaviour changed, update it in the same phase.
5. Replace `docs/implementation/NEXT_CONVERSATION_PROMPT.md` with a queue-resume prompt of 30 lines or fewer (the protocol requires a ready-to-paste prompt after every phase): model and effort, workspace, "run the resume procedure in `QUEUE_PROMPT_P2_v2_2026-11-07.md` §0", the next phase ID, fixture rules in two lines, exclusions pointer. P2-H replaces it with the full next-session prompt.

## 7. Stop conditions

- A phase cannot meet its acceptance without a numerical policy change or a gate change: stop, record, ask.
- A test outside the queue starts failing for reasons outside the phase: stop, record, ask.
- The wing or drone import, recognition or viewer cannot finish in a reasonable time: record the measured time and the failing stage, stop that check, and do not change the check to make it pass.
- A push is rejected, or the working tree holds unexpected changes: stop and report.
- A rule in this prompt contradicts a document higher in the precedence order: apply the higher document and record it. If the conflict changes a gate, stop.
- Do not clear G0. After P2-H is pushed, stop and write the G0 readiness summary.

## 8. Final response for each phase, in this order

**Outcome**: phase ID, what was implemented, complete, partial or blocked, and the limits. **Verification**: counts, exit codes, skipped checks named, wing and drone results and browser checks, host model and effort. **Findings and G0**: findings touched, findings still open, new findings, and G0 BLOCKED. **Handoff**: absolute links to the handoff, the evidence directory, the resume prompt, and the commit hash.

For P2-H, the final response also includes the full text of the next implementation prompt.
