# Save Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 20260307-122338-save-resume-integrity.md | save resume integrity | FAIL |
| 20260307-1308-save-run-04-post-tutorial-reload-persist.md | post tutorial reload persist | PASS |
| 20260307-1309-save-run-05-mid-game-reload-persist.md | mid game reload persist | PASS |
| 20260307-1310-save-run-06-rich-player-reload-persist.md | rich player reload persist | PASS |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- **FAIL (partial):** persistence integrity checks passed, but required interaction segment (enter mine / mine-or-quiz / surface) could not be executed due missing interactable controls in this runtime state.
  - Runs: 20260307-122338-save-resume-integrity

### MEDIUM

- None

### LOW

- None

### INFO

- Low: Entry screen mismatch (`cutscene` before action) adds nondeterminism to direct UI routing.
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist

- Low: Preset starts in `cutscene` unexpectedly for save verification path.
  - Runs: 20260307-1310-save-run-06-rich-player-reload-persist

- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist, 20260307-1309-save-run-05-mid-game-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist

- Medium: Reload landed on `cutscene` instead of staying on expected base flow.
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist

- PASS (captured save fields persisted across reload).
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist

- PASS (persistence check passed for captured fields).
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist

## Metrics and State Trends

- bestStreak | 1 | 1 | 0
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist
- bestStreak | 10 | 10 | 0
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist
- bestStreak | 30 | 30 | 0
  - Runs: 20260307-1310-save-run-06-rich-player-reload-persist
- currentScreen | base | cutscene | n/a
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist
- currentScreen | cutscene | base | n/a
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist
- currentStreak | 1 | 1 | 0
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist
- currentStreak | 20 | 20 | 0
  - Runs: 20260307-1310-save-run-06-rich-player-reload-persist
- currentStreak | 7 | 7 | 0
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist
- Metric | Before | After | Delta
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist, 20260307-1309-save-run-05-mid-game-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist
- purchasedDeals | 0 | 0 | 0
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist, 20260307-1309-save-run-05-mid-game-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist

## Unique Notes / Gaps

- `btn-dive`: missing
  - Runs: 20260307-122338-save-resume-integrity
- `btn-enter-mine`: missing
  - Runs: 20260307-122338-save-resume-integrity
- `btn-surface`: missing
  - Runs: 20260307-122338-save-resume-integrity
- `quiz-answer-0`: missing
  - Runs: 20260307-122338-save-resume-integrity
- Attempted interactions:
  - Runs: 20260307-122338-save-resume-integrity
- Captured save fields remained stable through reload.
  - Runs: 20260307-1310-save-run-06-rich-player-reload-persist
- Core streak fields remained stable after reload.
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist
- Core streak/save counters remained stable after reload.
  - Runs: 20260307-1309-save-run-05-mid-game-reload-persist
- Forced `currentScreen` to `base` via debug store setter for deterministic state.
  - Runs: 20260307-122338-save-resume-integrity
- Loaded `post_tutorial` preset.
  - Runs: 20260307-122338-save-resume-integrity
- Loaded alternate preset: `?skipOnboarding=true&devpreset=mid_game_3_rooms`.
  - Runs: 20260307-122338-save-resume-integrity
- Performed `state_touched_base` then `reloaded_once`.
  - Runs: 20260307-1308-save-run-04-post-tutorial-reload-persist, 20260307-1309-save-run-05-mid-game-reload-persist, 20260307-1310-save-run-06-rich-player-reload-persist
- Reloaded without preset again to check persistence stability.
  - Runs: 20260307-122338-save-resume-integrity
- Reloaded without preset: `?skipOnboarding=true`.
  - Runs: 20260307-122338-save-resume-integrity

## Source Files

- save/20260307-122338-save-resume-integrity.md
- save/20260307-1308-save-run-04-post-tutorial-reload-persist.md
- save/20260307-1309-save-run-05-mid-game-reload-persist.md
- save/20260307-1310-save-run-06-rich-player-reload-persist.md
