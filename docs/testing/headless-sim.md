# Headless Balance Simulator

> **Purpose:** How to run the headless combat simulator for balance testing — profiles, output format, and key internals.
> **Last verified:** 2026-04-04
> **Source files:** `tests/playtest/headless/simulator.ts`, `tests/playtest/headless/run-batch.ts`, `tests/playtest/headless/browser-shim.ts`, `tests/playtest/headless/tsconfig.json`, `tests/playtest/headless/full-run-simulator.ts`, `tests/playtest/headless/bot-brain.ts`, `tests/playtest/headless/bot-profiles.ts`

## What It Is

The headless simulator runs full card-roguelite encounters entirely in Node.js — no Phaser, no Svelte, no DOM, no browser. It imports real game modules directly:

- `src/services/turnManager.ts` — card play, turn resolution
- `src/services/cardEffectResolver.ts` — card effects
- `src/services/relicEffectResolver.ts` — relic triggers
- `src/data/enemies.ts` — enemy templates
- `src/data/balance.ts` — `PLAYER_START_HP`, `PLAYER_MAX_HP`, `STARTER_DECK_COMPOSITION`
- `src/data/mechanics.ts` — `MECHANIC_DEFINITIONS`
- `src/services/ascension.ts` — `getAscensionModifiers()`

Zero reimplementation, zero drift. When `balance.ts` changes, the sim uses the new values automatically.

**Performance:** ~6,000 runs in 5 seconds (single process, no browser startup overhead).

## Running the Simulator

The `--tsconfig` flag is mandatory — it maps `svelte/store` to a shim so game code loads in Node.js.

```bash
# All 6 progression profiles × 1000 full runs (default mode)
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

# Force a relic on every run (causal relic testing — no survivorship bias)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 500 --profile scholar --force-relic scavengers_eye

# Single run with verbose output
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/simulator.ts --verbose
```

**CLI flags for `run-batch.ts`:**

| Flag | Default | Description |
|------|---------|-------------|
| `--runs N` | 100 | Runs per profile |
| `--profile ID` | all 6 progression | Named profile (legacy, archetype, or progression) — see Player Profiles |
| `--archetype NAME` | — | Alias for `--profile`; shorthand for archetype names |
| `--ascension N` | 0 | Ascension level (0–20) |
| `--mode full\|combat` | full | Full run vs combat-only |
| `--encounters N` | 30 | Max encounters (combat mode only) |
| `--heal-rate F` | 0.2 | Heal fraction between encounters |
| `--description STR` | — | Label for output README |
| `--sweep AXIS\|all` | — | Sweep one axis (or all 10) from 0→1 in 0.1 steps |
| `--isolation` | — | Test each axis at 1.0 with all others at baseline (0.3) |
| `--skills JSON` | — | Custom `BotSkills` JSON (partial OK; unspecified axes default to 0.5) |
| `--force-relic ID` | — | Force a specific relic at run start on every run (added on top of normal starter relics; for causal win-rate measurement free of survivorship bias) |

## BotBrain System

`BotBrain` (`bot-brain.ts`) is the parameterized decision engine that replaced hardcoded bot logic. All decisions are driven by a `BotSkills` profile — 11 axes from 0 (worst) to 1 (optimal).

### BotSkills Interface

| Axis | Governs |
|------|---------|
| `accuracy` | Probability of answering a quiz question correctly |
| `cardSelection` | Hand ordering quality — which cards to play first |
| `chargeSkill` | Charge-vs-quick-play decision quality (EV break-even at acc ≥ 0.56) |
| `chainSkill` | Chain type awareness and sequencing quality |
| `blockSkill` | Shield/block prioritization intelligence |
| `apEfficiency` | AP usage optimization (skip unaffordable cards, fill remaining AP) |
| `surgeAwareness` | Surge turn exploitation (free charge surcharge turns) |
| `masteryHunting` | Preference for charging high-`perLevelDelta` cards to gain mastery |
| `rewardSkill` | Card reward selection quality (gap-filling, high-scaling picks) |
| `shopSkill` | Shop purchase intelligence (removal, relics, food timing) |
| `restSkill` | Rest site decision quality (heal vs study vs meditate based on HP% and deck size) |

