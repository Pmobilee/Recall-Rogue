# Mine Playthrough Report - Run 16 (custom_mature_b)

- Date: 2026-03-07T13:01:44Z
- Run type: mine with custom save injection
- Requested scenario: inject 30 review cards (mixed intervals), 4 mature overdue cards, oxygen 4
- Result: partial (blocked by save state replacement before mine entry)
- Verdict: FAIL

## Injection and Verification

- Injection payload wrote localStorage with:
  - `learnedFacts = 30`
  - `reviewStates = 30` (4 mature overdue, mixed intervals across all cards)
  - `oxygen = 4`
- Post-load verification attempt 1 (`?skipOnboarding=true`):
  - `screen = cutscene`
  - `factCount = 0`
  - `reviewStateCount = 0`
  - `oxygenTanks = 3`
- Post-load verification attempt 2 (single retry):
  - `screen = cutscene`
  - `factCount = 0`
  - `reviewStateCount = 0`
  - `oxygenTanks = 3`
- Outcome: injected review payload did not bind to runtime `terra:playerSave`; save appears overwritten by boot/preset flow.

## Mine/Quiz Requirement Outcome

- Mine loop executed: no (0 key presses; blocked before dive/mine transition).
- Max key requirement (`<= 220`): not reached due to pre-run block.
- Quiz trigger target (at least 2): not possible (0 quizzes seen).
- Wrong-answer requirement: not possible (0 quiz opportunities).

## HUD vs Store Mismatch Capture

- HUD/store mismatch checks during mine HUD phase: not possible (mine HUD never loaded).
- Save-level mismatch observed at load boundary:
  - Injected `oxygen=4`, runtime store repeatedly reported `oxygenTanks=3`.
  - Injected `learnedFacts/reviewStates` dropped to `0/0` immediately after app load.

## Diagnostics

- Console errors observed during blocked run:
  - Vite websocket failures (`ERR_CONNECTION_REFUSED`, websocket closed before open)
  - Resource failures (`500`, `404`)
- Request failures included:
  - `GET /api/facts/delta?since=0&limit=500`
  - repeated analytics endpoint failures on `localhost:3001`

## Notes

- This report is intentionally partial per instruction because runtime save verification failed after one retry.
- Raw run data captured at: `/tmp/mine-run-16-custom-mature-b.json`
