# Bot Playtest Session

Run automated playtests using the Playwright bot against the REAL game in the browser. The bot plays complete runs — combat, shops, rest rooms, delve/retreat — just like a real player.

## Prerequisites

1. Dev server must be running on port 5173:
   ```bash
   curl -s http://localhost:5173 | head -1
   ```
   If not running: `npm run dev &` and wait 5 seconds.

## Quick Commands

### Quick Test (5 runs per profile, all 6 profiles)
```bash
npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 5 --parallel 1 --description "Quick test"
```

### Single Profile Test
```bash
npx tsx tests/playtest/playwright-bot/runner.ts --profile scholar --runs 3 --parallel 1
```

### Mass Run (for balance data)
```bash
npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 20 --parallel 1 --description "Balance data collection"
```

### Overnight (indefinite, stops with Ctrl+C)
```bash
nohup npx tsx tests/playtest/playwright-bot/overnight.ts > /dev/null 2>&1 &
```

### View Latest Results
```bash
cat data/playtests/runs/latest/README.md
```

### Run Analyzer on Existing Data
```bash
npx tsx tests/playtest/playwright-bot/analyze.ts --input data/playtests/runs/latest/combined.json
```

## Output

Every batch run creates: `data/playtests/runs/YYYY-MM-DD_HH-MM-SS/`
- `combined.json` — all run stats (33+ fields per run)
- `README.md` — auto-generated summary table + key findings
- `{profileId}.json` — per-profile data
- `balance-report.txt` — 10-section analysis (relics, enemies, floors, economy)
- `data/playtests/runs/latest` symlink → most recent batch

## Bot Profiles (6 total)

| Profile | Quiz Acc | Charge Rate | Strategy | Description |
|---------|----------|-------------|----------|-------------|
| first_timer | 45% | 15% | basic | New player, mostly quick plays |
| casual_learner | 65% | 30% | basic | Casual, some charging |
| regular | 62% | 40% | intermediate | Average player |
| gamer | 55% | 80% | optimal | High charge, lower accuracy |
| dedicated | 70% | 85% | optimal | Good all-around |
| scholar | 82% | 90% | optimal | Best player, buys relics, studies at rest |

## What the Bot Does

- **Combat**: Charge/quick play cards based on profile, answer quizzes
- **Shop**: Buy relics (priority), food when HP<60%, card removal (optimal profiles)
- **Rest**: Study (upgrade cards) when HP>80% + optimal, else heal
- **Map**: Navigate nodes, detect segment completion, delve deeper
- **Rewards**: Collect gold, vials, relics, cards from Phaser RewardRoomScene
- **Special events**: Handle mystery events, relic forges, upgrade selection
- **Delve/Retreat**: Delve until Floor 18+ or 4 segments, then retreat for victory

## Data Tracked Per Run (33+ fields)

- Per-encounter: enemy name, floor, turns, damage dealt/taken, cards, chain
- Per-card-type: played/charged/quickPlayed counts
- Relics: definitionId, acquiredAtFloor, triggerCount
- Domain accuracy per domain
- Gold economy, shop/upgrade tracking
- Chain analytics, bounties, question tier stats

## Comparing Batches

After making balance changes, run a new batch and compare:
1. Run batch: `npx tsx tests/playtest/playwright-bot/runner.ts --all --runs 10 --parallel 1 --description "After balance change X"`
2. View: `cat data/playtests/runs/latest/README.md`
3. Compare with previous: check `data/playtests/runs/` folder timestamps

## Key Files

| File | Purpose |
|------|---------|
| `tests/playtest/playwright-bot/bot.ts` | Main bot loop, screen handlers |
| `tests/playtest/playwright-bot/runner.ts` | CLI runner, batch infrastructure |
| `tests/playtest/playwright-bot/overnight.ts` | Indefinite collection |
| `tests/playtest/playwright-bot/analyze.ts` | Balance report generator |
| `tests/playtest/playwright-bot/types.ts` | Profiles, stat types |
| `tests/playtest/playwright-bot/actions.ts` | Card play, quiz, room choice |
| `tests/playtest/playwright-bot/state-reader.ts` | Game state reading |

## Troubleshooting

- **Timeout at Floor 1**: Combat init timing issue. The 1500ms post-entry delay helps but ~10% of runs still get stuck. Retry with a different seed.
- **0 relics at end**: Normal for defeat runs — run state is cleared before final read. In-run relic tracking works (check `relicsEarned` array).
- **NEVER use `exitRoom()`**: It bypasses game flow and teleports to hub. This was the root cause of the original "fake victory" bug.
