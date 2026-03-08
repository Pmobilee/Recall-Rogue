# Streak Playthroughs - Codex Combined

## Run Coverage

| Run File | Context | Verdict |
|---|---|---|
| 20260307-113834-edge-and-max.md | edge and max | FAIL |
| 20260307-1315-streak-run-11-streak-risk-milestone-surface.md | streak risk milestone surface | FAIL |
| 20260307-1316-streak-run-12-max-streak-season-social-panels.md | max streak season social panels | FAIL |

## Deduplicated Findings

### CRITICAL

- None

### HIGH

- **FAIL / Coverage gap**: no user-facing milestone/protection surface could be reached in this DOM-driven run.
  - Runs: 20260307-113834-edge-and-max

- **Overall: FAIL (partial)**
  - Runs: 20260307-113834-edge-and-max

- FAIL (blocked; partial report with captured evidence).
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels

- FAIL (partial; streak values persist, but required milestone/social panels inaccessible).
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface

### MEDIUM

- None

### LOW

- None

### INFO

- **PASS**: streak display loads for both presets and matches save data (`stats.currentStreak`).
  - Runs: 20260307-113834-edge-and-max

- **PASS**: streak-related save fields are populated and distinct between edge and max presets (`streakFreezes`, `lastStreakMilestone`, `claimedMilestones`).
  - Runs: 20260307-113834-edge-and-max

- Available DOM navigation was limited to cutscene skip + dev controls; primary in-game navigation appears Phaser-canvas driven and not directly reachable through deterministic DOM interaction.
  - Runs: 20260307-113834-edge-and-max

- High: Runtime instability (`Target page, context or browser has been closed`) blocked completion.
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels

- Medium: Dev runtime API/CORS and websocket errors repeatedly logged.
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface, 20260307-1316-streak-run-12-max-streak-season-social-panels

- Medium: Streak/social surfaces not reachable from deterministic DOM route.
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface

- Reason: streak values/display validated, but milestone/protection surfaces were not observable via reachable UI route in this run.
  - Runs: 20260307-113834-edge-and-max

- Text scan after load and after opening DEV panel had no milestone/protection UI labels (only streak headline, plus dev preset names such as "Streak at Risk" and "Streak Just Claimed").
  - Runs: 20260307-113834-edge-and-max

## Metrics and State Trends

- bestStreak | 100 | n/a | n/a
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- bestStreak | 14 | 14 | 0
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface
- currentScreen | base | base | 0
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface
- currentScreen | base | n/a | n/a
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- currentStreak | 100 | n/a | n/a
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- currentStreak | 14 | 14 | 0
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface
- Metric | Before | After | Delta
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface, 20260307-1316-streak-run-12-max-streak-season-social-panels
- season/social panel clicks | 0 | n/a | n/a
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- streak/social panel clicks | 0 | 0 | 0
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface

## Unique Notes / Gaps

- `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=max_streak`
  - Runs: 20260307-113834-edge-and-max
- `http://127.0.0.1:5173/?skipOnboarding=true&devpreset=streak_about_to_break`
  - Runs: 20260307-113834-edge-and-max
- `localStorage.terra_save`
  - Runs: 20260307-113834-edge-and-max
- `window.__terraDebug()`
  - Runs: 20260307-113834-edge-and-max
- Attempted streak/social panel openings twice: `not_found`, `not_found`.
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface
- No `Streak`, `Season`, `Social`, `Leaderboard`, or `Milestone` labels detected in reachable DOM.
  - Runs: 20260307-1315-streak-run-11-streak-risk-milestone-surface
- No successful streak/social panel interaction recorded.
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- Run aborted during action stage with browser/context closure.
  - Runs: 20260307-1316-streak-run-12-max-streak-season-social-panels
- Runtime readouts were pulled from:
  - Runs: 20260307-113834-edge-and-max
- Screenshots captured:
  - Runs: 20260307-113834-edge-and-max
- UI text (`document.body.innerText`)
  - Runs: 20260307-113834-edge-and-max
- URLs loaded successfully:
  - Runs: 20260307-113834-edge-and-max

## Source Files

- streak/20260307-113834-edge-and-max.md
- streak/20260307-1315-streak-run-11-streak-risk-milestone-surface.md
- streak/20260307-1316-streak-run-12-max-streak-season-social-panels.md
