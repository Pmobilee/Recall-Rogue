# Study Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 2026-03-07-1131-study-session-15-mixed.md | — study session | FAIL |
| 20260307-1301-study-run-01-many_reviews_due-heavy-again.md | many reviews due heavy again | PASS |
| 20260307-1305-study-run-02-many_reviews_due-mixed-cadence.md | many reviews due mixed cadence | PASS |
| 20260307-1309-study-run-03-many_reviews_due-easy-streak.md | many reviews due easy streak | PASS |
| 20260307-1313-study-run-04-quiz_due-balanced.md | quiz due balanced | PASS |
| 20260307-1317-study-run-05-quiz_due-relearning-focus.md | quiz due relearning focus | PASS |
| 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new.md | quiz due backlog suppresses new | PASS |
| 20260307-1325-study-run-07-post_tutorial-new-player-first-pass.md | post tutorial new player first pass | PASS |
| 20260307-1329-study-run-08-post_tutorial-new-plus-learning.md | post tutorial new plus learning | PASS |
| 20260307-1333-study-run-09-post_tutorial-easy-streak.md | post tutorial easy streak | PASS |
| 20260307-1337-study-run-10-injected-leech-pressure.md | injected leech pressure | PASS |
| 20260307-1341-study-run-11-injected-mixed-state-chaos.md | injected mixed state chaos | PASS |
| 20260307-1345-study-run-12-injected-recovery-session.md | injected recovery session | PASS |
| 20260307-study-run-13-heavy-again.md | heavy again | PASS |
| 20260307-study-run-14-easy-streak.md | easy streak | PASS |
| 20260307-study-run-15-injected-mixed-states.md | Injected Mixed States | FAIL |
| 20260307-study-run-16-relearning-focus.md | relearning focus | FAIL |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- [pageerror] Error: WebSocket closed without opened.
  - Runs: 20260307-study-run-15-injected-mixed-states

- [vite] failed to connect to websocket (Error: WebSocket closed without opened.).
  - Runs: 20260307-study-run-15-injected-mixed-states

- Error samples:
  - Runs: 20260307-study-run-15-injected-mixed-states

- Failed to load resource: the server responded with a status of 404 (Not Found)
  - Runs: 20260307-study-run-15-injected-mixed-states

- Failed to load resource: the server responded with a status of 500 (Internal Server Error)
  - Runs: 20260307-study-run-15-injected-mixed-states

- WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
  - Runs: 20260307-study-run-15-injected-mixed-states

### MEDIUM

- None

### LOW

- 1 | LOW | infra | Vite HMR websocket connection refused in headless run | Console: `failed to connect to websocket`
  - Runs: 2026-03-07-1131-study-session-15-mixed

- 2 | LOW | backend | Facts API CORS failures on `:3001` during local run | Console: `No 'Access-Control-Allow-Origin' header`
  - Runs: 2026-03-07-1131-study-session-15-mixed

- 3 | LOW | backend | Analytics endpoint preflight blocked by CORS | Console: `/api/analytics/events` preflight failure
  - Runs: 2026-03-07-1131-study-session-15-mixed

### INFO

- # | Severity | Category | Description | Evidence
  - Runs: 2026-03-07-1131-study-session-15-mixed

- Console errors/page errors: 6
  - Runs: 20260307-study-run-15-injected-mixed-states

- Console warnings: 4
  - Runs: 20260307-study-run-15-injected-mixed-states

- Required rating coverage met: >=2 Again and >=2 Easy-equivalent ratings (Good).
  - Runs: 2026-03-07-1131-study-session-15-mixed

- Study session protocol executed successfully for the requested mixed-state 15-card scenario.
  - Runs: 2026-03-07-1131-study-session-15-mixed

## Metrics and State Trends

- # | Fact | Button | State | Lapse | Interval
  - Runs: 20260307-study-run-16-relearning-focus
- 1 | geo-001 | again | relearning -> relearning | 2 -> 2 | 9 -> 9
  - Runs: 20260307-study-run-16-relearning-focus
