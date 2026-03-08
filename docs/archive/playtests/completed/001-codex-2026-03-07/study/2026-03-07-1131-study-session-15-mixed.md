# Playthrough Report — Study Session

## Metadata
- Date: 2026-03-07 11:31 UTC
- Mode: `studySession` (Playwright scripted run)
- Scenario: 15 cards mixed states (5 review, 4 learning, 3 relearning, 3 new)
- Session size: Deep session (20 selected, 15 queued)
- Duration: ~28 seconds active session
- Interaction cap policy: stop if >220 interactions (not hit)

## Run Status
- Result: **PASS**
- Completion: Full session completed and returned to base
- Total interactions: 36
- Ratings used: Again=2, Good (Easy-equivalent)=2, Okay=13
- Processed cards: 17 total answers (15 initial + 2 requeued from Again)

## Starting Queue Validation

| Metric | Value |
|---|---|
| Queue length at start | 15 |
| Review cards | 5 |
| Learning cards | 4 |
| Relearning cards | 3 |
| New cards | 3 |

## Session Log Summary
- First 5 cards were review cards (`cult-004`, `cult-001`, `cult-002`, `cult-003`, `cult-005`)
- Again applied to `cult-004` and `cult-001`; both were re-queued and answered later with Okay
- Good applied to `cult-002` and `cult-003`
- Remaining cards answered with Okay, including learning/relearning/new transitions
- End screen `Memory Strengthened!` shown; `Return to Base` worked; final screen was `base`

## SM-2 Transition Checks

| Check | Expected | Observed | Result |
|---|---|---|---|
| Review + Again (`cult-004`) | Ease drop, lapse increment, repetition reset | ease 2.7→2.5, lapse 0→1, reps 6→0 | PASS |
| Review + Again (`cult-001`) | Ease drop, lapse increment, repetition reset | ease 2.5→2.3, lapse 0→1, reps 3→0 | PASS |
| Review + Good (`cult-002`) | Interval growth, reps +1, ease increase | interval 5→17, reps 4→5, ease 2.55→2.70 | PASS |
| Review + Good (`cult-003`) | Interval growth, reps +1, ease increase | interval 8→25, reps 5→6, ease 2.4→2.55 | PASS |
| New + Okay (`geo-003/004/005`) | Enter learning step 1 | all moved new→learning, learningStep 0→1 | PASS |
| Learning + Okay (`cult-006/008`) | Advance learning step | learningStep 0→1 on both | PASS |
| Relearning + Okay (`cult-010`, `geo-001`, `geo-002`) | Promote back toward review | all ended in review state | PASS |

## Issues Table

| # | Severity | Category | Description | Evidence |
|---|---|---|---|---|
| 1 | LOW | infra | Vite HMR websocket connection refused in headless run | Console: `failed to connect to websocket` |
| 2 | LOW | backend | Facts API CORS failures on `:3001` during local run | Console: `No 'Access-Control-Allow-Origin' header` |
| 3 | LOW | backend | Analytics endpoint preflight blocked by CORS | Console: `/api/analytics/events` preflight failure |

## Artifacts
- Completion screenshot: `/tmp/study-complete-final.png`
- Raw run data: `/tmp/study-playthrough-result.json`

## Verdict
- Study session protocol executed successfully for the requested mixed-state 15-card scenario.
- Required rating coverage met: >=2 Again and >=2 Easy-equivalent ratings (Good).
