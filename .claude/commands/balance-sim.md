# Balance Sim — Fast Balance Simulation

Run tens of thousands of combat simulations in seconds using the headless simulator. This imports the REAL game code (turnManager, cardEffectResolver, relicEffectResolver) — zero reimplementation, zero drift. Parallel execution distributes work across CPU cores automatically.

## Quick Commands

### Run 10000 games across all profiles (parallel, default)
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --description "Baseline balance check"
```

### Run 10000 games with explicit run count
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 10000 --description "Post healing buff"
```

### Run single profile
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --profile scholar --description "Scholar deep dive"
```

### Quick single encounter test
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/simulator.ts --encounters 30 --correct-rate 0.82 --verbose
```

### Run with specific worker count
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 10000 --workers 8
```

### Run sequentially (disable parallel)
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --no-parallel
```

### View latest results
```bash
cat data/playtests/runs/latest/README.md
```

## Balance Targets (from Research)

Based on STS research in `docs/RESEARCH/CARD-GAME-RESEARCH.md` and addictiveness research in `docs/RESEARCH/01_Addictiveness_research.md`:

### Win Rates by Ascension
| Ascension | Target Win Rate | Rationale |
|-----------|----------------|-----------|
| 0 (base) | 50-60% | New players should feel competent. STS base is ~50% for experienced players |
| 1-5 | 30-45% | Challenge increases but wins still achievable |
| 6-10 | 15-25% | Real challenge. STS A10 adds curse card |
| 11-15 | 8-15% | Expert territory |
| 16-20 | 3-8% | Mastery level. STS A20 is ~5% even for top players |

### Near-Miss Psychology (Critical for Retention)
From addictiveness research:
- **25-30% of defeats should be "near misses"** — player dies within 1-2 floors of the boss
- This creates "one more run" motivation (Prospect Theory)
- Death should feel like it was avoidable with slightly different choices
- Implement via depth-scaling: early floors generous, late floors punishing

### Difficulty Curve Shape
- **Floors 1-6 (Segment 1):** Easy ramp. <5% death rate. Players learn mechanics.
- **Floors 7-12 (Segment 2):** Challenge begins. 15-25% death rate. Deck building matters.
- **Floors 13-18 (Segment 3):** High stakes. 30-40% death rate. Relics and synergies critical.
- **Floors 19-24 (Segment 4):** Boss gauntlet. 50%+ death rate for those who reach it.

### Economy Targets
- Average gold at death: 200-400
- Relics per completed run: 4-6
- Shop visits per run: 2-3
- Cards added per run: 6-10

### Current Actual Results (2026-03-20, post relic fix, 30,000 runs — NEEDS REFRESH with new parallel runs)

| Profile | A0 | A5 | A10 | A15 | A20 |
|---------|----|----|-----|-----|-----|
| first_timer | 22% | 15% | 7% | 4% | 1% |
| gamer | 38% | 31% | 15% | 8% | 2% |
| regular | 52% | 39% | 24% | 14% | 3% |
| casual | 58% | 41% | 24% | 17% | 4% |
| dedicated | 65% | 51% | 34% | 22% | 5% |
| scholar | 86% | 76% | 63% | 40% | 8% |

**Key finding:** Scholar is overpowered at A0 (86% vs 55% target). Knowledge advantage is intentionally strong in a knowledge game. Ascension progression is smooth with no dead zones.

### Card Balance (from STS reference)
- Attack base damage: 6 (STS Strike = 6, upgraded = 9)
- Shield base value: 5 (STS Defend = 5, upgraded = 8)
- Player HP: 100 (STS Ironclad = 80, Silent = 70)
- AP per turn: 3 (STS Energy = 3)

## Bot Profiles

**Default (Progression Profiles — use for balance work):**

| Profile | Accuracy | Target WR | Description |
|---------|----------|-----------|-------------|
| new_player | 50% | 5-15% | First contact with game. Tutorial-level strategy. |
| developing | 60% | 30-50% | Content recognition starting, basic strategy emerging. |
| competent | 68% | 45-65% | All systems understood, strategic play begins. |
| experienced | 76% | 60-75% | Strong deck knowledge, optimizes most decisions. |
| master | 85% | 80-90% | Near-perfect knowledge, near-optimal strategy. |
| language_learner | 35% | 5-10% | Foreign language deck. Competent game skills, content-blind. |

**Legacy Profiles (deprecated for balance work, still accessible via `--profile`):**

