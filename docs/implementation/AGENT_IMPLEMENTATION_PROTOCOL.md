# AirFLOW agent implementation protocol

Use this protocol for each bounded implementation phase. Intended configuration:
Codex, GPT-6.1 Terra, reasoning effort `xhigh`. Model and effort are selected in
the host; prompt text does not change the running model.

## Mission and working style

Continue AirFLOW's approved M0/Tier-0 implementation until its acceptance
conditions can be independently reviewed. Implement the phase assigned by
`NEXT_CONVERSATION_PROMPT.md`; do not stop at a plan or diagnostic report.
Make routine reversible implementation decisions autonomously. Ask only for a
material missing requirement, an actual authority conflict, or an action outside
the authorized scope. Assign a meaningful, coherent phase or group of closely
related tasks: broad enough to resolve the underlying problem and its affected
boundaries, but bounded enough to review and verify. Pursue the assigned scope
through implementation and acceptance evidence; do not stop after an isolated
small fix while independent, authorized work toward the same objective remains.
Investigate root causes, alternative explanations and counterexamples, and
perform a scientific audit or independent derivation when the problem warrants
it. Operational limits and partial tests are not scientific acceptance.

Continue until the assigned scope is complete or a concrete limitation prevents
further meaningful progress. If partial, document what was tried, why the work
remains unresolved, the strongest evidence, and an actionable next investigation;
do not repeatedly defer the same task without a new hypothesis or approach.
Finish verification and handoff, then provide the next conversation's complete
prompt with a similarly meaningful scope. Do not start a separately excluded
phase or milestone without authorization.

When the same substantive blocker remains unresolved across several sessions,
review the previous attempts and consider asking the user for an independent
GPT-6.1 Sol audit or a Sol-configured run instead of another Terra continuation.
Explain the recurring blocker, evidence and a concrete audit question; continue
any independent authorized work first. The user selects the model in the host;
prompt text cannot change it. A Sol audit is not a substitute for implementation,
acceptance evidence, or required independent re-verification.

## Start every conversation from evidence

1. Read applicable `AGENTS.md` instructions. Inspect `git status`, branch,
   recent history, and existing diffs before editing. Preserve pre-existing work.
2. Read `docs/START_HERE.md`, then `docs/implementation/CURRENT_HANDOFF.md` and
   `docs/implementation/NEXT_CONVERSATION_PROMPT.md`. Verify their revision and
   completion claims against source, history, and tests; do not treat them as proof.
3. Apply plan precedence:
   `docs/architecture/DATA_CONTRACTS_AND_PIPELINE.md` >
   `docs/plans/MASTER_REVISED_PROJECT_PLAN.md` >
   `docs/plans/PHASED_IMPLEMENTATION_PLAN.md` >
   `docs/plans/VALIDATION_AND_TEST_MATRIX.md` >
   `docs/plans/IMPLEMENTATION_HANDOFF.md`.
4. Read the phase-relevant parts of the binding review and evidence:
   - `docs/verification/sol/REVIEW.md` and its preserved scripts/results;
   - `docs/implementation/SOL_FINDING_DISPOSITIONS.md`;
   - `docs/audits/DISCREPANCY_REGISTER.md`;
   - `docs/verification/independent-2026-11-06/REPORT.md` and relevant probes;
   - current milestone tracker, status, decision log, and changelog.
5. If the assigned phase was already completed, verify its acceptance evidence
   before selecting the first genuinely unfinished phase from the handoff.
   Do not repeat completed work or skip unresolved acceptance conditions.

Reviews supply counterexamples and additional acceptance conditions; they do
not silently rewrite the normative contract. Record a conflict and its evidence
in the decision log. Implement conservative withholding/quarantine within the
existing contract when possible; do not invent new scientific acceptance bands.

## Implementation and verification loop

1. Reproduce the phase's counterexamples before changes. Record actual commands,
   outputs, parameters, and relevant revision/working-tree state in a new
   phase-specific evidence directory. Use bounded timeouts for hang probes.
2. Trace each change through requirement -> finding/task ID -> source -> test
   -> measured result. Add a regression that fails for the reproduced defect.
   Do not require a red test for a documentation-only correction.
3. Make the smallest coherent correction, including callers, displays, exports,
   and persistence affected by that correction. Reuse the existing architecture;
   avoid unrelated refactors, UI redesign, and new dependencies.
4. For numerical changes, derive independent expected values in oracle code that
   neither imports nor reads the implementation under test. Keep production
   measurements separate. State tolerances and their authority before judging
   results. Distinguish agreement with the same method from external validation.
5. Never conceal a defect with absolute-valued drag, clipping, numerical floors,
   widened thresholds, changed golden values, or silent input coercion. Any
   necessary numerical policy change needs an explicit recorded derivation,
   tests, and disclosed limitations.
6. Run targeted regressions, then `npm test`. On this host, if the reporter
   reports test files, also run:
   `node --test --test-isolation=none --test-reporter=tap tests/*.test.mjs`.
   Report files and individual tests accurately; do not assume the old count.
7. Replay relevant frozen probes in a scratch mirror. Do not run scripts that
   overwrite frozen results in their repository directory. Explain expected
   stops, changed rows, and probes not reached; an expected failure is not a
   completed successful replay.
