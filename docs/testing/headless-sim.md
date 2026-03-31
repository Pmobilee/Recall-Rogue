# Headless Balance Simulator

> **Purpose:** How to run the headless combat simulator for balance testing — profiles, output format, and key internals.
> **Last verified:** 2026-03-31
> **Source files:** `tests/playtest/headless/simulator.ts`, `tests/playtest/headless/run-batch.ts`, `tests/playtest/headless/browser-shim.ts`, `tests/playtest/headless/tsconfig.json`, `tests/playtest/headless/full-run-simulator.ts`

## What It Is

The headless simulator runs full card-roguelite encounters entirely in Node.js — no Phaser, no Svelte, no DOM, no browser. It imports real game modules directly:

- `src/services/turnManager.ts` — card play, turn resolution
- `src/services/cardEffectResolver.ts` — card effects
- `src/services/relicEffectResolver.ts` — relic triggers
- `src/data/enemies.ts` — enemy templates
- `src/data/balance.ts` — `PLAYER_START_HP`, `PLAYER_MAX_HP`, `POST_ENCOUNTER_HEAL_PCT`, `STARTER_DECK_COMPOSITION`
- `src/data/mechanics.ts` — `MECHANIC_DEFINITIONS`
- `src/services/ascension.ts` — `getAscensionModifiers()`

Zero reimplementation, zero drift. When `balance.ts` changes, the sim uses the new values automatically.

**Performance:** ~6 000 runs in 5 seconds (single process, no browser startup overhead).

## Running the Simulator

The `--tsconfig` flag is mandatory — it maps `svelte/store` to a shim so game code loads in Node.js.

```bash
# All 6 profiles × 1000 full runs (default mode)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 1000

# Single profile
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 500 --profile scholar

# With ascension level
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 1000 --ascension 10

# Combat-only legacy mode (N encounters, no map/economy)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 200 --mode combat --encounters 30

# Relic audit (standalone)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/relic-audit.ts

# Single run with verbose output
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/simulator.ts --verbose
```

**CLI flags for `run-batch.ts`:**

| Flag | Default | Description |
|------|---------|-------------|
| `--runs N` | 100 | Runs per profile |
| `--profile ID` | all 6 | Filter to one profile |
| `--ascension N` | 0 | Ascension level (0–20) |
| `--mode full\|combat` | full | Full run vs combat-only |
| `--encounters N` | 30 | Max encounters (combat mode only) |
| `--heal-rate F` | 0.2 | Heal fraction between encounters |
| `--description STR` | — | Label for output README |

## Player Profiles

Six profiles simulate the player skill spectrum. `correctRate` drives quiz accuracy; `chargeRate` drives how often the player uses the Charge play mode (costs +1 AP but doubles effect on correct answers).

| ID | Name | Correct Rate | Charge Rate | Strategy |
|----|------|-------------|-------------|----------|
| `first_timer` | First Timer | 45% | 10% | basic |
| `casual_learner` | Casual Learner | 65% | 35% | basic |
| `regular` | Regular | 62% | 30% | intermediate |
| `gamer` | Gamer | 55% | 20% | optimal |
| `dedicated` | Dedicated | 70% | 55% | optimal |
| `scholar` | Scholar | 82% | 75% | optimal |

Charge breaks even at ~56% accuracy (the +1 AP cost vs doubled effect). Gamer charges less despite playing "optimally" — models players who prioritize speed over knowledge accuracy.

## Output Format

Results save to a timestamped folder: `data/playtests/runs/YYYY-MM-DD_HH-MM-SS/`

Files written:
- `{profile_id}.json` — per-profile run array
- `combined.json` — all profiles merged with metadata
- `README.md` — human-readable summary table
- `latest` symlink — points to the most recent run folder

**Console output per profile (full run mode):**
```
  scholar          1000 runs | Survived: 847/1000 (85%) | Avg acts: 2.34 | Avg enc won: 18.2 | Avg deck: 19.3 | Avg relics: 3.1 | Avg gold: 420 | Avg HP (surv): 62 | 4.2s
    Avg rooms/run: 22.4 — combat=14.2 shop=2.1 rest=2.0 mystery=1.8 reward=2.3
```

**`SimRunResult` fields** (from `simulator.ts`):
- `survived: boolean` — did the player complete all acts
- `floorsReached: number` — encounters completed
- `finalHP: number` — remaining HP
- `accuracy: number` — correct / total answers
- `totalDamageDealt`, `totalDamageTaken`, `totalCardsPlayed`
- `encounters: EncounterSummary[]` — per-encounter breakdown with `result`, `turnsUsed`, `maxCombo`, `cardPlays`

**`FullRunResult` fields** (from `full-run-simulator.ts`):
- `actsCompleted: number` — 0–3
- `encountersWon: number`
- `finalDeckSize: number`
- `relicsAcquired: string[]`
- `goldEarned: number`
- `roomsVisited: Record<string, number>` — room type counts

## Per-Mechanic Analysis (Combat Mode Only)

In `--mode combat`, the batch runner also outputs `MechanicStats[]`:
- `winRateWhenPresent` — win rate in runs that included this mechanic
- `avgDamagePerPlay` — average damage dealt per card play
- `chargedPlays` vs `quickPlays` breakdown
- `correctWhenCharged` / `wrongWhenCharged`

## Key Internal Functions

**`simulator.ts`:**
- `runSimulation(opts: SimOptions): SimRunResult` — public API, runs one full sim
- `simulateSingleEncounter(turnState, opts, ascMods)` — inner loop: plays all cards, calls `endPlayerTurn`, checks `checkEncounterEnd`
- `buildSimDeck(deckSize)` — builds starter deck from `STARTER_DECK_COMPOSITION`, fills extras with weighted random mechanics
- `pickRandomEnemy(act, nodeType)` — delegates to `getEnemiesForNode()`

**`browser-shim.ts`:** Must be imported first (`import './browser-shim.js'`). Stubs `localStorage`, `window`, `document`, and `import.meta.env` so game modules load without a browser.

**`tsconfig.json`:** Extends `tsconfig.app.json`, maps `svelte/store` and `svelte` to `./svelte-shim` so Svelte store imports resolve in Node.js.

## Ascension Support

Pass `--ascension N` (0–20). The sim calls `getAscensionModifiers(level)` once and applies all modifiers:
- Enemy HP multipliers, damage multipliers
- Player max HP overrides, starting relic counts
- Per-turn behaviors (regen, combo resets, correct-answer heals)
- A19 free-charging buff, A2 first-turn bonus AP, A9 encounter-start shield