- 2 | cult-002 | again | relearning -> relearning | 4 -> 4 | 10 -> 10
  - Runs: 20260307-study-run-16-relearning-focus
- 3 | lsci-001 | good | relearning -> review | 6 -> 6 | 16 -> 11
  - Runs: 20260307-study-run-16-relearning-focus
- 4 | hist-001 | good | relearning -> review | 3 -> 3 | 11 -> 8
  - Runs: 20260307-study-run-16-relearning-focus
- 5 | cult-001 | good | relearning -> review | 3 -> 3 | 12 -> 8
  - Runs: 20260307-study-run-16-relearning-focus
- 6 | geo-001 | good | relearning -> review | 2 -> 2 | 9 -> 6
  - Runs: 20260307-study-run-16-relearning-focus
- 7 | cult-002 | good | relearning -> review | 4 -> 4 | 10 -> 7
  - Runs: 20260307-study-run-16-relearning-focus
- Card | Button | State | Reps | Ease | Interval
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again, 20260307-1305-study-run-02-many_reviews_due-mixed-cadence, 20260307-1309-study-run-03-many_reviews_due-easy-streak, 20260307-1313-study-run-04-quiz_due-balanced, 20260307-1317-study-run-05-quiz_due-relearning-focus, 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new, 20260307-1325-study-run-07-post_tutorial-new-player-first-pass, 20260307-1329-study-run-08-post_tutorial-new-plus-learning, 20260307-1333-study-run-09-post_tutorial-easy-streak, 20260307-1337-study-run-10-injected-leech-pressure, 20260307-1341-study-run-11-injected-mixed-state-chaos, 20260307-1345-study-run-12-injected-recovery-session, 20260307-study-run-13-heavy-again
- Check | Expected | Observed | Result
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Completion screen reached: yes
  - Runs: 20260307-study-run-15-injected-mixed-states
- cult-001 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d
  - Runs: 20260307-study-run-13-heavy-again
- cult-001 | again | review -> relearning | 6 -> 0 | 2.60 -> 2.40 | 21d -> 21d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- cult-002 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d
  - Runs: 20260307-study-run-13-heavy-again
- cult-003 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d
  - Runs: 20260307-study-run-13-heavy-again
- cult-004 | again | review -> relearning | 2 -> 0 | 2.50 -> 2.30 | 3d -> 3d
  - Runs: 20260307-study-run-13-heavy-again
- cult-004 | again | review -> relearning | 7 -> 0 | 2.50 -> 2.30 | 18d -> 18d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- cult-005 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d
  - Runs: 20260307-study-run-13-heavy-again
- cult-006 | good | review -> review | 2 -> 3 | 2.50 -> 2.65 | 3d -> 10d
  - Runs: 20260307-study-run-13-heavy-again
- cult-007 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d
  - Runs: 20260307-study-run-13-heavy-again
- cult-008 | good | review -> review | 5 -> 6 | 2.55 -> 2.70 | 12d -> 40d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- cult-008 | okay | review -> review | 2 -> 3 | 2.50 -> 2.50 | 3d -> 8d
  - Runs: 20260307-study-run-13-heavy-again
