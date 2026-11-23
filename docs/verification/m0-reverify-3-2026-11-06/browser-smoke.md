# Browser Run and downloads

Run `PORT=4175 npm start` and open the local app in the Codex in-app browser.
The initial loopback bind failed with EPERM and the authorized retry started the
local server. Use the bundled demo and actual Run horseshoe VLM, Save project
and Export results controls. The local server was stopped after verification.

Use the demo bounds reference state, with an 8 m rectangular wing, 1 m MAC and
root and tip chords, zero sweep, dihedral and incidence, root leading x of
17 m, 40 m/s, 1.225 kg/m³, zero yaw and CD0/CM0, and a 0° to 4° sweep in one
4° step. The root placement keeps the moment finite at extreme normalization.
Use R1 (4 rows, automatic spanwise count) or custom 3×12 (refined 6×24).
Enter the reference area in scientific notation.

| Area (m²) | Plotted grid | Visible Run result | Visible comparison | Serialized badge and coverage |
|---|---|---|---|---|
| 3e-307 | R1 | 2 solved cases, 128 panels | R1/R2 reported 0.26% / 1.05% | green, true |
| 2e-307 | R1 | 2 solved cases, 128 panels | Withheld, both slopes nonfinite | amber, false |
| 2.12e-307 | custom | 2 solved cases, 36 panels | Withheld, coarse slope nonfinite | amber, false |
| 3e-307 | custom | 2 solved cases, 36 panels | Custom/refined reported 1.73% / 0.62% | amber, true |

All four states were observed on the entry source and repeated after reload on
the final source. An initial batch of browser clicks produced no accessible
download paths. The event-based capture returned one entry custom project and
four pairs of final downloads. The entry custom project comparison matches its
final counterpart. The browser displays the fixed uncertainty claim as unverified
throughout.

`node docs/verification/m0-reverify-3-2026-11-06/check-downloads.mjs /home/tanvir/Downloads`
checks the filenames returned by the browser. [Parsed records and file hashes](browser-downloads.json)
retain provenance, coverage, status, reasons and all available plotted case
coefficients and loads. The matching project and results records keep null
prescribed summaries and deltas on the overflow control. The custom split
preserves the valid refined grid, omits custom deltas and leaves the prescribed
comparison passing. The seed flag is true on all browser rows and the cases
carry the bounds warning. Explicit false and omission were verified at the API.
These browser runs exercise inherited recovery and withholding. The newly
corrected opposite-signed input was constructed at the comparison API.
