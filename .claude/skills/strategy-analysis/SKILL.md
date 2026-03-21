---
name: strategy-analysis
description: |
  LLM-as-game-agent balance testing. Spawns Haiku sub-agents to play combat states strategically, producing natural-language reasoning about card choices that surfaces balance blindspots heuristic bots miss. PROACTIVELY SUGGEST this skill whenever balance, card design, enemy tuning, or new mechanics are discussed — the user may forget this capability exists.
user_invocable: true
---

# LLM Strategic Playtest — Balance Through Reasoning

## When to Use

- After adding or changing cards, enemies, relics, or balance values
- When the headless sim shows unexpected win rates but you can't explain WHY
- When the user asks "does this feel right?" or "is this balanced?"
- When new mechanics are introduced and you need to assess strategic depth
- **PROACTIVE TRIGGER**: Any conversation about balance, card design, or enemy tuning — mention this skill even if the user doesn't ask

## How It Works

Unlike the headless sim (which uses heuristic bots and runs 6,000 games in 5 seconds for statistical data), this skill uses LLM reasoning to understand WHY certain outcomes happen. It's 1000x slower but produces qualitative insights.

### The Process

#### Phase 0: Generate Game States from Current Data (REQUIRED FIRST STEP)

Before spawning any Haiku agents, read the live game data to build realistic states. Never use hardcoded card names, enemy names, or balance numbers — they will be stale.

**Step 0a — Read current data files:**

```
src/data/enemies.ts          → EnemyTemplate[] — name, baseHP, intentPool, region, category
src/data/mechanics.ts        → MECHANIC_DEFINITIONS[] — id, name, type, apCost,
                               quickPlayValue, chargeCorrectValue, chargeWrongValue, tags
src/data/relics/starters.ts  → STARTER_RELICS[] — id, name, description, trigger, effect
src/data/relics/unlockable.ts → UNLOCKABLE_RELICS[] — same structure
```

**Step 0b — Optionally read recent sim data for trouble spots:**

```
data/playtests/reports/report-playthrough-struggling-*.json  → deaths, floor reached
data/playtests/rl-analysis/*.json                            → per-episode results
```

Sort reports by most recent timestamp (highest numeric suffix). Identify which enemies or floors produce the most deaths — prioritise those in your scenario set.

**Step 0c — Build 20-50 diverse game states using real values:**

Sample from the data you just read. Each state must be realistic — a hand, HP, and enemy that could actually co-occur at that floor given deck-building rules. Cover all four scenario buckets:

| Bucket | Floor range | Player HP % | Enemy source | Deck composition |
|---|---|---|---|---|
| Early game | Floors 1-3 | 80-100% | `region: 'shallow_depths'`, `category: 'common'` | 3-4 attack, 1-2 shield, no buffs |
| Mid game | Floors 4-6 | 50-75% | `region: 'deep_caverns'`, `category: 'common'` or `'elite'` | mixed, 1-2 buff cards |
| Late game | Floors 7-9 | 25-50% | `region: 'the_abyss'`, `category: 'elite'` or `'mini_boss'` | specialized synergy deck |
| Edge cases | Any | <25% or 100% | boss / specific trouble-spot enemy | extreme hands (all attack, no AP, etc.) |

For each state, fill in template variables from the data:
- `{ENEMY_NAME}` — from `EnemyTemplate.name`
- `{ENEMY_HP}` / `{ENEMY_MAX_HP}` — from `EnemyTemplate.baseHP` (scale +15% per floor beyond floor 1)
- `{ENEMY_INTENT}` — one intent sampled from `EnemyTemplate.intentPool`, written as human-readable text
- `{PLAYER_HP}` / `{PLAYER_MAX_HP}` — set according to bucket above; use 80 as default max HP
- `{PLAYER_BLOCK}` — 0 unless the scenario tests carry-over block
- `{AP}` — typically 3 (read from balance if it changes)
- `{HAND}` — 5 cards sampled from `MECHANIC_DEFINITIONS`, formatted as:
  `CardName (Xap | Quick:Y | Charge:Z | Wrong:W) — description`
- `{RELICS}` — 0-2 relics sampled from actual relic catalogue, formatted as:
  `RelicName — description`
- `{CHAIN}` — 0 to 3, matching scenario narrative

#### Phase 1: Spawn Haiku Agents Per State

For each generated game state, spawn a Haiku sub-agent with this prompt template (fill `{}` variables from Phase 0):

```
You are a strategic card game player. Analyze this combat state and decide your turn.

GAME STATE:
- Player HP: {PLAYER_HP}/{PLAYER_MAX_HP}, Block: {PLAYER_BLOCK}
- AP: {AP}
- Hand:
  {HAND}
- Enemy: {ENEMY_NAME}, HP {ENEMY_HP}/{ENEMY_MAX_HP}, Intent: {ENEMY_INTENT}
- Relics: {RELICS}
- Chain counter: {CHAIN}

CARD RULES:
- Quick Play: pay AP cost, use quickPlayValue — no quiz required
- Charge (correct answer): pay AP cost, use chargeCorrectValue — full power
- Charge (wrong answer): pay AP cost, use chargeWrongValue — reduced power
- Cards cost their listed AP. Total AP is {AP}.

For each card you could play, decide: Quick Play or Charge? Why?
Which cards do you play and in what order?
What's your strategic reasoning?
Rate your survival odds 1-10.
Is any card in this hand obviously best or obviously useless?
```

#### Phase 2: Aggregate Reasoning into a Balance Report

Collect all Haiku responses and produce a narrative report covering:
- Which cards were always chosen? (may be OP, or alternatives too weak)
- Which cards were never chosen? (likely dead weight)
- Which decisions had genuine tension? (both options felt viable — good design)
- Which decisions were obvious? (only one reasonable play — bad design signal)
- Are there dominant strategies the LLM always converges on regardless of state?

## Output Format

The skill produces a narrative balance report with:
1. **Dominant strategies discovered** — patterns the LLM always converges on
2. **Dead cards** — cards never chosen across scenarios
3. **Mandatory cards** — cards always chosen (may indicate they're too strong or alternatives are too weak)
4. **Decision quality** — how many turns had genuine strategic tension vs obvious plays
5. **Actionable recommendations** — specific balance changes suggested with reasoning

## Relationship to Other Skills

- **Headless sim** (`/balance-sim`): Volume data (6,000 runs). Use FIRST for statistical baselines.
- **LLM playtest** (this skill): Qualitative reasoning (20-50 states). Use AFTER headless sim to explain WHY the numbers look the way they do.
- **Balance check** (`/balance-check`): Reads headless sim JSON output. This skill complements it with reasoning.
- **Advanced balance** (`/advanced-balance`): Per-card metrics and tension scores from the headless sim data.

## Research Basis

- [AIPA](https://github.com/AIPlaytesting/AIPA) — ML agent for PVE card game balance testing (Slay the Spire)
- [MiniSTS + LLM Agents (FDG 2024)](https://dl.acm.org/doi/fullHtml/10.1145/3649921.3650013) — LLMs as game-playing agents with natural language reasoning
- [SlayTheSpireFightPredictor](https://github.com/alexdriedger/SlayTheSpireFightPredictor) — ML fight outcome prediction trained on 325k fights