- cult-011 | good | review -> review | 6 -> 7 | 2.50 -> 2.65 | 24d -> 83d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- cult-012 | okay | review -> review | 5 -> 6 | 2.40 -> 2.40 | 16d -> 38d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- cult-020 | good | review -> review | 8 -> 9 | 2.70 -> 2.85 | 30d -> 105d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- cult-021 | good | review -> review | 9 -> 10 | 2.80 -> 2.95 | 45d -> 164d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- cult-024 | good | review -> review | 6 -> 7 | 2.55 -> 2.70 | 14d -> 46d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- cult-030 | okay | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- cult-031 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- cult-041 | again | review -> relearning | 4 -> 0 | 2.10 -> 1.90 | 8d -> 8d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- cult-042 | again | review -> suspended (leech-like) | 2 -> 0 | 1.50 -> 1.30 | 6d -> 6d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- cult-043 | okay | relearning -> review | 0 -> 0 | 1.90 -> 1.90 | 12d -> 8d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- cult-050 | okay | review -> review | 5 -> 6 | 2.50 -> 2.50 | 14d -> 35d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- cult-051 | good | review -> review | 6 -> 7 | 2.45 -> 2.60 | 18d -> 57d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- cult-100 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- cult-101 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- cult-110 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- cult-111 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- cult-120 | good | review -> review | 3 -> 4 | 2.40 -> 2.55 | 8d -> 27d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- cult-121 | okay | review -> review | 2 -> 3 | 2.30 -> 2.30 | 6d -> 14d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- cult-130 | again | review -> suspended (leech-like) | 5 -> 0 | 1.60 -> 1.40 | 10d -> 10d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- cult-131 | again | review -> suspended (leech-like) | 4 -> 0 | 1.50 -> 1.30 | 7d -> 7d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- cult-140 | again | review -> relearning | 5 -> 0 | 2.40 -> 2.20 | 16d -> 16d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- cult-140 | good | relearning -> review | 0 -> 0 | 2.20 -> 2.35 | 16d -> 11d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- cult-150 | okay | review -> review | 6 -> 7 | 2.45 -> 2.45 | 19d -> 47d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- cult-151 | good | review -> review | 7 -> 8 | 2.50 -> 2.65 | 26d -> 85d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- Daily new-card cap enforced at 10 cards.
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- Due stack was consumed in expected priority order (review -> learning/relearning).
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- due_learning | 0
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- due_relearning | 0
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- due_review | 20
  - Runs: 20260307-study-run-13-heavy-again
- due_review | 25
  - Runs: 20260307-study-run-14-easy-streak
- due_review | 30
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- due_total | 20
  - Runs: 20260307-study-run-13-heavy-again
- due_total | 25
  - Runs: 20260307-study-run-14-easy-streak
- due_total | 30
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Easy-heavy cadence rapidly graduated early cards.
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- Easy/Good streak expanded intervals without invalid ease values.
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- Entered study session: yes
  - Runs: 20260307-study-run-15-injected-mixed-states
- geo-002 | again | review -> relearning | 3 -> 0 | 2.30 -> 2.10 | 11d -> 11d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- geo-002 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 11d -> 8d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- geo-003 | again | review -> suspended (leech-like) | 4 -> 0 | 1.70 -> 1.50 | 9d -> 9d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- geo-006 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- geo-010 | good | review -> review | 7 -> 8 | 2.60 -> 2.75 | 20d -> 68d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- geo-020 | again | review -> relearning | 5 -> 0 | 2.45 -> 2.25 | 13d -> 13d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- geo-020 | okay | relearning -> review | 0 -> 0 | 2.25 -> 2.25 | 13d -> 9d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- geo-030 | good | relearning -> review | 0 -> 0 | 1.80 -> 1.95 | 10d -> 7d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- geo-041 | again | review -> relearning | 3 -> 0 | 2.20 -> 2.00 | 9d -> 9d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- geo-041 | okay | relearning -> review | 0 -> 0 | 2.00 -> 2.00 | 9d -> 6d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- geo-100 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- geo-101 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- geo-102 | okay | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- geo-103 | again | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- geo-110 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- geo-111 | again | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- geo-120 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- geo-121 | good | learning -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- geo-130 | again | review -> relearning | 3 -> 0 | 1.90 -> 1.70 | 8d -> 8d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- geo-130 | okay | relearning -> review | 0 -> 0 | 1.70 -> 1.70 | 8d -> 6d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- geo-140 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- geo-141 | again | learning -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- geo-150 | again | review -> relearning | 4 -> 0 | 2.30 -> 2.10 | 12d -> 12d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- geo-150 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 12d -> 8d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- Initial queue length in studyFacts: 18
  - Runs: 20260307-study-run-15-injected-mixed-states
- Instability observations: Learning/relearning/new tail order appears shuffle-derived and non-deterministic by design.
  - Runs: 20260307-study-run-15-injected-mixed-states
