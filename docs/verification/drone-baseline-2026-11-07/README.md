# P2-0 baseline: wing and drone fixtures before any code change (2026-11-07)

Queue P2, phase P2-0. Evidence only. Branch `impl/m0`, production code at HEAD `07bd2c7` (`src/`, `tests/` untouched). **This is the "before" record.** The current recognition code (`computeSurfaceReference`, binned-vertex planform) is what is measured here, and later phases are judged against it.

**Every wing and drone result below is unverified.** Units for the wing are assumed (mm). The drone is mm per its STEP. Results that use the recognition path carry the Tier-0 label, and any reference that comes from the bounds seed is a placeholder. The mass in every browser run is a placeholder (see F-1).

## Files

| File | What it is |
|---|---|
| [manifest.json](manifest.json) / [make-manifest.mjs](make-manifest.mjs) | Name, bytes, SHA-256 (computed now), format, triangle count, raw bounds, header, unit and how it was determined, provenance, "licence: to confirm", for the A320, wing and drone. Matches the pre-checks (wing 2,890 triangles, drone 1,402,832). |
| [fixtures.mjs](fixtures.mjs) | The region rules, shared by the baseline script. |
| [baseline.mjs](baseline.mjs) and `baseline-*.json`, `*.time`, `*.stdout`, [baseline-exits.txt](baseline-exits.txt) | Node run of the **current** production recognition and topology: parse, map (section 1.3 of the prompt: `mapPositions(raw, DEFAULT_AXIS_MAPPING, 0.001)`), region select, `computeSurfaceReference`, `computeTopology`. Times, RSS and heap per stage. |
| [oracle.py](oracle.py) and `oracle-*.json` | Independent numpy oracle written by a fresh subagent that was told not to open `src/` or `tests/`. 400-station plane slicing, MAC, chords, sweeps, projection identity. It reads the STL itself. |
| [browser-baseline.json](browser-baseline.json), [screenshots/](screenshots) | Claude in Chrome (the user's Brave) runs of the current app. |

## Region rules (fixed before any recognition or oracle number)

The profile of x-extent and vertical extent against |lateral| (mapped frame, 0.05 m bins, then 0.01 m bins near the winglet) was measured first with a scratch script. The centre pod (vertical extent above 0.05 m) ends by |lateral| ≈ 0.2 m. The winglet blend starts at |lateral| ≈ 0.995 m (vertical extent jumps from 0.022 m at 0.99 m to 0.047 m at 1.01 m).

| Case | Rule (raw millimetres, triangle centroid z) | Triangles |
|---|---|---:|
| `wing` | every triangle | 2,890 |
| `drone-wing` | 300 ≤ \|cz\| < 990 (excludes pod and winglets) | 448,142 |
| `drone-with-winglets` | \|cz\| ≥ 300 (excludes pod only; sensitivity) | 542,112 |

The production run and the oracle select by the same rule and produced the same index set in all three cases: the SHA-256 of the sorted index list matches (`regionIndexSha256` in each `baseline-*.json` and `oracle-*.json`).

**Gap convention.** The two drone panels leave a 0.6 m gap at the centre. The oracle reports both `areaPopulatedM2` (stations with intersections only) and `areaBridgedM2` (gap stations get a linearly interpolated chord, the gross-planform convention that the current `fillMissingBins` also uses). The table uses the bridged figure. This convention is a decision for P2-A, not settled here.

## Current recognition against the oracle (Node, same triangle sets)

Difference is (current − oracle) / oracle for areas and chords, and an absolute difference for sweeps. "Sweep" compares the current quarter-chord regression slope with the oracle quarter-chord sweep.

| Quantity | Wing (whole mesh, one-sided) current / oracle / diff | Drone wing region current / oracle / diff | Drone with winglets current / oracle / diff |
|---|---|---|---|
| Planform area, m² | 0.014389 / 0.024729 / **−41.8 %** | 0.640298 / 0.630508 / +1.6 % | 0.671741 / 0.630419 / +6.6 % |
| MAC, m | 0.083316 / 0.084191 / −1.0 % | 0.336299 / 0.332257 / +1.2 % | 0.329313 / 0.307580 / +7.1 % |
| Root chord, m | 0.041213 / 0.103139 / **−60.0 %** | 0.395004 / 0.392406 / +0.7 % | 0.394020 / 0.362424 / +8.7 % |
| Tip chord, m | 0.066717 / 0.061682 / +8.2 % | 0.202968 / 0.193848 / +4.7 % | 0.171002 / 0.099506 / +71.9 % |
| Quarter-chord sweep, deg | 7.97 / 6.46 / +1.51° | 19.58 / 24.93 / **−5.35°** | 20.82 / 26.07 / **−5.25°** |
| Dihedral, deg | −0.956 / −0.776 / −0.18° | 0.001 / −0.051 / +0.05° | 1.829 / 3.403 / −1.57° |
| Aspect ratio | 6.25 / 3.64 / +72 % | 6.15 / 6.24 / −1.5 % | 6.89 / 7.34 / −6.2 % |
| `valid` / warnings | true / "both skins" warning | true / none | true / none |

Wing oracle supporting values: leading-edge sweep 8.42°, taper 0.598, MAC 0.0842 m, root plane at lateral 0. The **projection identity** `0.5 Σ|n_v|·A` over the closed mesh gives 0.0247294 m², equal to the 400-station slice 0.0247294 m² to 9 digits. The prompt's wording ("half the sum … divided by two again") would give half of that; the measured identity is a single factor ½ (the upper and the lower skin each project the planform once). Both agree with the pre-checked range (24,730 and 24,783 mm², 0.2 % apart).

Oracle drone-wing details: 280 populated stations of 400, 120 bridged gap stations, none unpopulated outside the range; populated-only area 0.396627 m². With winglets: 290 populated, 110 bridged, populated-only 0.424684 m². The drone selections are not closed (1,738 and 1,304 boundary edges), so the projection identity is not applicable to them.

What the table says:

- **Wing (one-sided).** The current area is 42 % low and the root chord is 60 % low, because the code takes the "root" at mid-range when the lateral bounds do not straddle zero. No warning is raised and `valid` is true. P2-A must handle this.
- **Drone wing region.** Area, MAC and root chord are within 2 %, 1.5 % and 1 %, but the quarter-chord sweep is 5.35° low. The area agreement is a property of this fixture (it has dense vertices at every station), not evidence that the method is sound: the sweep error shows the station extraction is still off. The "expected to be wrong" statement therefore holds for the sweep and for the one-sided wing, not for the area on this region.
- **Winglets included.** The winglet changes the sampled vertex set and the tip chord (+72 %), the dihedral (−1.6°) and the area (+6.6 %). This is the sensitivity the prompt asked for. P2-A must say which one it wants (winglet handling is a recognition input question).
- The current output on the one-sided wing and on both drone regions is `valid: true`. That is the vacuous validity gate, DR-04, measured on new geometry.

## Cost of the current code (Node 24.21.0, load average about 1 at the start)

| Case | Parse | Map | Recognition (planform) | Topology | Peak RSS | Report JSON size |
|---|---:|---:|---:|---:|---:|---:|
| wing | 1.4 ms | 5.6 ms | 6.7 ms | 4.7 ms | 67 MB | n/a (small) |
| A320 whole mesh (timing only) | 22.6 ms | 39.9 ms | 99.7 ms | 384.7 ms | 361 MB | 21,461 B |
| drone wing region (448,142 tris) | 112.1 ms | 271.1 ms | 164.8 ms | 4,183 ms | 1,154 MB | 22,390 B |
| drone with winglets (542,112 tris) | 113.7 ms | 262.2 ms | 193.2 ms | 4,328 ms | 1,181 MB | 22,310 B |

Peak RSS is the whole Node process including the topology welder. The current report holds at most 120 stations (bin count is capped), so its JSON size is about 22 KB. P2-A raises the station count to `max(48, 4√n)`, so these sizes will grow, and that is the persistence-size measurement the prompt asks for. The A320 whole-mesh row is not a wing result: the `a320-all` case selects the whole aircraft (planform 329.9 m²) and is here for timing only. The A320 outboard-wing oracle (REC-V2, S = 22.66 m²) belongs to P2-A.

Topology of the drone (Node): 701,333 welded vertices, 2,104,251 edges, 6 boundary edges, 0 non-manifold edges, **10 connected components** (largest 345,186 triangles). The wing is one closed component (1,447 vertices, 0 boundary edges, 0 non-manifold). The A320 gives the known 28 boundary, 5 non-manifold edges, 1 component.

## Browser baseline (Claude in Chrome, user's Brave, current code)

Details in [browser-baseline.json](browser-baseline.json).

- **Wing.** Import at mm scale: 2,890 triangles, "Watertight mesh", VLM solved 17 cases with 64 panels, page responsive. Before assigning, the reference is the bounds seed (badge "Bounds seed - verify", S 0.026 m², b 0.300 m). After a one-click region grow at 90° (1,326 triangles, the upper surface) and "Assign wing": badge "Recognized wing", S 0.025 m², b 0.300 m, MAC 0.084 m, root chord 0.082 m, tip chord 0.083 m, sweep 6.43°. The root chord is the mid-span chord. Not timed (the first timing script was mine and timed out on the status text; the import itself finished in well under the 45 s tool window).
- **Drone.** Import at mm scale through the file input: fetch 110 ms; the geometry badge shows 1,402,832 triangles **11.1 s** after the change event; the status reads "VLM solved 17 cases with 384 panels (R1)" about 12 s after. The page is responsive afterwards (a `requestAnimationFrame` callback ran after 29 ms). JS heap 553 MB used (595 MB total). Mesh warnings in the page: 6 boundary edges and 10 disconnected components (equal to the Node topology). The reference before any assignment is the bounds seed: S 0.197 m², b 2.151 m, against the oracle S 0.6305 m² for the wing region. Mass was edited to 1 kg (placeholder). One click with region grow (90°, cap 600,000) selected 109,637 triangles in under 4 s. After "Assign wing", the page shows "Recognized wing" with S 0.249 m², b 0.836 m, MAC 0.315 m, sweep 25.19°, one half only, with no warning. This selection has no oracle, so it is an observation of the app's behaviour, not an accuracy figure. Heap 584 MB afterwards. No load hung (the 3-minute stop rule was not reached).
- A first click on the drone missed the mesh because the camera had moved after the mass edit. This is a test-driving detail, not an app defect.

## Findings from this phase (recorded in `QUEUE_STATE.json`, none fixed here)

- **F-1 (default mass, corrects the prompt).** The prompt says the 42,600 kg caution appears only when `sourceName === "samolot.stl"`. It does not: `src/massModel.js` (the `airframe-mesh` check at the 42,600 kg value) also adds the caution, and the browser shows it for both the wing and the drone. The 42,600 kg value is still applied silently to the physics: total mass, inertia and the stability inputs for any imported mesh, with a caution but no block. Same item as the DR-34, DR-36, DR-43 question in P2-E.
- **F-2 (half-wing displayed as the reference, no warning).** On the one-sided wing and on a one-sided drone selection the app shows "Recognized wing" with half-wing values (b 0.300 m for a 0.6 m full wing). The reference is then silently a half-wing. P2-A adds the half-wing warning.
- **F-3 (selection dependence, unexplained).** The current code gives S = 0.0144 m² for the whole wing mesh in Node and 0.025 m² for its upper-skin selection in the browser. The cause was not diagnosed (the planform method is replaced in P2-A). It shows the current result depends on which skin is chosen.
- **F-4 (per-pick behaviour).** Region growth honours a 90° limit and a 600,000 face cap in the browser, and 109,637 triangles took under 4 s on the drone. No performance problem observed for selection.

## Verification run

- `npm test` at HEAD: 30 files, **192 pass, 0 fail, 0 skipped**, exit 0, 106.4 s ([npm-test.tap](npm-test.tap), [npm-test.err](npm-test.err), `npm-test.exit`).
- `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` from the repository root: **192 pass, 0 fail, 0 skipped**, exit 0, 285.1 s ([combined.tap](combined.tap); load average 2.0 before, 1.3 after). An earlier attempt of mine ran the same command from inside this evidence directory and exited 1 with 190 pass, 2 fail: both failures are `ENOENT` on the cwd-relative path `assets/airbus-a320-cfd-1.snapshot.7/samolot.stl` (tests `demo STL regression metrics` and the 28/5/0/1 topology test). That was a wrong working directory, not a code failure. The output is kept as `wrong-cwd-combined.*` and is not the result of record.
- Node baselines: exit 0 for all four cases ([baseline-exits.txt](baseline-exits.txt); the wing run exited 0 in the foreground, its time file is [baseline-wing.time](baseline-wing.time)).
- Oracle: three runs, each under 1 s wall, self-check on a synthetic box wing (area 20) passed on every run.
- Skipped: nothing in this phase. No test file changed; none was required.

## Manifest

[phase-evidence.sha256](phase-evidence.sha256), made from the repository root:
`sha256sum -c docs/verification/drone-baseline-2026-11-07/phase-evidence.sha256`.
