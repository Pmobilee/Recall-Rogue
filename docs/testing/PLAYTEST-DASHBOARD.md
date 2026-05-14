# Playtest Dashboard

This dashboard shows automated playtest results and ranked issues from `data/playtests/*`.

## Start

From the repo root:

```bash
npm run playtest:dashboard
```

The server runs on port `5175`.

## Campaign Runs (5-at-a-time)

Run the full campaign (200 total, strict batches of 5):

```bash
npm run playtest:campaign -- --runs 200 --parallel 5 --campaign-id campaign-v1 --seed-base 42000
```

Dry smoke test (10 runs, still 5-at-a-time):

```bash
npm run playtest:campaign:smoke
```

Validate leaderboard schema (affectedProfiles/affectedSettings/runBreakdown):

```bash
npm run playtest:leaderboard:validate
```

## URLs

- Dashboard home: `http://localhost:5175/`
- Playtest issues page: `http://localhost:5175/playtest`
- Direct page path: `http://localhost:5175/playtest.html`

## Data Sources

- Leaderboard: `data/playtests/leaderboard.json`
- Campaign archive leaderboard: `data/playtests/leaderboard.campaign-<campaign-id>.json`
- Logs: `data/playtests/logs/*.json`
- Reports: `data/playtests/reports/report-*.json`
- Campaign manifests: `data/playtests/campaigns/<campaign-id>/manifest.json`

## Release-Blocker Filter

As of 2026-05-04, `data/playtests/leaderboard.json` tracks active,
game-breaking Steam v1.0 release blockers only. Resolved findings and obvious
non-blocking polish should be removed from the active list after the fixing
commit lands. The `BATCH-2026-05-04-001` reward-room failure was caused by the
dev reward automation/screenshot path, not by a player-visible reward choice
button; `__rrPlay.acceptReward()` now uses reward bridge events directly and
canvas capture failures are contained to DOM-only screenshots.

## API Endpoints (served by the same dashboard server)

- `GET /api/playtest/leaderboard`
- `GET /api/playtest/logs`
- `GET /api/playtest/reports`
- `GET /api/playtest/log/:id`
- `GET /api/playtest/report/:id`

## Investigating an Issue (Worker Playbook)

1. Open the issue in `http://localhost:5175/playtest`.
2. Read `affectedProfiles` and `affectedSettings` first.
3. Expand **Run Breakdown** to inspect `profileId`, `seed`, `difficultyMode`, `archetype`, `domain`, `result`, `floor`, `accuracy`, `maxCombo`.
4. Use `sourceReports` issue IDs with:
   - `GET /api/playtest/report/:id` for analysis details
   - `GET /api/playtest/log/:id` for raw run events and full summary
5. Reproduce by re-running with the same `profile + seed + overrides`.

## Quick Health Checks

```bash
curl -I http://localhost:5175/playtest
curl -s http://localhost:5175/api/playtest/leaderboard | jq '.updatedAt, .totalPlaythroughs, .totalIssues'
curl -s http://localhost:5175/api/playtest/report/<playthrough-id> | jq '.issueCount'
curl -s http://localhost:5175/api/playtest/log/<playthrough-id> | jq '.summary'
```

## playtestAPI.ts — Timing Behaviour

`src/dev/playtestAPI.ts` exposes `window.__rrPlay` for AI-driven playtesting.

### endTurn()
Clicks `[data-testid="btn-end-turn"]` then **polls for up to 3 s** (60 × 50 ms) rather than using a fixed wait. The poll breaks when:
- The screen changes away from `combat`, OR
- The End Turn button re-enables (indicating a new turn has started).

This replaces the old `await wait(turboDelay(2000))` which was insufficient for the async callback chain to complete, requiring a double-call to actually advance the turn.

### selectMapNode(nodeId)
Clicks `[data-testid="map-node-${nodeId}"]` then **polls for up to 5 s** (100 × 50 ms) until `getScreen()` is no longer `'dungeonMap'`. This is needed because `ensurePhaserBooted() + startEncounterForRoom()` can take 500 ms+ in turbo mode, making the old fixed 100 ms wait too short to reliably launch combat.

### Mystery and shop bridge helpers

`selectMysteryChoice()` now handles both normal `.choice-btn` mystery choices
and `EventQuiz` mystery rooms rendered with `[data-testid^="quiz-answer-"]`.
If the quiz answer buttons are already disabled after an answer, it advances the
visible `.next-btn` result step.

`shopLeave()` handles the two-step leave flow in `ShopRoomOverlay`: click
`btn-leave-shop`, then click `btn-leave-confirm` if the confirmation modal
appears. Repeated `shopRoom` in a playtest report is no longer automatically
treated as a player-facing blocker unless this helper also fails.