| Profile | Quiz Acc | Charge Rate | Simulates |
|---------|----------|-------------|-----------|
| first_timer | 45% | 10% | New player, guesses most answers |
| casual_learner | 65% | 35% | Casual, knows some facts |
| regular | 62% | 30% | Average player |
| gamer | 55% | 20% | Plays well but doesn't know facts |
| dedicated | 70% | 55% | Good knowledge + good play |
| scholar | 82% | 75% | Best player archetype |

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--runs N` | 10000 | Runs per profile |
| `--profile ID` | all | Single profile to test |
| `--encounters N` | 30 | Max encounters per run |
| `--ascension N` | 0 | Ascension level (0-20) |
| `--heal-rate F` | 0.2 | Post-encounter heal fraction |
| `--description TEXT` | "Headless balance run" | Label for this batch |
| `--parallel` | ON | Enable parallel execution (default: on) |
| `--no-parallel` | — | Disable parallel, run sequentially |
| `--workers N` | min(cpus-2, 12) | Number of worker threads (parallel mode) |
| `--sweep AXIS\|all` | — | Sweep one axis (or all 10) from 0→1 |
| `--isolation` | — | Each axis at 1.0, rest at baseline |
| `--skills JSON` | — | Custom BotSkills JSON |
| `--force-relic ID` | — | Force a relic at run start (causal testing) |
| `--mode full\|combat` | full | Full run vs combat-only (legacy) |

## Speed

With parallel execution on a 14-core machine (12 workers):
- 10,000 runs (single profile): ~3-5 seconds
- 60,000 runs (6 profiles × 10,000): ~20-30 seconds total (profile-parallel pool dispatches all concurrently)
- Single encounter: ~2ms
- 30-encounter run: ~20ms

Default workers = `min(os.cpus().length - 2, 12)`. Leaves 2 cores for OS/other work, caps at 12 to avoid diminishing returns.

**Multi-profile batches (default mode):** Uses `runAllProfilesParallel()` — all profile×chunk tasks dispatched to a shared pool. 3-5× faster than sequential profiles.

Progress is printed per task completion (in pool mode):
```
    [  1/72 tasks] new_player: +139 runs
    [  2/72 tasks] developing: +139 runs
    ...
```

## New Metrics Reference (2026-04-05)

| Metric | Source Field | Description |
|--------|-------------|-------------|
| Win% | `survived` | Fraction of runs completed (all 3 acts) |
| Charge% | `totalChargedPlays / totalCardsPlayed` | How often the player charges |
| Charge Acc | `chargeSuccessRate` | Fraction of charges answered correctly |
| Avg Mastery | `avgMasteryLevel` | Mean mastery level of final deck (0-5) |
| Near-Miss% | `isNearMiss` | Deaths in Act 3+ or vs near-dead enemy — target 25-30% |
| Comeback% | `isComeback` | Survived despite dropping below 30% HP |
| Mastery Dist | `masteryDistribution` | [L0, L1, L2, L3, L4, L5] card counts |
| Charge DMG% | computed | damageFromCharges / totalDamage — knowledge engagement signal |
| Avg Min HP | `minHpSeen` | Lowest HP during run — tension indicator |
| Avg Turns/Enc | `avgTurnsPerEncounter` | Combat length proxy |
| HP Curve | `hpCurve` (per-profile JSON) | Floor-by-floor avg/min/max HP + death rate |
| Delta | `delta.md` | Win/charge/mastery/near-miss delta vs previous run |

**Console format (full mode):**
```
competent            100 runs | Win: 42% | Charge: 69% (67% acc) | Mastery: 2.5 avg | Near-miss: 58% | Comeback: 24% | 0.3s
```

## Key Files

| File | Purpose |
|------|---------|
| `tests/playtest/headless/simulator.ts` | Core simulation engine |
| `tests/playtest/headless/run-batch.ts` | Batch runner with parallel execution and reporting |
| `tests/playtest/headless/sim-worker.ts` | Worker thread: receives tasks, runs sims, posts results |
| `tests/playtest/headless/svelte-shim.ts` | Svelte store mock for Node.js |
| `tests/playtest/headless/browser-shim.ts` | Browser API mocks |
| `src/data/balance.ts` | ALL balance constants (change these to tune) |
| `src/data/enemies.ts` | Enemy templates and stats |
| `tests/playtest/headless/relic-audit.ts` | Automated relic effect verification |
| `src/services/ascension.ts` | Ascension level definitions (challenge + buff) |
