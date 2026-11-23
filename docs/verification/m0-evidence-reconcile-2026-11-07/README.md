# M0-EVIDENCE-RECONCILE evidence (2026-11-07)

Documentation and evidence review. No production or test file changed in this phase. The ledger is [LEDGER.md](LEDGER.md). It links the SOL-02/IA-01/IA-05, IA-02 and SOL-08/IA-03 conditions to their sources, evidence classes, observed outcomes and remaining gaps. Branch `impl/m0`, HEAD `6c625a31f43892f71581fac8cde5a02a4ec9f168`. The tree is uncommitted, and the index is empty. The handoff is [CURRENT_HANDOFF.md](../../implementation/CURRENT_HANDOFF.md). G0 remains BLOCKED. No finding is closed.

## Entry and integrity checks

| Check | Result |
|---|---|
| Branch and HEAD | `impl/m0` at `6c625a31f43892f71581fac8cde5a02a4ec9f168`, unchanged from the M0-REVERIFY-4 handoff |
| Index | empty (`index-at-finish-of-analysis.txt`) |
| Tracked diff | 11 files: M0-REVERIFY-3 `src/vlmSolver.js` (8 lines) and `tests/aud1.test.mjs` (+30), plus M0-REVERIFY-3/4 and this phase's records ([status](status-at-finish-of-analysis.txt), [diff stat](diff-stat-at-finish-of-analysis.txt)) |
| Tested executables | `tested-executables-check.txt`: 46 of 46 OK, exit 0 (from the repository root) |
| M0-REVERIFY-4 phase evidence | `m0-reverify-4-phase-evidence-check.txt`: 93 of 93 OK, exit 0 |
| Agent instruction files | none in the repository at this revision |

## Commands and results

Run by [run-verification.sh](run-verification.sh), sequentially and without overlap. Its outputs are the `.tap`, `.err`, `.exit` and `.time` files.

| Command | Input files | Individual results | Wall time | Exit |
|---|---:|---|---:|---:|
| `node --test --test-isolation=none --test-reporter=tap tests/aud1.test.mjs tests/aud2.test.mjs tests/rem3a.test.mjs tests/rem3b*.test.mjs` ([`targeted.tap`](targeted.tap)) | 19 | 59 pass, 0 fail, 0 skipped, 0 cancelled | 22.27 s | 0 |
| `npm test`, which runs `node --test tests/*.test.mjs` ([`npm.tap`](npm.tap)) | 29 | 160 pass, 0 fail, 0 skipped | 26.00 s | 0 |
| `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs` ([`combined.tap`](combined.tap)) | 29 | 160 pass, 0 fail, 0 skipped | 208.69 s | 0 |

The exact combined runner did not time out, and no workaround or profiling was used. VLM-V2 matched-lift took 43.23 s, which is ordinary variation against earlier runs of 39.46 to 42.09 s. A `run-verification.done` marker records completion. No tests were added or changed in this phase.

## Independent oracle (E1)

```text
python3 -I docs/verification/m0-reverify-4-2026-11-06/oracle.py docs/verification/m0-reverify-4-2026-11-06/api-entry.jsonl.gz > oracle-reproduced.json
```

[`oracle-reproduced.json`](oracle-reproduced.json) is byte-identical to the retained `oracle-entry.json`. Eleven constructed comparisons and five real-flow states pass. Maximum errors: slope 6.67e-17 (tolerance 1e-14 relative), ordinary absolute delta 2.44e-16 (1e-15), large relative delta 1.19e-16 (1e-14).

## Browser download recheck (E3)

```text
node docs/verification/m0-reverify-4-2026-11-06/check-browser.mjs /home/tanvir/Downloads > browser-downloads-recheck.json
```

Exit 0 ([`browser-downloads-recheck.json`](browser-downloads-recheck.json)). It checks four project and result pairs for the prescribed and custom grids at S = 3e-307 and 2e-307 m². Its baseline is the M0-REVERIFY-3 final pairs. All eight download hashes match the M0-REVERIFY-4 record, which was checked separately in this phase. The browser Run itself was not repeated.

## Constructed API probes (E2)

[`ledger-probes.mjs`](ledger-probes.mjs) runs the independent-audit fixtures (IA-01, IA-03, IA-05, SOL-02) against a solver module passed as an argument. It writes JSON to stdout and changes no frozen result. Three solver copies were run:

| Output | Solver | What it shows |
|---|---|---|
| [`ledger-probes-working-tree.json`](ledger-probes-working-tree.json) | working tree | IA-01 amber and withheld, with null deltas. The IA-03 label is withheld on all four fixtures. The IA-05 moved canard and wake changes alter the identity, and the seed flag is distinct. β = 5° is amber with 1.7524 % and 5.1707 %. The custom 1×4 comparison is amber at 3.6886 % and 4.1448 %. |
| [`ledger-probes-head-control.json`](ledger-probes-head-control.json) | `git show HEAD:src/vlmSolver.js` (`6c625a3`) | Identical to the working tree on these fixtures, as expected: the uncommitted change touches only the signed-overflow path. |
| [`ledger-probes-pre-remediation-control.json`](ledger-probes-pre-remediation-control.json) | `git show 9a66316:src/vlmSolver.js`, the audited commit | Reproduces the defects. IA-01 is green with ΔC_Lα 0.002815183047210505 and ΔC_Di 0.009969859818699689 (the audit's 0.2815 % and 0.9970 %). The legacy ±5 %/±8 % label appears on all four IA-03 fixtures and on the zero-yaw comparison. The moved canard gives an identical identity, the wake length is not recorded, and the seed `true` equals `false`. |

The control solver copies live in the scratchpad, not in the repository. Their creation commands are in [LEDGER.md](LEDGER.md). The 12×48 IA-03 value differs at the ULP level between the audited commit and the working tree (0.32780813008741144 against 0.32780813008741133). This comes from the REM-3b-R frame change and is recorded, not tolerated.

### Extreme-reference refusal (limit L8)

[`extreme-fit-refusal-probe.mjs`](extreme-fit-refusal-probe.mjs) → [`extreme-fit-refusal-probe.json`](extreme-fit-refusal-probe.json). At S = 3e-307 m² and 2e-307 m², a three-sample sweep (0/2/4°) throws "Nonfinite sweep fit or stability output produced by VLM inputs." A two-sample sweep (0/4°) returns with the fit null. The comparison returns, green at 3e-307 and amber-withheld at 2e-307. This is a recorded limit, and the owner decision is D3 in the ledger.

## Export boundary (E2 and E3)

The frozen AUD-2 probe ([`../aud-2-2026-11-06/app-post.json`](../aud-2-2026-11-06/app-post.json)) was checked in this phase. Its invalid-sweep export is JSON with `availability: "withheld"` and null values, and the pre-fix literal 0.9448874856350236 does not appear in it. The eight browser downloads carry provenance, coverage and comparison validity, as described in the ledger (L6).

## Not run in this phase

- Browser Run, including β ≠ 0 and the IA-01 invalid fixture. Browser export of an invalid sweep. Restore → solve → export.
- Frozen replay. The phase changed no executable, and the M0-REVERIFY-4 replay still stands. Its expected stops and unreached checks are listed in the ledger (L9).
- Exhaustive identity-field enumeration.

## Manifest

[`phase-evidence.sha256`](phase-evidence.sha256) lists the SHA-256 of every file in this directory, except itself. Verify it from the repository root with `sha256sum -c docs/verification/m0-evidence-reconcile-2026-11-07/phase-evidence.sha256`.
