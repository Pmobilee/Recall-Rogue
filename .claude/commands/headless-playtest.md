# Headless Playtest — Fast Balance Simulation

Run thousands of combat simulations in seconds using the headless simulator. This imports the REAL game code (turnManager, cardEffectResolver, relicEffectResolver) — zero reimplementation, zero drift.

## Quick Commands

### Run 1000 games across all profiles
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 1000 --description "Baseline balance check"
```

### Run single profile
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/run-batch.ts --runs 500 --profile scholar --description "Scholar deep dive"
```

### Quick single encounter test
```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json tests/playtest/headless/simulator.ts --encounters 30 --correct-rate 0.82 --verbose
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

### Card Balance (from STS reference)
- Attack base damage: 6 (STS Strike = 6, upgraded = 9)
- Shield base value: 5 (STS Defend = 5, upgraded = 8)
- Player HP: 100 (STS Ironclad = 80, Silent = 70)
- AP per turn: 3 (STS Energy = 3)

## Bot Profiles

| Profile | Quiz Acc | Charge Rate | Strategy | Simulates |
|---------|----------|-------------|----------|-----------|
| first_timer | 45% | 15% | basic | New player, guesses most answers |
| casual_learner | 65% | 30% | basic | Casual, knows some facts |
| regular | 62% | 40% | intermediate | Average player |
| gamer | 55% | 80% | optimal | Plays well but doesn't know facts |
| dedicated | 70% | 85% | optimal | Good knowledge + good play |
| scholar | 82% | 90% | optimal | Best player archetype |

## CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| --runs N | 100 | Runs per profile |
| --profile ID | all | Single profile to test |
| --encounters N | 30 | Max encounters per run |
| --heal-rate F | 0.2 | HP healed between encounters (0-1) |
| --description TEXT | "Headless balance run" | Label for this batch |

## Speed

- Single encounter: ~2ms
- 30-encounter run: ~20ms
- 1000 runs: ~20 seconds
- 10,000 runs: ~200 seconds

## Key Files

| File | Purpose |
|------|---------|
| `tests/playtest/headless/simulator.ts` | Core simulation engine |
| `tests/playtest/headless/run-batch.ts` | Batch runner with reporting |
| `tests/playtest/headless/svelte-shim.ts` | Svelte store mock for Node.js |
| `tests/playtest/headless/browser-shim.ts` | Browser API mocks |
| `src/data/balance.ts` | ALL balance constants (change these to tune) |
| `src/data/enemies.ts` | Enemy templates and stats |
