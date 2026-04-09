# Headless Balance Simulator

> **Purpose:** How to run the headless combat simulator for balance testing — profiles, output format, and key internals.
> **Last verified:** 2026-04-08 (Ch12.2 bot heuristic improvements — block priority + HP-aware charge decisions)
> **Source files:** `tests/playtest/headless/simulator.ts`, `tests/playtest/headless/run-batch.ts`, `tests/playtest/headless/sim-worker.ts`, `tests/playtest/headless/browser-shim.ts`, `tests/playtest/headless/tsconfig.json`, `tests/playtest/headless/full-run-simulator.ts`, `tests/playtest/headless/bot-brain.ts`, `tests/playtest/headless/bot-profiles.ts`

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

**Performance:** ~6,000 runs in 5 seconds (single-threaded). With parallel execution on a 14-core machine (12 workers): 60,000 runs across 6 profiles in ~20-30 seconds. tsx v4 propagates its loader to worker threads automatically — no extra configuration needed.

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
| `--runs N` | 10000 | Runs per profile |
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
| `--parallel` | ON | Enable parallel execution (default: on) |
| `--no-parallel` | — | Disable parallel, run sequentially |
| `--workers N` | min(cpus-2, 12) | Number of worker threads (parallel mode only) |


## Parallel Execution

`run-batch.ts` distributes simulation work across worker threads by default. Each profile's runs are split into equal chunks (one chunk per worker) and all workers run concurrently. Results are merged before reporting.

**Default worker count:** `Math.min(os.cpus().length - 2, 12)`. Leaves 2 cores for OS/other work, caps at 12 to avoid diminishing returns from IPC overhead.

**tsx compatibility:** tsx v4's IPC-based ESM loader is NOT automatically inherited by worker threads spawned from a different `.ts` file. The fix is a plain `.mjs` bootstrap file (`tsx-worker-bootstrap.mjs`) that calls `tsx/esm/api`'s `register()` to activate tsx's ESM hooks, then dynamically imports the actual worker. `run-batch.ts` spawns `Worker(bootstrapPath, { workerData: { workerFile: '...' } })` — the bootstrap registers tsx and imports the worker file. This enables `.js` → `.ts` extension remapping for all downstream imports like `'./browser-shim.js'`.

**Worker file:** `sim-worker.ts` receives a `WorkerTask` message (mode, profile, run count, options), runs the requested simulations, and posts back a `WorkerResult` with the results array. Imports `browser-shim.js` before any game code.

**Progress output per profile:**
```
    [ 4/12 workers] competent: 833 runs done
    [ 8/12 workers] competent: 833 runs done
    [12/12 workers] competent: 834 runs done
```

**Aggregation:** Happens in the main thread after all workers for a profile complete. Output (JSON, README.md, mechanic stats) is identical to sequential mode.

**Disable:** `--no-parallel` falls back to the original sequential loop.

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

1. `_orderHand()` — scores/sorts hand using `cardSelection`, `chainSkill`, `blockSkill`, `apEfficiency`, and damage-threat ratio
2. Iterates ordered hand; checks AP budget, calls `_decideMode()` per card → `charge` or `quick`
3. `_decideMode()` — tiered thresholds for `chargeSkill`, `surgeAwareness`, `masteryHunting`; receives `playerHpPct` + `enemyNextDamage` for HP-aware override logic
4. Returns `CardPlay[]` — `{ cardId, mode }` pairs. **The simulator rolls accuracy, not the brain.**

Other methods: `pickReward()`, `planShop()`, `planRest()`, `pickRoom()` — each driven by its axis.

### HP-Aware Heuristics (Ch12.2, 2026-04-08)

Added to survive `GLOBAL_ENEMY_DAMAGE_MULTIPLIER=2.0`:

**Block priority in `_orderHand()`:**
- Emergency block threshold lowered: triggers at  (was 0.3). With doubled damage, waiting until 30% HP is often fatal.
- Urgency scales continuously: 50% HP → 1.0× bonus, 0% HP → 2.0× bonus.
- Smart-block triggered at `blockSkill >= 0.3` (was 0.7) — any player with some block awareness responds to incoming attacks.
- Damage-threat ratio: if `enemyNextDamage >= 30% of current HP`, shields get +150 bonus × skill.
- Survival-critical override: if `enemyNextDamage >= 60% of current HP`, shields get +400 bonus (overrides most other scores).
- Attack base bonus reduced when `damageThreatRatio > 0` and `blockSkill >= 0.3`.

