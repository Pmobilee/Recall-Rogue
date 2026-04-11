# llm-playtest — Output Artifacts & Report Formats

**Parent skill:** [`../SKILL.md`](../SKILL.md) — `/llm-playtest`
**Covers:** Output directory layout, manifest.json structure, per-tester report format (one section per profile), combined SUMMARY.md format, and registry stamping commands.

---

## Output Directory Layout

All batch output is stored in:
```
data/playtests/llm-batches/
  BATCH-YYYY-MM-DD-NNN/
    manifest.json         — batch metadata and status
    quiz-quality.md       — Quiz Quality tester report
    balance-curve.md      — Balance Curve tester report
    fun-engagement.md     — Fun/Engagement tester report
    study-temple.md       — Study Temple tester report
    full-run.md           — Full Run Bug Hunter report (if fullrun tester requested)
    SUMMARY.md            — Aggregated cross-tester summary
```

Batch IDs use format `BATCH-YYYY-MM-DD-NNN` (e.g., `BATCH-2026-03-27-001`). NNN increments per day.

The warm Docker container's per-action output lives in `/tmp/rr-docker-visual/llm-playtest-${BATCH_ID}_*/` and includes `result.json`, all `<name>.png` + `<name>.layout.txt` files from `rrScreenshot` actions, and per-batch stdout/stderr logs. These are NOT committed — they're diagnostic output for the current batch only.

---

## manifest.json Structure

```json
{
  "batchId": "BATCH-2026-03-27-001",
  "createdAt": "2026-03-27T10:00:00Z",
  "testers": ["quiz-quality", "balance-curve", "fun-engagement", "study-temple", "full-run"],
  "args": {
    "runs": 3,
    "domain": "general_knowledge"
  },
  "status": "running",
  "smokeTestPassed": true,
  "reports": {
    "quiz-quality": { "status": "complete", "verdict": "ISSUES", "criticalCount": 0, "highCount": 2 }
  }
}
```

Status values: `"running"`, `"complete"`, `"aborted"`.

After each tester completes, the orchestrator updates the `reports[<tester-name>]` entry with:

- `status` — `"complete"` | `"failed"` | `"skipped"`
- `verdict` — `"PASS"` | `"ISSUES"` | `"FAIL"`
- `criticalCount`, `highCount`, `mediumCount`, `lowCount` — issue counts from the tester's report

When all testers finish, set top-level `status: "complete"`.

---

## Quiz Quality Report Format

Path: `{BATCH_DIR}/quiz-quality.md`

```markdown
# Quiz Quality Report — {BATCH_ID}
**Tester**: Quiz Quality | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters**: {N}

## Verdict: {PASS | ISSUES | FAIL}
(FAIL if any CRITICAL issues found; ISSUES if any HIGH issues found; PASS otherwise)

## Summary
- Total quizzes captured: N
- Quizzes with full data (choices[]): N
- Quizzes with question text only: N
- Domains represented: [list]

## Objective Findings
| Check | Result | Pass Count | Fail Count | Notes |
|-------|--------|------------|------------|-------|
| O-QZ1 | PASS | 23/23 | 0/23 | |
| O-QZ2 | PASS | 23/23 | 0/23 | |
| O-QZ3 | FAIL | 21/23 | 2/23 | Two questions contained "undefined" in choice text |
...

## Subjective Assessments
| Check | Rating (1-5) | Representative Examples | Issues Found |
|-------|-------------|------------------------|-------------|
| S-QZ1 Distractor Plausibility | 3/5 | "Q: Capital of France? Wrong: Germany" — Germany is not a plausible city name | Distractors often wrong category (country vs city) |
...

## Issues Found

### CRITICAL
(none)

### HIGH
- **O-QZ3 Artifacts**: 2 quizzes found with "undefined" in choice text
  - Question: "What is the largest planet?" | Choices: ["Jupiter", "undefined", "Saturn"]
  - Question: "Who wrote Hamlet?" | Choices: ["Shakespeare", "null", "Marlowe"]

### MEDIUM
- **S-QZ1 Distractor Quality**: 7/23 quizzes (30%) have implausible distractors — answers that are clearly the wrong type (country names for city questions, animal names for plant questions)

### LOW
...

## Raw Quiz Data
```json
[
  { "question": "...", "choices": ["A", "B", "C"], "correctIndex": 0, "anomalies": [] },
  ...
]
```
```