- Lapse counter behavior observed: lapseCount remained stable on relearning answers (Again/Good), consistent with SM-2 implementation where lapse increments occur on review->Again lapses.
  - Runs: 20260307-study-run-16-relearning-focus
- Learning + Okay (`cult-006/008`) | Advance learning step | learningStep 0→1 on both | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- learning | 0
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Learning cards | 4
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Leech-like suspension behavior triggered at expected lapse threshold.
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- lsci-002 | okay | relearning -> review | 0 -> 0 | 2.00 -> 2.00 | 10d -> 7d
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- lsci-007 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- lsci-008 | good | learning -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- lsci-012 | okay | review -> review | 4 -> 5 | 2.40 -> 2.40 | 9d -> 22d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- lsci-013 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- lsci-020 | good | new -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- lsci-021 | again | new -> learning | 0 -> 0 | 2.50 -> 2.50 | 0d -> 0d
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- lsci-030 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- lsci-031 | again | relearning -> relearning | 0 -> 0 | 1.85 -> 1.85 | 7d -> 7d
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- lsci-040 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- lsci-041 | good | review -> review | 4 -> 5 | 2.35 -> 2.50 | 11d -> 34d
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- lsci-110 | again | review -> relearning | 2 -> 0 | 2.30 -> 2.10 | 6d -> 6d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- lsci-110 | okay | relearning -> review | 0 -> 0 | 2.10 -> 2.10 | 6d -> 4d
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- lsci-120 | good | relearning -> review | 0 -> 0 | 1.90 -> 2.05 | 9d -> 6d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- lsci-121 | good | learning -> review | 0 -> 1 | 2.50 -> 2.65 | 0d -> 4d
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- lsci-130 | good | review -> review | 6 -> 7 | 2.35 -> 2.50 | 15d -> 46d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- lsci-131 | okay | relearning -> review | 0 -> 0 | 1.80 -> 1.80 | 12d -> 8d
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- lsci-140 | good | review -> review | 7 -> 8 | 2.55 -> 2.70 | 20d -> 70d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- lsci-141 | okay | relearning -> review | 0 -> 0 | 1.95 -> 1.95 | 11d -> 8d
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- lsci-150 | okay | learning -> review | 0 -> 1 | 2.50 -> 2.50 | 0d -> 1d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- lsci-151 | good | relearning -> review | 0 -> 0 | 1.90 -> 2.05 | 10d -> 7d
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- Metric | Value
  - Runs: 2026-03-07-1131-study-session-15-mixed, 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Minor ordering anomaly: one newer due review card displayed before an older overdue card after repeated Again events.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- Minor UI mismatch: interval preview chip rounded one card to 3mo while stored interval was 105d.
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- Mixed-state execution remained stable under alternating button cadence.
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- Mixed-state progression worked as expected.
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- New + Okay (`geo-003/004/005`) | Enter learning step 1 | all moved new→learning, learningStep 0→1 | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- New and learning cards coexisted without crash.
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- New cards | 3
  - Runs: 2026-03-07-1131-study-session-15-mixed
- New cards were correctly excluded while review backlog remained high.
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- New-card tail ordering respected: yes
  - Runs: 20260307-study-run-15-injected-mixed-states
- None observed.
  - Runs: 20260307-study-run-13-heavy-again
- Post-injection screen: studySession
  - Runs: 20260307-study-run-15-injected-mixed-states
- Queue anomaly: learning and relearning tie-break ordering was non-deterministic across two reloads with same injected state.
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- Queue anomaly: one learning card with same `nextReviewAt` timestamp repeatedly floated to the top after requeue.
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- Queue anomaly: one relearning card reappeared twice consecutively after rapid Again -> Again sequence.
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- Queue length at start | 15
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Queue match during answered prompts: 18/18
  - Runs: 20260307-study-run-15-injected-mixed-states
- Relearning -> review transitions after Good: 5
  - Runs: 20260307-study-run-16-relearning-focus
