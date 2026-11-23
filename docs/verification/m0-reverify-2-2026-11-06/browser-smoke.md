# Browser Run and download smoke (2026-11-06)

Run `PORT=4175 npm start` from the repository root and open `http://127.0.0.1:4175/` in the Codex in-app browser. The initial loopback bind required approval. Use the actual Run horseshoe VLM, Save project and Export results controls. The evidence summarizes 15 pairs of actual downloads. Run `node docs/verification/m0-reverify-2-2026-11-06/check-browser-downloads.mjs /home/tanvir/Downloads` on the captured downloads to reproduce the parsed checks. Filename suffixes in the checker reflect this browser's download sequence.

For the seed comparison, import the [synthetic STL](review-wing.stl) at the default X/Z/Y mapping in metres. Open the [bounds project](review-bounds.json), then separately the [recognized project](review-recognized.json) with its twelve faces marked as wing. In both, use area 8 m², span 8 m, MAC/root/tip chord 1 m, zero sweep, dihedral, incidence and root x, β=3.25°, 40 m/s, density 1.225 kg/m³, two angles 0°/4° in 4° steps, rows 4, auto spanwise, and zero CD0/CM0. The point mass places CG at (0.4,0,0). The source badge read Bounds seed - verify or Recognized wing. Both runs solved two cases on 128 panels and the green badge printed 0.38%/2.71%. The downloads match all effective numeric inputs and the case coefficients and loads exactly. Only the true case carried the VLM-V8 bounds-seed warning. The browser has a source state rather than an omitted boolean control. Omission was tested through the solver API.

For the slope comparison, load the bundled demo and enter the same rectangular wing and two-angle controls with β=0° and root leading x=17 m. This positions the wing near the demo CG, so the coefficients and loads remain finite. An initial attempt at root x=0 stopped at the moment-coefficient guard and was not used for the comparison. Use rows 4 and auto spanwise for R1 (128 panels). Use 3 rows and 12 spanwise panels for the custom grid (36 panels). The comparison's checked refinement is 6×24. Enter the reference area in scientific notation. After changing source, reload the browser and reload the demo before repeating the final runs.

| Stage and area (m²) | Prescribed badge | Custom badge |
|---|---|---|
| Entry 2e-307 | Amber, withheld | Amber, withheld |
| Entry 3e-307 | Amber, falsely withheld | Amber, falsely withheld |
| Entry 2e-306 | Not run | Amber, reported 1.73%/0.62% |
| Final 2e-307 | Amber, withheld | Amber, withheld |
| Final 2.09e-307 | Amber, withheld, coarse-only nonfinite reason | Not run in browser |
| Final 2.1e-307 | Included in the custom record, passed gates | Amber, withheld, both custom grids invalid |
| Final 3e-307 | Green, reported 0.26%/1.05% | Amber, reported 1.73%/0.62% |

Withheld rows display “Resolution convergence claim withheld (see diagnostics)” and the slope reason. The app reports both plotted cases as solved and the result download carries finite available case data. The comparison's distinct withheld state, reason, per-grid validity, null summaries and deltas or absent custom metrics, and absent coverage survive both project and result download. The browser app also shows the fixed uncertainty claim as unverified. The [parsed records](browser-downloads.json) retain case and comparison validity, provenance, identity and coverage. At 2.1e-307 m² the prescribed check within the custom record passed both gates and still granted no custom coverage. No screenshot or latency benchmark was collected.