**Charge decision in `_decideMode()`:**
- Shield cards: forced quick-play when `acc < 0.72` AND (`playerHpPct < 0.40` OR `damageThreatRatio >= 0.30`). High-accuracy bots (master: 0.85) still charge shields for the 1.75× CC multiplier.
- Attack cards: forced quick-play when `playerHpPct < 0.25` AND `acc < 0.65`. Avoids wasting AP surcharge on a fizzle when survival is at risk.

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

- **`HEALTH_VIAL_DROP_CHANCE` (10%)** — health vial drops on regular combat nodes
  - **Small vial** (70% of drops): restores 8–18 HP
  - **Large vial** (30% of drops): restores 20–35 HP
- **Elite and boss nodes** — always drop a health vial (guaranteed)
- **Regular combat** — 10% chance per `HEALTH_VIAL_DROP_CHANCE` in `balance.ts`

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

**Observed win rates with GLOBAL_ENEMY_DAMAGE_MULTIPLIER=2.0 (2026-04-08 Ch12.2):**

| Profile | Pre-Ch12.1 (baseline) | Post-Ch12.1 (before fix) | Post-Ch12.2 (after bot fix) |
|---------|----------------------|--------------------------|------------------------------|
| new_player | ~10% | 0% | 0% |
| developing | ~35% | 0% | 0% |
| competent | ~55% | 0% | 0% |
| experienced | ~46% | 1% | ~9% |
| master | ~93% | 15% | ~31% |
| language_learner | ~5% | 0% | 0% |

The x2 damage multiplier was intentional (Ch12.1). Ch12.2 bot fixes ensure bots represent realistic player behavior at the new difficulty level rather than underperforming due to pre-x2 heuristics. The remaining low win rates for developing/competent/new_player reflect genuine difficulty with the x2 multiplier — a balance concern separate from heuristic quality.

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
- `masteryDistribution: number[]` — [L0count, L1, L2, L3, L4, L5] from `runState.deck` at run end
- `avgMasteryLevel: number` — mean mastery level across final deck
- `totalMasteryUpgrades: number` — total upgrades earned during the run
- `totalChargedPlays: number` — total charge plays across all encounters
- `totalQuickPlays: number` — total quick plays across all encounters
- `chargeSuccessRate: number` — correctWhenCharged / totalChargedPlays (0 if no charges)
- `damageFromCharges: number` — cumulative damage attributed to charged plays
- `damageFromQuickPlays: number` — cumulative damage attributed to quick plays
- `isNearMiss: boolean` — `!survived && (actsCompleted >= 2 || lastEnemyHpPct < 0.25)` — target 25-30%
- `deathFloor: number` — floor where the player died (0 if survived)
- `lastEnemyHpPct?: number` — enemy HP% on the fatal encounter
- `minHpSeen: number` — lowest HP reached during the run
- `isComeback: boolean` — `survived && minHpSeen < maxHp * 0.3` — great tension indicator
- `avgTurnsPerEncounter: number` — total turns / total encounters

## New Metrics Reference (2026-04-05)

Seven upgrades added to the simulator to expose deeper player behavior and balance signals:

### 1. Mastery Tracking
Scans `runState.deck` at run end (card objects are shared references — no sync needed).
Reports per-level distribution and average, plus total upgrades earned mid-run.

### 2. Charge Breakdown
Per-encounter `chargedPlays`, `quickPlays`, `correctWhenCharged`, `damageFromCharges`,
`damageFromQuickPlays` — aggregated into `FullRunResult`. Use charge DMG% to see if
the knowledge mechanic is contributing to damage.

### 3. Near-Miss Detection
`isNearMiss = !survived && (actsCompleted >= 2 || lastEnemyHpPct < 0.25)`.
**Target: 25-30% of deaths.** Higher = good tension; if near-miss rate is high, check
if players are consistently reaching Act 3 but barely dying.

### 4. Per-Floor HP Curve
`computeHpCurve(results, PLAYER_START_HP)` reconstructs HP trajectory from
`nodeVisits[].hpChange`. Saved as `hpCurve` in per-profile JSON and in README tables.
Use to spot floors where HP collapses unexpectedly.

### 5. Cross-Run Delta
Before updating the `latest` symlink, reads `latest/combined.json` and computes
win-rate / charge-rate / mastery / near-miss deltas per profile. Prints a comparison
table and saves `delta.md` in the output directory.