- Relearning + Okay (`cult-010`, `geo-001`, `geo-002`) | Promote back toward review | all ended in review state | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- relearning | 0
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Relearning answers with unchanged lapseCount: 7/7
  - Runs: 20260307-study-run-16-relearning-focus
- Relearning cards | 3
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Relearning graduation used 70% interval retention as expected.
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- Requeue behavior matched spec: Again cards returned later in same session.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- Returned to base after completion: yes
  - Runs: 20260307-study-run-15-injected-mixed-states
- Review + Again (`cult-001`) | Ease drop, lapse increment, repetition reset | ease 2.5→2.3, lapse 0→1, reps 3→0 | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Review + Again (`cult-004`) | Ease drop, lapse increment, repetition reset | ease 2.7→2.5, lapse 0→1, reps 6→0 | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Review + Good (`cult-002`) | Interval growth, reps +1, ease increase | interval 5→17, reps 4→5, ease 2.55→2.70 | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Review + Good (`cult-003`) | Interval growth, reps +1, ease increase | interval 8→25, reps 5→6, ease 2.4→2.55 | PASS
  - Runs: 2026-03-07-1131-study-session-15-mixed
- review | 30
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Review cards | 5
  - Runs: 2026-03-07-1131-study-session-15-mixed
- Review-priority ordering respected: yes
  - Runs: 20260307-study-run-15-injected-mixed-states
- suspended | 0
  - Runs: 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Suspended cards correctly stayed out of the active queue.
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- UI mismatch: end-of-session card counter showed 10 completed while 11 state updates were recorded.
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- UI mismatch: header showed "17 due" while active queue rose to 23 after requeues.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- UI/state mismatch: completion panel listed "17 cards studied" while state delta reflected 20 processed interactions including requeues.
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- UI/state mismatch: due badge displayed 15 before start, but queue contained 13 due cards (new excluded by throttle).
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- UI/state mismatch: due badge updated one step late after first relearning graduation.
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- UI/state mismatch: final summary included suspended cards in total-deck denominator while queue logic excluded them.
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- UI/state mismatch: start badge showed "0 due" even though the session surfaced capped new cards.
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- UI/state mismatch: suspended cards still briefly appeared in remaining-count text until next render tick.
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure

## Unique Notes / Gaps

- [pageerror] Error: WebSocket closed without opened.
  - Runs: 20260307-study-run-15-injected-mixed-states
- [vite] failed to connect to websocket (Error: WebSocket closed without opened.).
  - Runs: 20260307-study-run-15-injected-mixed-states
- # | Fact | Button | State | Lapse | Interval
  - Runs: 20260307-study-run-16-relearning-focus
- # | Progress | Expected Fact ID | Queue Match | Question
  - Runs: 20260307-study-run-15-injected-mixed-states
- 1 | 1 / 18 | cult-001 | yes | Why does the Mona Lisa have no eyebrows?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 1 | geo-001 | again | relearning -> relearning | 2 -> 2 | 9 -> 9
  - Runs: 20260307-study-run-16-relearning-focus
- 10 | 10 / 18 | hist-002 | yes | How long did the Anglo-Zanzibar War of 1896 last?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 11 | 11 / 18 | lsci-003 | yes | Approximately how far would all the DNA in a human body stretch if uncoiled?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 12 | 12 / 18 | geo-003 | yes | Approximately what percentage of all freshwater discharged into Earth's oceans comes from the Amazon River?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 13 | 13 / 18 | nsci-002 | yes | How does the number of possible chess games compare to the number of atoms in the observable universe?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 14 | 14 / 18 | lsci-001 | yes | What do tardigrades replace their cellular water with to survive extreme conditions?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 15 | 15 / 18 | cult-005 | yes | In Japanese New Year food tradition, why do shrimp symbolize longevity?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 16 | 16 / 18 | cult-006 | yes | What saved the Eiffel Tower from being demolished in 1909?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 17 | 17 / 18 | geo-004 | yes | Which mountain is tallest when measured from its oceanic base to its summit?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 18 | 18 / 18 | lsci-004 | yes | What are the underground fungal networks connecting forest trees sometimes called?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 2 | 2 / 18 | cult-002 | yes | What physical condition did Beethoven have when he composed his Ninth Symphony?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 2 | cult-002 | again | relearning -> relearning | 4 -> 4 | 10 -> 10
  - Runs: 20260307-study-run-16-relearning-focus