### How planTurn() Works

1. `_orderHand()` — scores/sorts hand using `cardSelection`, `chainSkill`, `blockSkill`, `apEfficiency`
2. Iterates ordered hand; checks AP budget, calls `_decideMode()` per card → `charge` or `quick`
3. `_decideMode()` — tiered thresholds for `chargeSkill`, `surgeAwareness`, `masteryHunting`
4. Returns `CardPlay[]` — `{ cardId, mode }` pairs. **The simulator rolls accuracy, not the brain.**

Other methods: `pickReward()`, `planShop()`, `planRest()`, `pickRoom()` — each driven by its axis.

### makeSkills() Helper

`makeSkills(overrides, baseline=0.5)` — fills unspecified axes with `baseline`; accuracy also defaults to baseline if omitted.

## Room Navigation — Brain-Driven Path

When a `BotBrain` is active, `walkMapPath` is replaced with step-by-step `brain.pickRoom()` calls. The brain scores each available map node by current HP and deck state, then commits one room at a time:

- **Low HP** — prefers rest sites to heal; avoids combat nodes
- **Healthy HP** — prefers combat for gold and card rewards
- **Legacy path** — when no brain is present, random room selection is used unchanged

`pickRoom()` returns the selected node id. The full-run simulator advances the map one step at a time using this output.

## Rest Site — Meditate Action

`planRest(runState)` now returns `'heal' | 'study' | 'meditate'` (previously only `'heal' | 'study'`).

**Meditate** removes the weakest card in the deck (strike cards first). Decision thresholds:

| `restSkill` | Meditate when deck size > |
|-------------|--------------------------|
| < 0.7 | 15 cards |
| ≥ 0.7 | 12 cards |

Meditate is never chosen when deck is at or below the threshold, or when HP is critically low and healing is more urgent.

## Health Vials — Post-Combat Healing

`POST_ENCOUNTER_HEAL_PCT` (flat 7% heal) has been replaced with a randomized health vial drop system. After each combat encounter:

- **25% chance** — health vial drops
  - **Small vial** (70% of drops): restores 8–18 HP
  - **Large vial** (30% of drops): restores 20–35 HP
- **75% chance** — no vial drops; no healing

This produces more variance in run health curves than the old flat heal. The `balance.ts` constant `POST_ENCOUNTER_HEAL_PCT` is no longer read by the sim.

## Mystery Events — Smart Choice Scoring

Choice-based mystery events previously always picked option 0. The brain now scores each option by current HP and deck state:

- **Prefers healing options** when HP is below ~50%
- **Avoids damage options** when HP is critically low
- **Considers deck size** for card-removal events (only takes removal when deck is large)
- Falls back to option 0 if no scoring data is available for an event type

## Player Profiles

### Progression Profiles (6) — Default

The default profile set when no `--profile` flag is given. Each profile represents a stage in the player journey from first run to mastery. Use these for balance work — they model the realistic spread of win rates across the player lifecycle.

Accuracy models 4-option MCQ on curated knowledge decks. Game skill axes model gradual system discovery through play.

| ID | Accuracy | Run Stage | Target WR | Description |
|----|----------|-----------|-----------|-------------|
| `new_player` | 50% | Runs 1–3 | ~5–15% | First contact with game and content. Tutorial-level strategy. |
| `developing` | 60% | Runs 4–10 | ~30–50% | Content recognition starting, basic strategy emerging. |
| `competent` | 68% | Runs 11–25 | ~45–65% | All systems understood, strategic play begins. Average engaged player. |
| `experienced` | 76% | Runs 25–50 | ~60–75% | Strong deck knowledge, optimizes most decisions. |
| `master` | 85% | Runs 50+ | ~80–90% | Near-perfect knowledge, near-optimal strategy. Aspirational ceiling. |
| `language_learner` | 35% | Specialty | ~5–10% | Foreign language deck (JLPT/HSK/TOPIK/CEFR) with zero prior knowledge. Game-skilled but content-blind. |

`language_learner` has competent-level game skills (0.25–0.50 axes) but only 35% accuracy — models a player who understands the roguelite systems but is in their first hours with a language deck.