8. Test the integration boundary that originally failed, not only a helper.
   For UI/export changes, use meaningful automated boundary tests and a browser
   smoke test when available. If a browser check cannot run, name that gap;
   do not substitute a mocked function check and call it browser verification.
9. Review the final diff for unintended physics/threshold changes, regressions,
   incomplete call sites, and claims unsupported by measured evidence. Do not
   claim independent review of your own implementation.

Keep `docs/verification/sol/**`,
`docs/verification/independent-2026-11-06/**`, `docs/audits/**`, approved
`docs/plans/**`, approved `docs/architecture/**`, `refs/**`, and `plan.md`
unchanged. Put corrections in implementation records and new versioned evidence
directories. Preserve historical failures rather than rewriting them as passes.

Do not begin M1–M8, implement CFD, merge into main, rewrite history, commit, or
push unless separately authorized. Leave reviewable changes and report their
exact state. No subagents are required; use them only if separately authorized
by the user or applicable repository instructions.

## Mandatory end-of-phase documentation

A phase is not complete until these records reflect the actual final tree:

- `docs/implementation/CURRENT_HANDOFF.md`: current snapshot, active phase,
  source revision plus uncommitted changes, implemented behavior, verification,
  limitations, outstanding findings, and the exact next bounded phase.
- `docs/implementation/NEXT_CONVERSATION_PROMPT.md`: a fresh, ready-to-paste
  prompt for the next phase. Archive the previous prompt under
  `docs/implementation/continuation-prompts/` with a unique phase/date filename
  before replacing it. Keep the new prompt consistent with the handoff.
- `docs/implementation/IMPLEMENTATION_STATUS.md` and
  `docs/implementation/milestones/M0.md`: update task and gate state accurately.
- `docs/implementation/IMPLEMENTATION_CHANGELOG.md`: what changed, why,
  validation, and remaining limitations.
- `docs/implementation/ISSUE_AND_DECISION_LOG.md`: material decisions,
  contract conflicts, new failures, and their evidence.
- `docs/implementation/SOL_FINDING_DISPOSITIONS.md`: affected SOL findings,
  linked IA findings, remediation and acceptance evidence. Use
  **implemented/tested, pending independent re-verification** when appropriate.
  Do not close independent findings yourself or clear G0.
- `CALCULATION_PIPELINE.md` and `MVP_METHODOLOGY.md`: update behavior changed
  by this phase; do not postpone newly stale method descriptions to M0-16.

If a record needs no change, say so rather than adding meaningless edits.
Always update and link the canonical handoff and next-conversation prompt,
including after a blocked or partially completed phase. On interruption, write
an honest checkpoint naming unfinished code/tests and a safe resume command.
Never mark partially tested work complete merely to produce a clean handoff.

The handoff must name exact commands/results, tolerances, evidence paths,
modified and pre-existing files, known blockers, unverified claims, and whether
there is a commit or only a working-tree diff. Identify any required
user-controlled or independent-review action without implying it occurred.

## Required final response after every phase

Return, in this order:

1. **Outcome:** phase ID, implemented behavior, and completion/partial/blocked
   status, with any material limitation.
2. **Verification:** actual test counts/results and independent-oracle results;
   explicitly name skipped or unavailable checks.
3. **Findings/gate:** which findings were addressed, which remain, and G0 state.
4. **Handoff:** clickable absolute links to the updated canonical handoff,
   phase evidence, and next-conversation prompt.
5. **Fresh next-conversation prompt:** the full copyable prompt text, not
   “continue from the handoff” and not only a file link.

Every fresh prompt must state the selected model/effort, workspace, instruction
and reading order, verified repository state and local changes, next phase ID,
specific implementation scope, acceptance tests, exclusions, unresolved
findings, and this same mandatory handoff/prompt obligation. It must work in a
new conversation with access to the repository and no prior chat history. Give
the next agent a meaningful coherent scope and require sustained investigation,
implementation and verification as above. Where a blocker has recurred across
several sessions, include prior attempts and a concrete Sol-audit question or
recommend a Sol-configured run when justified; do not claim the model was changed.

## Remaining-work sequence

Use this as an execution sequence within approved M0, not a replacement plan.
Record changed dependencies and split large phases into named bounded parts.

1. **AUD-1:** IA-01/IA-05 — resolution quarantine, complete input identity, and
   comparison validity/coverage at API and UI boundaries.
2. **AUD-2:** IA-02 — quarantine-safe exports and required provenance.
3. **REM-3 bounded parts:** IA-03/SOL-05/SOL-08 benchmark sidecar, enforceable
   comparison envelope and label scope; IA-04/IA-07 missing-input validation and
   bounded sweep/resource handling; unresolved proximity/elliptic science.
   Separate claim scoping, API robustness, and scientific investigation rather
   than bundling them into one unreviewable change.
4. **M0a bounded parts:** M0-6/7 slicing and recognition validity; remaining
   M0-8 verdict/mass/pitch safeguards; M0-9 identity/restore; M0-11..14
   staleness/degraded mode/import/labels. Fix the documented stale-pitch path in
   the corresponding display phase.
5. **M0-15/16 and G0 evidence:** hygiene within authorized scope, current
   method docs, missing acceptance coverage (including VLM-V4/V9 scheduling
   reconciliation), generated demo report, and a package for independent review.

G0 remains blocked until the governing gate and independent review conditions
are actually met. Do not infer scientific validation from test-suite success.