### 6. Tension Metrics
`isComeback`, `minHpSeen`, `avgTurnsPerEncounter` — diagnose whether runs feel tense
(comebacks) or swingy (min HP near 0 all the time).

### 7. Profile-Parallel Execution
When running all 6 progression profiles, all profile×chunk tasks are dispatched to a
shared pool of N workers (`runAllProfilesParallel()`), rather than running profiles
sequentially. Each profile's chunks are independent tasks; workers process them in
arrival order. Expected 3-5× speedup for multi-profile batches vs sequential profiles.

**sim-worker.ts:** Updated to a persistent message loop — handles multiple tasks before
receiving a `{ type: 'shutdown' }` signal. Falls back to single-task behavior if the
incoming message has no `type` field (backward compat).

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

## Heuristic Improvements (2026-04-08, Ch12.2)

Bot heuristics updated to survive `GLOBAL_ENEMY_DAMAGE_MULTIPLIER=2.0`:

| Change | Rationale |
|--------|-----------|
| Emergency block threshold: 30% HP → 50% HP | With 2x damage, 30% HP was too late to start blocking |
| Smart-block trigger: `blockSkill >= 0.7` → `>= 0.3` | Any player with block awareness should respond to incoming attacks |
| Urgency scaling: continuous 1.0×2.0 curve vs flat 200pts | Gradual escalation models real player behavior better than hard threshold |
| Damage-threat ratio scoring | Shields get +150 when enemyDamage >= 30% current HP; +400 at >= 60% |
| Shield quick-play gate: acc < 0.72 | Only force guaranteed block when fizzle risk is meaningful (>28%); high-acc bots still charge |
| Attack quick-play gate: HP < 25% AND acc < 65% | Avoids AP surcharge waste on fizzle when survival matters more than EV |
| `_decideMode` receives HP context | `playerHpPct`, `enemyNextDamage`, `playerCurrentHP` now passed through |

## Fidelity Bug Fixes (2026-04-09)

Eight correctness bugs fixed to reduce sim-vs-real-game drift:

| Bug | Files | Old Behavior | Fix |
|-----|-------|-------------|-----|
| HP tracking approximation | both | `currentHP - damageTaken` missed relic heals, poison, lethal saves | `finalPlayerHp: turnState.playerState.hp` returned from `simulateSingleEncounter` |
| Health vial drop rate | full-run-sim | Hardcoded 25% | Uses `HEALTH_VIAL_DROP_CHANCE` (10%) from `balance.ts`; elite/boss always drop |
| Canary reimplementation | both | Manual `wrongsThisEncounter` counter, no HP multiplier, no streak tracking | Uses `canaryService.ts` (`createCanaryState`, `recordCanaryAnswer`, `resetCanaryFloor`); state threads through encounters |
| Bot gives up on blocked cards | both | `break` on blocked card, abandoning rest of hand | `blockedCardIds.add(card.id); continue` — tries remaining cards in plan |
| Transmute dead weight | both | Transmute cards in starter deck wasted a slot | Replaced with `strike` in `buildSimDeck()` and `buildStarterDeck()` |
| Mastery lost after each encounter | full-run-sim | `createDeck()` made copies; mastery upgrades lost when deck object discarded | After encounter, syncs `encounterCard.masteryLevel` back to `runState.deck` cards |
| No catch-up mastery on rewards | full-run-sim | New reward cards always started at mastery 0 | New cards start at `floor(avgMastery * 0.75)` |
| Stale AP surcharge comments | simulator | Comments said "CHARGE_AP_SURCHARGE = 0" (wrong) | Fixed to say "CHARGE_AP_SURCHARGE applied below" |

**Canary state threading:** `CanaryState` is now initialized in `runSimulation()` / `simulateFullRun()`, reset per-floor via `resetCanaryFloor()` before each encounter, updated per-answer via `recordCanaryAnswer()` inside `simulateSingleEncounter()`, and the updated state returned alongside the result for carry-over across encounters. Enemy HP multiplier from Canary is applied at enemy creation time; enemy damage multiplier is applied to `turnState.canaryEnemyDamageMultiplier` before each `endPlayerTurn()` call.

## Ascension Support

Pass `--ascension N` (0–20). The sim calls `getAscensionModifiers(level)` once and applies all modifiers:
- Enemy HP multipliers, damage multipliers
- Player max HP overrides, starting relic counts
- Per-turn behaviors (regen, combo resets, correct-answer heals)
- A19 free-charging buff, A2 first-turn bonus AP, A9 encounter-start shield