---

## Balance Curve Report Format

Path: `{BATCH_DIR}/balance-curve.md`

```markdown
# Balance Curve Report — {BATCH_ID}
**Tester**: Balance Curve | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters**: {N_ACTUAL} | **Deaths**: {DEATHS}

## Verdict: {PASS | ISSUES | FAIL}

## Floor-by-Floor Data
| Floor | Encounter | Start HP | End HP | Enemy | Enemy Initial HP | Turns | Gold Earned |
|-------|-----------|----------|--------|-------|------------------|-------|-------------|
| 1 | 1 | 80/80 | 65/80 | Cave Bat | 40 | 4 | 15 |
...

## Damage Exchange Log
(Per-turn damage dealt/received table — include for first 2 encounters in detail)

## Objective Findings
| Check | Result | Measured Value | Expected Range | Notes |
|-------|--------|---------------|----------------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## Raw Run Data
```json
{ "runs": [...], "encounters": [...] }
```
```

---

## Fun/Engagement Report Format

Path: `{BATCH_DIR}/fun-engagement.md`

```markdown
# Fun/Engagement Report — {BATCH_ID}
**Tester**: Fun/Engagement | **Model**: sonnet | **Domain**: {DOMAIN} | **Encounters Played**: {N}

## Verdict: {PASS | ISSUES | FAIL}

## First Impressions
(Your immediate reaction to loading the game)

## Combat Narrative Log
### Encounter 1 (Floor {N}, vs {Enemy})
**Turn 1**: [cards available] → chose [card] because [reasoning] → result
**Turn 2**: ...
**Post-combat reaction**: ...

### Encounter 2...

## Decision Quality Analysis
(Which turns felt like genuine decisions vs obvious plays)
- Meaningful decisions: {N}/{TOTAL} turns
- "Obvious only one play" turns: {N}/{TOTAL} turns
- Dead turns (nothing useful): {N}/{TOTAL} turns

## Objective Findings
| Check | Result | Notes |
|-------|--------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## Notable Moments
(Specific moments that were particularly good or bad — the game designer wants these)
- [HIGHLIGHT] Turn 3 of encounter 2: playing a charge card and getting it right for a huge damage hit felt GREAT
- [LOWLIGHT] Mystery event text was confusing — not clear which option was better
```

---

## Study Temple Report Format

Path: `{BATCH_DIR}/study-temple.md`

```markdown
# Study Temple Report — {BATCH_ID}
**Tester**: Study Temple | **Model**: sonnet | **Domain**: {DOMAIN}

## Verdict: {PASS | ISSUES | FAIL}

## Session 1 Summary
- Cards studied: N
- "Again" graded: N (question list)
- "Hard" graded: N
- "Good" graded: N
- "Easy" graded: N
- Near-leech cards found: N

## Session 2 Summary (after +2 hours)
- Cards appeared: N
- "Again" cards that reappeared: N/N (expected: all)
- "Good" cards that reappeared: N/N (expected: 0)
- "Easy" cards that reappeared: N/N (expected: 0)

## SM-2 Scheduling Verdict
(PASS / FAIL with explanation)

## Content Quality Sample
| Question | Answer | Quality Notes |
|----------|--------|---------------|
| "..." | "..." | Good — clear Q and A |
| "..." | "..." | ISSUE: Answer appears to be wrong |

## Objective Findings
| Check | Result | Notes |
|-------|--------|-------|

## Subjective Assessments
| Check | Rating | Notes |
|-------|--------|-------|

## Issues Found
### CRITICAL
### HIGH
### MEDIUM
### LOW

## All Studied Cards (Raw)
```json
[{ "question": "...", "answer": "...", "graded": "good" }, ...]
```
```

---

## Full Run Bug Report Format

Path: `{BATCH_DIR}/full-run.md`