### Legacy Profiles (6) — Deprecated

The original 6 profiles mapped to `BotSkills` vectors. Access via `--profile NAME`.

> **Deprecated for balance work.** Legacy profiles are static archetypes that do not model a realistic player learning curve. Use `PROGRESSION_PROFILES` for balance iteration. Legacy profiles remain available for backward compatibility.

| ID | Accuracy | Strategy Level | Description |
|----|----------|---------------|-------------|
| `first_timer` | 45% | 0 (all axes) | Confused new player, no strategy |
| `casual_learner` | 65% | Low (0.1–0.35) | Some charging, minimal strategy |
| `regular` | 62% | Moderate (0.2–0.5) | Intermediate across all axes |
| `gamer` | 55% | Good (0.4–0.7) | Game-mechanic-savvy, lower knowledge |
| `dedicated` | 70% | High (0.6–0.8) | Solid strategic play |
| `scholar` | 82% | Near-optimal (0.7–0.9) | High accuracy, near-optimal strategy |

Charge breaks even at ~56% accuracy. `gamer` charges less despite good mechanics — models players who prioritize speed over quiz accuracy.

### Archetype Profiles (9)

Strategy composites for testing specific playstyles. Access via `--profile NAME` or `--archetype NAME`.

| ID | Accuracy | Focus | Description |
|----|----------|-------|-------------|
| `turtle` | 60% | `blockSkill=1.0` | Wins through defensive attrition |
| `chain_god` | 80% | `chainSkill=1.0, chargeSkill=0.9` | Sustained charge chains |
| `speedrunner` | 50% | `apEfficiency=1.0, surgeAwareness=1.0` | AP-maximizing, low charge rate |
| `mastery_farmer` | 75% | `masteryHunting=1.0, restSkill=1.0` | Charges high-scaling cards obsessively |
| `quick_player` | 70% | `chargeSkill=0.0` | Never charges — tests no-quiz variance |
| `glass_cannon` | 85% | `chargeSkill=1.0, blockSkill=0.0` | Max offense, ignores HP |
| `balanced_pro` | 75% | All axes 0.8 | Solid all-around, no weaknesses |
| `complete_noob` | 35% | All axes 0 | Worst possible player — sanity check |
| `perfect_player` | 90% | All axes 1.0 | Ceiling test — should win nearly every run |

## Sweep Mode

Sweeps one skill axis from 0→1 in 11 steps (0.0, 0.1, …, 1.0), running `--runs` per step. All other axes fixed at baseline 0.5, accuracy fixed at 0.65. Use to isolate the win-rate impact of a single axis.

```bash
# Sweep chargeSkill axis (11 steps × 200 runs = 2200 total)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 200 --sweep chargeSkill

# Sweep all 10 non-accuracy axes sequentially (10 × 11 steps × 200 runs)
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 200 --sweep all
```

Example output per step: `chargeSkill=0.50  200 runs | Survived: 163/200 (82%) | Avg acts: 2.1 | ...`

**Isolation mode** runs each axis at 1.0 with all others at baseline 0.3 — pure axis contribution, minimal interaction:

```bash
npx tsx --tsconfig tests/playtest/headless/tsconfig.json \
  tests/playtest/headless/run-batch.ts --runs 200 --isolation
```

**Isolation baseline results (2026-03-31):** `rewardSkill` (37%) and `cardSelection` (31%) dominate win-rate contribution. Isolation baseline is now ~8% (down from ~18% before the health vial system replaced flat healing).

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

**`bot-brain.ts`:**
- `BotBrain.planTurn(hand, turnState, ascMods)` — public API; returns ordered `CardPlay[]` plan for the turn
- `BotBrain.pickReward(options, currentDeck)` — selects best card reward; `null` = skip
- `BotBrain.planShop(runState, shopCards, shopRelics, ...)` — returns ordered `ShopAction[]`
- `BotBrain.planRest(runState)` — returns `'heal' | 'study' | 'meditate'`
- `BotBrain.pickRoom(options, runState)` — selects next map node by HP-weighted scoring; called per step when brain is active

