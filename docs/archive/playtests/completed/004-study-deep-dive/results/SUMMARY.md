# Batch 004 Summary: Study System Deep Dive

## Verdict Table

| Q | Title | Verdict | Report |
|---|---|---|---|
| Q1 | Leech Rescue Mission | FAIL | q01-leech-rescue.md |
| Q2 | Activation Cap Ceiling | PASS | q02-activation-cap.md |
| Q3 | Re-Queue Frustration Test | PASS | q03-requeue-frustration.md |
| Q4 | Seven-Day SM-2 Drift | INCONCLUSIVE | q04-sm2-drift.md |
| Q5 | Morning/Evening Ritual Motivation | PASS | q05-ritual-motivation.md |
| Q6 | Category Interleaving Quality | PASS | q06-category-interleaving.md |
| Q7 | Mnemonic Escalation Path | FAIL | q07-mnemonic-escalation.md |
| Q8 | High-Backlog Throttle Experience | PASS | q08-backlog-throttle.md |
| Q9 | Consistency Penalty Cross-System | INCONCLUSIVE | q09-consistency-penalty.md |
| Q10 | Study Score Feedback Loop | FAIL | q10-study-score.md |

## Confirmed Findings

### Working Well
- Activation cap logic and cap-increase formula are functioning with clear blocked-state UI.
- Re-queue bounds feel controlled (no runaway repetition in sampled test).
- Ritual windows correctly grant morning/evening bonuses and suppress rewards outside windows.
- Backlog-based new-card throttle and recovery behavior match adaptive-limit expectations.

### Gaps / Risks
- Leech rescue flow was not reproducible end-to-end in this run (no suspended candidates from seeded near-leech state).
- Mnemonic escalation path was not observable in sampled forced quiz loop.
- Cross-system consistency penalty could not be validated due non-deterministic quiz targeting.
- Study score neglect phase appeared under-sensitive (no drop across 3 no-study days in tested profile).
- 7-day SM-2 drift run lacked sustained due workload after day 1 in this harness setup.

## Top 5 Actionable Improvements

1. Add deterministic playtest hooks: `forceQuizForFact(factId)` and/or deterministic study queue seeding.
2. Add explicit user-facing messaging for backlog throttle suppression (why new cards are hidden).
3. Strengthen leech-path observability in API (expose suspended count and transitions directly).
4. Revisit study-score neglect decay so 2-3 days of inactivity reliably lowers score.
5. Add a robust long-horizon drift fixture that guarantees daily due-card workload for 7-day simulations.

## Overall Readiness Grade (Study System)

**C+**

The core study experience is usable and several major systems are working, but key high-stakes paths (leech rescue, escalation, consistency, long-horizon drift) are not yet reliably testable or consistently verifiable in automation.
