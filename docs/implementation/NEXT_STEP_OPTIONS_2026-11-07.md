# Queue P2 progress (updated each phase)

Running the M0 queue in [QUEUE_PROMPT_P2_v2_2026-11-07.md](QUEUE_PROMPT_P2_v2_2026-11-07.md); state in [QUEUE_STATE.json](QUEUE_STATE.json). **P2-0 (baselines) done: evidence only.** Next: P2-A (option 2 below). Options 1 and 7 to 11 are outside the queue and unchanged.

# Next-step options after M0-EVIDENCE-GAP-CLOSE (2026-11-07)

Review of the phased plan ([PHASED_IMPLEMENTATION_PLAN.md](../plans/PHASED_IMPLEMENTATION_PLAN.md)), the master plan's owner questions ([MASTER §7](../plans/MASTER_REVISED_PROJECT_PLAN.md)), the M0 tracker ([milestones/M0.md](milestones/M0.md)) and the review records. Nothing here changes an approved plan. Gate state: **G0 BLOCKED**.

## Where the work stands

- **M0b (VLM numerics):** M0-1 to M0-5 are tested and await independent re-verification. M0-16 (VLM documentation) is open.
- **M0a (quarantine and app correctness):** M0-10 is tested. M0-6, M0-7, M0-8, M0-9, M0-11 to M0-15 and M0-16 (demo report and documentation) are planned.
- **Independent conditions still open:** IA-06 (recognition and stale or pitch display), IA-08 (stale documentation), the remaining SOL-07 safeguards, proximity and elliptic science. The fixed uncertainty claim (SOL-08) stays withheld, and its policy is owner decision D1.
- **Owner decisions pending:** D1 to D4 from the reconciliation (fixed-claim policy, JSON-only export, extreme-reference refusal, commit traceability). Master-plan questions: Q-1 blocks M1b, M2 and M3. Q-4 blocks M4a. Q-2 blocks M6. Q-3 (compute budget) and Q-7 (licence of the demo STL) are also open.
- **Working tree:** the gap-closure identity test and evidence are uncommitted on top of `dd7b2c5`.
- **Findings from this phase:**
  1. A failed Run leaves the old polar and pitch curves on screen (confirmed in the user's Brave). This is SOL-07 item 3 and M0-11.
  2. Without WebGL the app does not start (confirmed in the built-in pane). M0-12 covers this.
  3. The solver refuses a small canard incidence on an explicit 8-strip lattice with a negative Trefftz drag. This needs independent scientific review, not a quick code change.

## Options

| # | Option | Gate or owner input | Size | What it closes | Recommendation |
|---|---|---|---|---|---|
| 1 | **Decide D1–D4 and commit the working tree** | Owner | Small | Traceability of the tested solver change; the records that say "uncommitted" | Do first. It is needed before any new phase lands on a clean base. |
| 2 | **M0-6 and M0-7: planform by slicing and the recognition validity gate** | None | Medium | DR-03 (wing area −63 %), DR-04 (vacuous validity). Tests REC-V1 to REC-V3 | **Recommended next phase.** Highest-severity wrong number, and it needs no owner input. |
| 3 | **M0-11 and M0-12: stale-result view model and degraded mode** | None | Medium | DR-23 and DR-24. The stale curves and the WebGL startup failure seen in this phase. Tests VM-T2, UI-T1 | Strong second. It fixes behaviour observed in the browser. |
| 4 | **M0-8: stability verdict gating and pitch-plot hiding** | None (reads DATA_CONTRACTS §2.5) | Medium | DR-05, DR-06; SOL-07 items 1 and 2 | Third in the M0a order. The pitch plot is non-physical and must not be shown. |
| 5 | **M0-9: hash module and project restore validation** | None | Medium | DR-07, DR-08, DR-45. Needed before M1a | Needed before M1a. Can follow option 2. |
| 6 | **M0-13, M0-14, M0-15, M0-16: non-finite vertices, labels, hygiene, demo report** | Owner approval for the `reference/xflr5` gitlink removal | Small to medium | DR-27, DR-34, DR-36, DR-43, DR-37, DR-38, DR-40; DEC-14 | Last in M0, because the demo report must be regenerated after the earlier fixes. |
| 7 | **Solver investigation: Trefftz negative drag for small canard incidence** | Independent review recommended | Unknown | A solver refusal of physically ordinary input. Needs its own reproduction and derivation | Ask an independent GPT-6.1 Sol audit first. Do not fix it inside a display phase. |
| 8 | **Independent GPT-6.1 Sol re-verification of the M0 conditions** | The user selects the model in the host | Review, not implementation | G0 requires it ([REVIEW §8](../verification/sol/REVIEW.md)). Covers M0-1 to M0-5 and the fixes above | Request after options 2 to 6. Include the SOL-08 envelope question. |
| 9 | **Start M1a (core contracts)** | G0 by the plan's prerequisites (M0-9 and M0-10 are the stated inputs) | Large | Topology core, hashing, surface model, spatial index, selection, import, schemas | Not yet. It waits for G0. |
| 10 | **M1b, M2, M3** | Q-1 | Large | Interaction, parametric geometry, domain and export | Blocked until Q-1 is answered. |
| 11 | **M4a: OpenFOAM pin and 2-D NACA 0012 case** | Q-4 (permission and install method) | Large | Solver baseline. Independent of M0 | Can run in parallel with M0 once Q-4 is answered. |

## Suggested order

1. Option 1 (decisions and commit).
2. Option 2 (M0-6 and M0-7), with its own bounded prompt.
3. Option 3 (M0-11 and M0-12). Browser checks through Claude in Chrome, which is now connected to the user's Brave.
4. Option 5 and then option 4 (M0-9, then M0-8).
5. Option 6 (M0-13 to M0-16), including the demo report.
6. Option 7 as an independent audit question, in parallel with 5 and 6 if the owner wants it.
7. Option 8 (independent Sol re-verification), then the G0 decision.
8. Options 9 to 11 only after G0 or after the owner answers the relevant question.

## Recurring blockers

- **SOL-08 envelope (D1):** open since REM-1. The audit question is in the [ledger](../verification/m0-evidence-reconcile-2026-11-07/LEDGER.md), under recurring blockers.
- **Independent review of M0-1 to M0-5 and the M0-REVERIFY series:** still pending. A Sol-configured run is the route the protocol recommends when a blocker recurs.