- 3 | 3 / 18 | cult-003 | yes | What did ancient Greeks believe different musical modes could do to people?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 3 | lsci-001 | good | relearning -> review | 6 -> 6 | 16 -> 11
  - Runs: 20260307-study-run-16-relearning-focus
- 4 | 4 / 18 | geo-001 | yes | How many time zones does Russia span?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 4 | hist-001 | good | relearning -> review | 3 -> 3 | 11 -> 8
  - Runs: 20260307-study-run-16-relearning-focus
- 5 | 5 / 18 | cult-004 | yes | What did Odin sacrifice to gain wisdom from the Well of Wisdom?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 5 | cult-001 | good | relearning -> review | 3 -> 3 | 12 -> 8
  - Runs: 20260307-study-run-16-relearning-focus
- 6 | 6 / 18 | geo-002 | yes | Which famous human-made structure is often falsely claimed to be visible from space?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 6 | geo-001 | good | relearning -> review | 2 -> 2 | 9 -> 6
  - Runs: 20260307-study-run-16-relearning-focus
- 7 | 7 / 18 | hist-001 | yes | Which came first — the founding of Oxford University or the Aztec Empire?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 7 | cult-002 | good | relearning -> review | 4 -> 4 | 10 -> 7
  - Runs: 20260307-study-run-16-relearning-focus
- 8 | 8 / 18 | nsci-001 | yes | How does the temperature of a lightning bolt compare to the surface of the Sun?
  - Runs: 20260307-study-run-15-injected-mixed-states
- 9 | 9 / 18 | lsci-002 | yes | What combination of properties makes honey resistant to spoilage?
  - Runs: 20260307-study-run-15-injected-mixed-states
- Completion screenshot: `/tmp/study-complete-final.png`
  - Runs: 2026-03-07-1131-study-session-15-mixed, 20260307-study-run-14-easy-streak
- Console errors/page errors: 6
  - Runs: 20260307-study-run-15-injected-mixed-states
- Console warnings: 4
  - Runs: 20260307-study-run-15-injected-mixed-states
- Console/page errors captured: 8
  - Runs: 20260307-study-run-16-relearning-focus
- Daily new-card cap enforced at 10 cards.
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- Due stack was consumed in expected priority order (review -> learning/relearning).
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- Easy-heavy cadence rapidly graduated early cards.
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- Easy/Good streak expanded intervals without invalid ease values.
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- Error samples:
  - Runs: 20260307-study-run-15-injected-mixed-states
- error: [vite] failed to connect to websocket (Error: WebSocket closed without opened.).
  - Runs: 20260307-study-run-16-relearning-focus
- error: Access to fetch at 'http://127.0.0.1:3001/api/facts/packs/all' from origin 'http://127.0.0.1:5173' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.
  - Runs: 20260307-study-run-16-relearning-focus
- error: Failed to load resource: net::ERR_FAILED
  - Runs: 20260307-study-run-16-relearning-focus
- error: WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
  - Runs: 20260307-study-run-16-relearning-focus
- Failed to load resource: the server responded with a status of 404 (Not Found)
  - Runs: 20260307-study-run-15-injected-mixed-states
- Failed to load resource: the server responded with a status of 500 (Internal Server Error)
  - Runs: 20260307-study-run-15-injected-mixed-states
- Leech-like suspension behavior triggered at expected lapse threshold.
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- Minor ordering anomaly: one newer due review card displayed before an older overdue card after repeated Again events.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- Minor UI mismatch: interval preview chip rounded one card to 3mo while stored interval was 105d.
  - Runs: 20260307-1309-study-run-03-many_reviews_due-easy-streak
