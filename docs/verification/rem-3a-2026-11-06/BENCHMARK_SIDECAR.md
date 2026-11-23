# Benchmark provenance reconciliation v1 — REM-3a

This sidecar supplements, never replaces, frozen SOL-05 and the historical tables. The original scripts survive as copies in `../sol/evidence/`; their exact bytes are not proven to have produced the historical table. They import production kernel code, collapse circulation in y across chordwise rows, and use a y-only body-plane drag extraction (the multirow script takes absolute drag). They are not independent physics oracles.

The frozen `../sol/probes.mjs` OBS1-projection experiment holds each production circulation field fixed and changes only the extraction direction. Identity: one rectangular planar wing, root and tip chord 1 m, span AR m, reference area AR m², reference chord 1 m, reference point (0.25,0,0) m; alpha 4°, beta 0°, velocity 40 m/s, density 1.225 kg/m³; 8 chordwise rows, automatically selected spanwise strips N=32/48/64/96 for AR=4/6/8/12 respectively, wake factor 2000 (and >=10b floor). Production drag uses all legs in the freestream-transverse plane; the comparison uses the same circulation and panels, with transverse direction derived from body x. The `sol-pre.ndjson` records actual runs and diagnostics; the frozen probe is the executable identity. The table reports efficiency, not a new acceptance band:

| AR | Historical printed | Freestream plane | Body plane |
|---:|---:|---:|---:|
| 4 | 1.0121 | 1.0330458323 | 1.0121245866 |
| 6 | 0.9898 | 1.0064601460 | 0.9898060126 |
| 8 | 0.9717 | 0.9860046888 | 0.9716646446 |
| 12 | 0.9412 | 0.9529529660 | 0.9411530009 |

Body-plane values recover historical values to printed four-decimal precision; this is a rounding comparison, not a physics accuracy tolerance. These are production self-comparisons, not independent measurements. The LLT and prescribed-loading independent evidence remains in `../sol/llt-results.json`, `../sol/analytic-results.json`, and `../independent-2026-11-06/REPORT.md`; their assumptions and limitations apply. Matching integrated lift does not identify the circulation field. The lower-priority test matrix +x-wake sentence conflicts with DATA_CONTRACTS §2.7 freestream alignment; no wake or solver change is made.

The approved ±5%/±8% wording is preserved in DATA_CONTRACTS §2.7 and `UNCERTAINTY_LABEL` as provenance; the review disputes general applicability. No reviewed geometry/flow/angle/resolution envelope and no confidence bound follow from the sparse comparisons. Application claims are therefore withheld for all cases pending independent scientific review, including nominal benchmark-like cases. Establishing a defensible envelope, reconciling VLM-V2's -10% band with the label, and external moment/neutral-point validation remain open. This is an interim withholding policy, not a replacement contract or invented acceptance threshold. Future benchmark publication still needs explicit case identity (geometry, reference normalization, flow, lattice, wake and extraction) and independent source classification.