```markdown
# Full Run Bug Report — {BATCH_ID}
**Tester**: Full Run Bug Hunter | **Model**: sonnet | **Date**: {DATE}

## Run Summary
- **Floors attempted**: N / {FLOORS} target
- **Floors completed**: N
- **Total rooms visited**: N
- **Room types visited**: combat (N), shop (N), rest (N), mystery (N), boss (N), elite (N), reward (N)
- **Total combat encounters**: N
- **Run outcome**: victory / defeat / stuck / crash
- **Total bugs found**: N (critical: X, high: X, medium: X, low: X)

## Verdict: {PASS | ISSUES | FAIL}
(FAIL if any CRITICAL bugs; ISSUES if any HIGH bugs; PASS otherwise)

## Room Type Coverage
| Room Type | Visited? | Count | Working? | Notes |
|-----------|----------|-------|----------|-------|

## Screen Transition Log
| # | From Screen | To Screen | Expected | Match? | Layout Dump Anomalies |
|---|-------------|-----------|----------|--------|----------------------|

## Bugs Found

### CRITICAL
(Run-blocking crashes, infinite loops, data loss)

### HIGH
(Broken transitions, missing UI, incorrect game state)

### MEDIUM
(Visual glitches, minor state issues, non-blocking)

### LOW
(Polish issues, minor inconsistencies)

Each bug entry:
### BUG-NNN [SEVERITY] — Title
- **Screen**: where it happened
- **Action**: what triggered it
- **Expected**: what should have happened
- **Actual**: what actually happened
- **Evidence**: layout dump excerpt, debug state, console errors
- **Run State**: floor, HP, gold, encounters completed
- **Reproducible**: first occurrence / consistent / intermittent

## Per-Encounter Combat Log
| # | Floor | Enemy | Turns | HP Before | HP After | Gold Gained | Cards Played | Bugs |
|---|-------|-------|-------|-----------|----------|-------------|--------------|------|

## Layout Dump Anomaly Summary
Any layout dumps where elements were missing, overlapping incorrectly, or positioned outside viewport.

## Console Errors
All unique JS errors encountered (via __rrDebug().recentErrors).

## What Worked Well
List transitions and rooms that functioned correctly — confirms test coverage.
```

---

## Combined SUMMARY.md Format

Path: `{BATCH_DIR}/SUMMARY.md` — produced by Phase 3 aggregation.

```markdown
# Playtest Batch Summary — {BATCH_ID}
**Date**: {DATE} | **Testers**: {N} | **Domain**: {DOMAIN} | **Runs**: {RUNS}

## Overall Verdict: {PASS | ISSUES | FAIL}
(FAIL if any tester reports FAIL; ISSUES if any tester reports ISSUES; PASS only if all PASS)

## Tester Verdicts
| Tester | Verdict | Critical | High | Medium | Low |
|--------|---------|----------|------|--------|-----|
| Quiz Quality | PASS | 0 | 0 | 1 | 2 |
| Balance Curve | ISSUES | 0 | 1 | 2 | 1 |
| Fun/Engagement | PASS | 0 | 0 | 2 | 3 |
| Study Temple | PASS | 0 | 0 | 0 | 1 |
| Full Run | PASS | 0 | 0 | 0 | 0 |

## Cross-Tester Insights
(Issues found by multiple testers get escalated confidence)
- [CONVERGING] Quiz tester + Fun tester both flagged question clarity on floor 1 quizzes
- [SOLO] Balance tester found HP drain too fast in floor 2-3 — not yet corroborated

## All Issues by Severity

### CRITICAL
(none)

### HIGH
- [balance] Floor 2-3 HP drain exceeds safe recovery threshold — player near-dead by floor 3 without rest (Balance Curve)

### MEDIUM
...

### LOW
...

## Recommendations
1. {highest impact fix}
2. {second fix}
3. {third fix}

## Next Steps
- Run `/balance-sim` to get statistical confirmation of the HP drain issue
- Run `/visual-inspect` on combat screen to verify visual clarity of quiz UI
- Run `/inspect changed` if balance values are modified
```

---

## Registry Update (AUTO)

After LLM playtest batch completes, stamp elements encountered during play:
```bash
npx tsx scripts/registry/updater.ts --ids "{comma-separated encountered element IDs}" --type playtestDate
```

If the full game was played, stamp broadly:
```bash
npx tsx scripts/registry/updater.ts --table cards --type playtestDate
npx tsx scripts/registry/updater.ts --table screens --type playtestDate
```

This updates `data/inspection-registry.json` with the latest playtest timestamps per element.