- Mixed-state execution remained stable under alternating button cadence.
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- Mixed-state progression worked as expected.
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- New and learning cards coexisted without crash.
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- New cards were correctly excluded while review backlog remained high.
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- pageerror: WebSocket closed without opened.
  - Runs: 20260307-study-run-16-relearning-focus
- Queue anomaly: learning and relearning tie-break ordering was non-deterministic across two reloads with same injected state.
  - Runs: 20260307-1341-study-run-11-injected-mixed-state-chaos
- Queue anomaly: one learning card with same `nextReviewAt` timestamp repeatedly floated to the top after requeue.
  - Runs: 20260307-1329-study-run-08-post_tutorial-new-plus-learning
- Queue anomaly: one relearning card reappeared twice consecutively after rapid Again -> Again sequence.
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- Raw run data: `/tmp/study-playthrough-result.json`
  - Runs: 2026-03-07-1131-study-session-15-mixed, 20260307-study-run-13-heavy-again, 20260307-study-run-14-easy-streak
- Relearning graduation used 70% interval retention as expected.
  - Runs: 20260307-1317-study-run-05-quiz_due-relearning-focus
- Requeue behavior matched spec: Again cards returned later in same session.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- Suspended cards correctly stayed out of the active queue.
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- UI mismatch: end-of-session card counter showed 10 completed while 11 state updates were recorded.
  - Runs: 20260307-1333-study-run-09-post_tutorial-easy-streak
- UI mismatch: header showed "17 due" while active queue rose to 23 after requeues.
  - Runs: 20260307-1301-study-run-01-many_reviews_due-heavy-again
- UI/state mismatch: completion panel listed "17 cards studied" while state delta reflected 20 processed interactions including requeues.
  - Runs: 20260307-1305-study-run-02-many_reviews_due-mixed-cadence
- UI/state mismatch: due badge displayed 15 before start, but queue contained 13 due cards (new excluded by throttle).
  - Runs: 20260307-1321-study-run-06-quiz_due-backlog-suppresses-new
- UI/state mismatch: due badge updated one step late after first relearning graduation.
  - Runs: 20260307-1313-study-run-04-quiz_due-balanced
- UI/state mismatch: final summary included suspended cards in total-deck denominator while queue logic excluded them.
  - Runs: 20260307-1345-study-run-12-injected-recovery-session
- UI/state mismatch: start badge showed "0 due" even though the session surfaced capped new cards.
  - Runs: 20260307-1325-study-run-07-post_tutorial-new-player-first-pass
- UI/state mismatch: suspended cards still briefly appeared in remaining-count text until next render tick.
  - Runs: 20260307-1337-study-run-10-injected-leech-pressure
- WebSocket connection to 'ws://100.74.153.81:5173/?token=g46QBv_K25Kh' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
  - Runs: 20260307-study-run-15-injected-mixed-states

## Source Files

- study/2026-03-07-1131-study-session-15-mixed.md
- study/20260307-1301-study-run-01-many_reviews_due-heavy-again.md
- study/20260307-1305-study-run-02-many_reviews_due-mixed-cadence.md
- study/20260307-1309-study-run-03-many_reviews_due-easy-streak.md
- study/20260307-1313-study-run-04-quiz_due-balanced.md
- study/20260307-1317-study-run-05-quiz_due-relearning-focus.md
- study/20260307-1321-study-run-06-quiz_due-backlog-suppresses-new.md
- study/20260307-1325-study-run-07-post_tutorial-new-player-first-pass.md
- study/20260307-1329-study-run-08-post_tutorial-new-plus-learning.md
- study/20260307-1333-study-run-09-post_tutorial-easy-streak.md
- study/20260307-1337-study-run-10-injected-leech-pressure.md
- study/20260307-1341-study-run-11-injected-mixed-state-chaos.md
- study/20260307-1345-study-run-12-injected-recovery-session.md
- study/20260307-study-run-13-heavy-again.md
- study/20260307-study-run-14-easy-streak.md
- study/20260307-study-run-15-injected-mixed-states.md
- study/20260307-study-run-16-relearning-focus.md
