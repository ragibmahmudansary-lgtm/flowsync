# Browser Smoke Test (M0-2, updated for REM-1)

Reproducible manual/automated smoke test for the browser MVP's VLM integration.
Run it after any change to `src/vlmSolver.js`, `src/app.js` or `index.html`.
No dependencies: the app is vanilla ES modules served by `server.mjs`.

## Procedure

1. **Start the app** (Node 24+, WebGL-capable browser):

   ```bash
   npm start
   ```

   Serves `http://127.0.0.1:4173/` (override with `PORT=`).

2. **Open `http://127.0.0.1:4173/`** and wait for the demo aircraft
   (`assets/airbus-a320-cfd-1.snapshot.7/samolot.stl`, 197,772 triangles) to load.
   The demo auto-runs the VLM sweep after mesh analysis and recognition.

3. **Check the status line** (bottom of the viewport):

   `VLM solved 17 cases with 160 panels (R1)` — the panel count varies with the
   recognised geometry; the resolution tag (`R1` / `R2` / `custom`) must be present.

4. **Check the VLM setup badges** (left column):

   - Solver badge: `VLM R1 current` (or `R2` / `custom`), green.
   - Resolution badge (REM-1): the text **names the flow and lattice actually
     checked** and the α protocol, e.g. `R1 vs R2 @ b=0.0, a=0..4: dCLa <x>%,
     dCDi <y>%` for a prescribed grid, `Custom vs 2x refined @ b=..., a=0..4:
     ...` for a custom grid, or `Custom grid: convergence claim withheld (see
     diagnostics)`. Green when the check that covers the plotted lattice passes
     (ΔC_Lα ≤ 1 % and ΔC_Di ≤ 5 %), **amber** otherwise — a prescribed R1/R2
     agreement must never turn a custom grid's badge green.

5. **Check the solver diagnostics** (right column, "VLM stability result"): must
   contain the multi-row method text (`Horseshoe VLM, M chordwise rows x N spanwise
   strips`), the resolution tag, panel count, residual/pivot ratio, the
   `Resolution claim: ...; checked at beta = ..., alpha = 0/4 deg` line, and the
   scoped Tier-0 label `flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %
   (…not a confidence interval…)`.

6. **Check the viewport**: the lattice (bound lines + freestream-aligned wake legs)
   is drawn over the aircraft; no NaN geometry, no empty scene.

7. **Exercise the panel guard**: set `Chordwise rows` = 1 and `Spanwise panels` = 240,
   press **Run horseshoe VLM**. The status line must show a refusal, e.g.

   `VLM failed: VLM lattice refused: panel Main wing #0/0 has width/length = 0.074 < 0.25 (width 0.1416 m, length 1.9167 m). Add chordwise rows or reduce the spanwise count.`

   and the solver badge shows `Solver error`.

8. **Recover**: set `Chordwise rows` = 4 and clear `Spanwise panels` (blank = auto),
   press **Run horseshoe VLM**. The green badges from steps 4 must return.

8b. **Yaw honesty (SOL-02)**: set `Flow yaw (beta)` = 5 and press **Run horseshoe
   VLM**. The resolution badge must show `b=5.0` (the plotted flow) and may only
   be green if the check **at that yaw** passes both gates; the solver
   diagnostics must show the label as `unverified outside the demonstrated
   comparison envelope` (the ±5 %/±8 % evidence is zero-yaw only).

8c. **Custom lattice honesty (SOL-02)**: set `Chordwise rows` = 2 and
   `Spanwise panels` = 20, press **Run horseshoe VLM**. The badge must read
   `Custom vs 2x refined ...` (or `convergence claim withheld`) and the
   diagnostics must state `Resolution claim: current lattice vs 2x refined
   lattice` — never the prescribed R1/R2 deltas as the custom grid's convergence.

8d. **Quarantine display (SOL-03)**: not reachable from the demo UI (the demo is
   a linear trapezoid; the quarantined configurations are elliptic M > 8 and
   small-scale/inconsistent cases of the solver API). Covered by
   `tests/solFindings.test.mjs`; when a quarantined case is shown, metrics must
   read `UNAVAILABLE — quarantined solution`, both graph canvases must show
   `Results unavailable`, and no pitch simulation may run.