**`bot-profiles.ts`:**
- `makeSkills(overrides, baseline)` — builds a `BotSkills` object with baseline fill
- `generateSweepProfiles(axis, steps, baseline, accuracy)` — generates step profiles for sweep mode
- `generateIsolationProfiles(baseline, accuracy)` — one profile per axis at 1.0
- `ALL_PROFILES` — merged lookup for `--profile` flag (legacy + archetype + progression)
- `PROGRESSION_PROFILES` — 6 learning-curve profiles; default set when no `--profile` is given
- `LEGACY_PROFILES` — 6 original profiles (@deprecated for balance work; still accessible via `--profile`)
- `SKILL_AXES` — typed tuple of all 10 non-accuracy axis names

**`simulator.ts`:**
- `runSimulation(opts: SimOptions): SimRunResult` — public API, runs one full sim
- `simulateSingleEncounter(turnState, opts, ascMods)` — inner loop: plays all cards, calls `endPlayerTurn`, checks `checkEncounterEnd`
- `buildSimDeck(deckSize)` — builds starter deck from `STARTER_DECK_COMPOSITION`, fills extras with weighted random mechanics; initializes `masteryLevel: 0` on all sim cards
- `pickRandomEnemy(act, nodeType)` — delegates to `getEnemiesForNode()`

**`browser-shim.ts`:** Must be imported first (`import './browser-shim.js'`). Stubs `localStorage`, `window`, `document`, and `import.meta.env` so game modules load without a browser.

**`tsconfig.json`:** Extends `tsconfig.app.json`, maps `svelte/store` and `svelte` to `./svelte-shim` so Svelte store imports resolve in Node.js.

## Sim Fidelity — AP Surcharge Pre-Check

The simulator pre-checks AP cost before calling `playCardAction()` to skip unaffordable plays. This pre-check **must mirror the real game's surcharge waiver logic** in `turnManager.ts`:

- **Chain momentum** (`nextChargeFreeForChainType`): If the previous Charge was correct on chain X, the next Charge on chain X costs 0 surcharge. Checked first.
- **Surge turns** (`SURGE_FIRST_TURN`, `SURGE_INTERVAL`): Turns matching `turnNumber >= SURGE_FIRST_TURN && (turnNumber - SURGE_FIRST_TURN) % SURGE_INTERVAL === 0` have their surcharge waived.
- **Warcry free charge** (`warcryFreeChargeActive`): Some relics/effects grant one free charge turn.

All three conditions reduce `chargeSurcharge` to 0 before the `totalCost` calculation. If the pre-check doesn't match the real logic, the sim will block plays that the real game would allow for free — causing systematic underestimation of low-skill win rates (they never exploit free charges).

**`wasMomentumFree` field** on `CardPlayRecord`: set to `true` when `play.mode === 'charge' && chargeSurcharge === 0 && CHARGE_AP_SURCHARGE > 0` — i.e., the charge was free due to a waiver that doesn't exist in the base game.

## Recent Bug Fixes (2026-03-31)

The following correctness bugs were fixed in the bot decision logic:

| Bug | Old Behavior | Fix |
|-----|-------------|-----|
| Card EV overestimate | Used `card.baseEffectValue` (2× actual) | Now reads `mechanic.quickPlayValue` |
| Charge wrong EV | Flat 0.25× assumed for all wrong charges | Uses per-mechanic `chargeWrongValue` |
| Block scoring ignored enemy intent | Enemy damage not factored into block decisions | Wired to `turnState.enemy.nextIntent` |
| Mastery not tracked | Sim cards had no `masteryLevel` field | `masteryLevel: 0` initialized on `buildSimDeck()` |
| Chain momentum AP cost | Free-charge turns not detected | Full momentum/surge/warcry pre-check added (2026-04-04) |
| Bot momentum threshold | `chargeSkill >= 0.3` required to exploit free charges | Lowered to `chargeSkill >= 0.1` — free is free |

## Ascension Support

Pass `--ascension N` (0–20). The sim calls `getAscensionModifiers(level)` once and applies all modifiers:
- Enemy HP multipliers, damage multipliers
- Player max HP overrides, starting relic counts
- Per-turn behaviors (regen, combo resets, correct-answer heals)
- A19 free-charging buff, A2 first-turn bonus AP, A9 encounter-start shield
