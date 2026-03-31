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
