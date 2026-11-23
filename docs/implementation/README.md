# Implementation Documentation

This directory holds the **implementation-continuity record** for the AirFLOW CFD
platform. It is maintained by the implementation engineer (MiMo-V2.6-Pro) as work
proceeds against the approved plan.

Document precedence (from [`../START_HERE.md`](../START_HERE.md)):

> `DATA_CONTRACTS` > `MASTER` > `PHASED` > `TEST MATRIX` > `HANDOFF`.
> The documents in **`../audits/`** and **`../../refs/`** are **immutable historical
> evidence** and are never edited here. Implementation findings that contradict a
> review finding are logged in [`ISSUE_AND_DECISION_LOG.md`](ISSUE_AND_DECISION_LOG.md)
> with evidence, never by changing the review.

## Files

| File | Role | Mutability |
|---|---|---|
| [`CURRENT_HANDOFF.md`](CURRENT_HANDOFF.md) | **Canonical continuity checkpoint.** The single entry point for a fresh agent to resume. Rewritten each turn to describe the true current state. | Rewritten every turn |
| [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md) | Canonical status rollup across milestones (planned / implemented / tested / validated / blocked / deferred). | Updated per phase |
| [`IMPLEMENTATION_CHANGELOG.md`](IMPLEMENTATION_CHANGELOG.md) | Chronological record of completed phases from the audited baseline: files changed, decisions, tests, results, commit refs. | Append-only |
| [`ISSUE_AND_DECISION_LOG.md`](ISSUE_AND_DECISION_LOG.md) | Defects found, discrepancies vs. review findings (with evidence + proposed corrections), and architectural / mathematical decisions. | Append-only |
| [`milestones/M0.md`](milestones/M0.md) | Per-milestone task tracker and acceptance-gate state. | Updated per task |

Per-milestone detail lives in `milestones/`; the rollup lives in
`IMPLEMENTATION_STATUS.md`; the chronological detail lives in
`IMPLEMENTATION_CHANGELOG.md`. These are kept in sync and are not duplicated.

## Versioning convention (lightweight)

- The **plan baseline** is **v1.0** (2026-10-23 audit). It is immutable.
- The **implementation** is tracked by **milestone + Git commit**. Every completed
  phase records its task IDs, the source commit, files changed, decisions, tests and
  observed results in [`IMPLEMENTATION_CHANGELOG.md`](IMPLEMENTATION_CHANGELOG.md).
- A version/revision label alone is never treated as proof of completion; the commit
  and the passing tests are the evidence.

## Rules

- Keep `../audits/**` and `../../refs/**` untouched.
- Keep exactly one canonical status and one canonical handoff.
- Label every number as planned / implemented / tested / validated / blocked / deferred.
- Record limitations and unverified claims explicitly. Never present an unverified
  number as validated.