9. **Browser console**: no errors or warnings during the whole run.

## Recorded result — 2026-10-23 (M0-2, this browser session)

| Step | Observed | Expected | Verdict |
|---|---|---|---|
| 3 | `VLM solved 17 cases with 160 panels (R1)` | resolution-tagged status | pass |
| 4 | `VLM R1 current` (green); `R1 vs R2: dCLa 0.40%, dCDi 0.68%` (green) | ΔC_Lα ≤ 1 %, ΔC_Di ≤ 5 % | pass |
| 5 | `Horseshoe VLM, 4 chordwise rows x N spanwise strips (multi-row lattice) R1 (4 chordwise rows). 160 panels; residual 8.70e-14; pivot ratio 4.98e-1; numerically resolved. flat-plate inviscid estimate: C_Lα ±5 %, C_Di ±8 %` | method + label | pass |
| 6 | multi-row lattice + wake legs visible over the demo aircraft | geometry visible | pass |
| 7 | refusal message with panel id and both dimensions; `Solver error` badge | guard refuses | pass |
| 8 | green badges restored, 17 cases solved | recovery | pass |
| 9 | console clean | no errors/warnings | pass |

The demo run also verified the OBS-M0-2-5 fix: the sweep crosses the
incidence-cancelling α (−2°, demo incidence 2°) where the lift is at the roundoff
level; before the fix the auto-run aborted with
`VLM failed: Near-field induced drag is negative (D = -5.05e-29 N)`, now the station
reports exactly zero drag and the sweep completes.

Note: step 3's panel count depends on the recognised demo reference values
(span 33.977 m, root 5.435 m, tip 1.902 m → AR ≈ 9.3 → auto N = 40 at M = 4).

## Recorded result — 2026-10-23 (REM-1 Sol-review remediation, this browser session)

Environment: Node v24.21.0, `npm start` at `http://127.0.0.1:4173/`, automated
browser session (demo auto-run + scripted input changes).

| Step | Observed | Expected | Verdict |
|---|---|---|---|
| 3 | `VLM solved … with 160 panels (R1)` | resolution-tagged status | pass |
| 4 | `VLM R1 current` (green); `R1 vs R2 @ b=0.0, a=0..4: dCLa 0.40%, dCDi 0.68%` (green) | badge names flow + α coverage; gates hold | pass |
| 5 | diagnostics: `Horseshoe VLM, 4 chordwise rows x N spanwise strips (multi-row lattice) R1 (4 chordwise rows). 160 panels; residual 8.70e-14; pivot ratio 4.98e-1; numerically resolved. Resolution claim: prescribed R1 vs R2; checked at beta = 0.0 deg, alpha = 0/4 deg.` + scoped label `(…not a confidence interval or validated error bound.)` | method + claim line + scoped label | pass |
| 7 | refusal message with panel id and both dimensions (`width/length = 0.074 < 0.25 …`); `Solver error` badge; `R1/R2 not run` | guard refuses | pass |
| 8 | green badges restored (`R1 vs R2 @ b=0.0, a=0..4: dCLa 0.40%, dCDi 0.68%`, badge good) | recovery | pass |
| 8b | yaw β = 5°: badge `R1 vs R2 @ b=5.0, a=0..4: dCLa 1.21%, dCDi 1.12%` (**amber**, dCLa exceeds the 1 % gate at the actual yaw); label shown as `unverified outside the demonstrated comparison envelope` | badge checks the plotted flow; out-of-envelope label | pass |
| 8c | custom 2 rows × 20 panels: badge `Custom vs 2x refined @ b=5.0, a=0..4: dCLa 1.02%, dCDi 0.51%` (**amber**), diagnostics `Resolution claim: current lattice vs 2x refined lattice; checked at beta = 5.0 deg` | custom lattice compared with refined, never certified by R1/R2 | pass |
| 8d | not reachable from the demo UI (linear trapezoid); covered by `tests/solFindings.test.mjs` | — | n/a |
| 9 | console clean except the two deliberate guard-refusal `console.error` entries of step 7 (expected logging) | no errors/warnings | pass |

Demo numerical results are unchanged from the M0-2 session (same panels, same
0.40 %/0.68 % deltas at β = 0) — REM-1 changed validity reporting and the
badge's honesty, not the coefficients.
