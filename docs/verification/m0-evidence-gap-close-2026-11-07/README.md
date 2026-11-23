# M0-EVIDENCE-GAP-CLOSE evidence (2026-11-07)

Gap closure for the M0-EVIDENCE-RECONCILE ledger ([LEDGER.md](../m0-evidence-reconcile-2026-11-07/LEDGER.md)), in the order the next prompt defines: browser checks G-1 to G-3, then the identity test G-4. Branch `impl/m0`, committed base `dd7b2c5` (pushed). This phase's changes are uncommitted: the rewritten identity test, `browser-results.json`, the evidence in this directory, and the record updates. Production code is unchanged: `src/vlmSolver.js` and `tests/aud1.test.mjs` match the committed versions. G0 remains BLOCKED. No finding is closed.

## Browser environment

- Claude in Chrome connected to the user's Brave (extension installed by the user). Page: `http://localhost:4173/`, served by the local `node server.mjs`.
- The built-in browser pane has no WebGL context (`GL_VENDOR = Disabled`, sandboxed). The app fails at startup there ("Startup failed: Error creating WebGL context"), and it cannot load the demo or run the VLM. This is an environment limit of that pane, not a code change in this phase.
- An earlier attempt with a headless Brave started by this session (remote debugging, temporary profile) also reproduced G-1 and G-3. It was stopped afterwards. Its scripts are in [browser-automation/](browser-automation/).

## Results

| Gap | Result | Evidence |
|---|---|---|
| G-1 β = 5° prescribed check, UI | **PASS.** Badge amber, claim prescribed R1 vs R2, ΔC_Lα 0.01752425309329866 and ΔC_Di 0.05170673842746727, identical to the API probe at all printed digits. Identity β = 5, plotted lattice R1, reference point = CG. | [browser-results.json](browser-results.json) (G1_beta5_claudeInChrome) |
| G-1 IA-01 invalid geometry, UI | **LIMIT.** The UI has no control for a coplanar forward surface, so the fixture cannot be entered. | browser-results.json (G1_IA01_invalidGeometry) |
| G-2 invalid-sweep export, UI | **LIMIT.** Three wing-only UI configurations (4 rows × 32 span at α 0/10; 8 rows × 32 span, custom; 2 rows × 4 span at α ±10) returned `warning` sweeps with all values available. A fourth (1 row × 2 span) produced no export. The AUD-2 invalid case needs a tail, which the UI supplies only by recognition or by face selection in the 3-D viewer. Face selection was not attempted. | browser-results.json (G2_invalidSweepExport) |
| G-3 restore → solve → export, valid fixture | **PASS.** After saving the project, reloading and restoring it through the real file input, the run and export match the pre-save run exactly on provenance, series, validity and uncertainty label. Deltas are identical. Checked in the user's Brave and in the headless Brave. | browser-results.json (G3_restoreSolveExport_claudeInChrome) |
| G-3 invalid restore (substitute) | **PARTIAL.** An invalid input (`alphaStepInput = 0`) is refused with "VLM failed: alphaStepInput must be positive." Status, solver and resolution badges, diagnostics and the export button are cleared. **The polar and pitch canvases keep their previous curves** (ink unchanged, 97400 pixels each). This is the stale-curve item of SOL-07 (review item 3), which is M0-11 scope and excluded from this phase. | browser-results.json (G3_invalidRestore_substitute_claudeInChrome) |
| G-4 identity coverage | **PASS for the material inputs.** 32 tests in [`tests/m0-evidence-identity.test.mjs`](../../../tests/m0-evidence-identity.test.mjs): a control, 10 flow, reference and seed inputs, 2 lattice inputs, 14 per-surface fields (wing and canard), wing incidence, wing x, canard x and canard incidence. Every material input changes the identity. | [identity.tap](identity.tap) |

### G-4 known limit: canard incidence refused by the Trefftz guard

With an explicit 8-strip spanwise count and 4 chordwise rows, a canard incidence of ±0.5°, 1° or 2° is refused by the solver with "Trefftz-plane induced drag is negative … Refusing to report |D|". The refusal is fail-closed: no value or identity is reported. The same canard incidence on the automatic lattice (wing 32, canard 24 strips) solves and changes the identity. The known-limit test records the explicit-lattice refusal. If that refusal stops, the test fails and the record must be reviewed. This is a solver behaviour finding for independent review, not an identity gap. It was reached while the test was being written, and it is not fixed here.

### G-4 corrections made during this phase

- The first version of the file had two failing cases. One was canard incidence, refused as above. The other moved the canard to x = 0.1, which overlaps the wing, and was also refused. The overlap change was a bad perturbation. The canard x case now uses −4.1, and the overlap is noted in the test comments.
- The `dd7b2c5` commit message says "three of 31" failing. The run had 2 of 31 failing, so that statement is corrected here.

## Verification

Run by [run-verification.sh](run-verification.sh), sequentially, in this directory. Outputs are the `.tap`, `.err`, `.exit` and `.time` files. The machine was under heavy load during the runs (load average about 19 on 16 cores) because a headless browser was running. The wall times below are therefore not comparable with the earlier 190–212 s baseline.

| Command | Individuals | Result | Wall | Exit |
|---|---:|---|---:|---:|
| `node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` ([targeted.tap](targeted.tap)) | 59 pass, 0 fail, 0 skipped | 19 files | 47.31 s | 0 |
| `npm test` ([npm.tap](npm.tap)) | 192 pass, 0 fail, 0 skipped | 29 files | 152.75 s | 0 |
| `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` ([combined.tap](combined.tap)) | 192 pass, 0 fail, 0 skipped | 29 files | 524.14 s | 0 |
| `node --test --test-isolation=none --test-reporter=tap tests/m0-evidence-identity.test.mjs` ([identity.tap](identity.tap)) | 32 pass, 0 fail, 0 skipped | 1 file | 111.77 s | 0 |

The combined runner now includes the 32 identity tests, which adds about two minutes. Its previous guard of 330 s was too tight for this set, so the next prompt uses 900 s. The combined figure from this run is also inflated by the load described above.

## Not run in this phase

- G-2 invalid-sweep browser export and the restore → solve → export sequence for an invalid project.
- Frozen replay. No executable changed in production code, and the M0-REVERIFY-4 replay still stands.
- Exhaustive enumeration beyond the 32 identity tests (for example, solver options that do not enter the resolution check).

## Manifest

[phase-evidence.sha256](phase-evidence.sha256) lists every file here except itself. Verify from the repository root with `sha256sum -c docs/verification/m0-evidence-gap-close-2026-11-07/phase-evidence.sha256`.
