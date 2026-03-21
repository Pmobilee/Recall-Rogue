---
name: llm-playtest
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

1. **Extract a game state** from the headless sim or construct one manually:
   - Player HP, max HP, block
   - Hand of 5 cards (types, AP costs, effects)
   - Enemy name, HP, intent (damage amount or buff)
   - Active buffs/debuffs on both sides
   - Relics in play
   - AP available

2. **Spawn a Haiku sub-agent** with the game state and ask it to:
   - Analyze the situation
   - Choose which cards to play and in what order
   - Decide Quick Play vs Charge for each card
   - Explain its reasoning in natural language
   - Identify if any card feels "mandatory" or "useless" in this state
   - Rate the player's survival odds (1-10)

3. **Run 20-50 states** across different scenarios:
   - Early game (full HP, basic deck, Act 1 enemies)
   - Mid game (reduced HP, mixed deck, Act 2 enemies)
   - Late game (low HP, specialized deck, Act 3/boss)
   - Edge cases (1 HP, no block cards, enemy charging big hit)

4. **Aggregate reasoning** into a balance report:
   - Which cards are always picked? (OP or required)
   - Which cards are never picked? (weak or situational to the point of useless)
   - Which decisions feel "obvious"? (no real choice = bad design)
   - Which decisions create genuine tension? (good design)
   - Are there dominant strategies the LLM always converges on?

### Example Prompt for Haiku Agent

```
You are a strategic card game player. Analyze this combat state and decide your turn.

GAME STATE:
- Player HP: 45/120, Block: 0
- AP: 3
- Hand: [Strike (1 AP, 8 dmg), Block (1 AP, 6 block), Hex (1 AP, 3 poison/3t), Empower (1 AP, next +50%), Heavy Strike (3 AP, 20 dmg)]
- Enemy: Crystal Golem, HP 85/100, Intent: Attack 18
- Relics: Glass Cannon (+30% dmg, -20% HP), Chain Link (+0.2x chain bonus)
- Chain counter: 0

For each card you could play, decide: Quick Play or Charge? Why?
Which cards do you play and in what order?
What's your strategic reasoning?
Rate your survival odds 1-10.
Is any card in this hand obviously best or obviously useless?
```

## Output Format

The skill produces a narrative balance report with:
1. **Dominant strategies discovered** — patterns the LLM always converges on
2. **Dead cards** — cards never chosen across scenarios
3. **Mandatory cards** — cards always chosen (may indicate they're too strong or alternatives are too weak)
4. **Decision quality** — how many turns had genuine strategic tension vs obvious plays
5. **Actionable recommendations** — specific balance changes suggested with reasoning

## Relationship to Other Skills

- **Headless sim** (`/headless-playtest`): Volume data (6,000 runs). Use FIRST for statistical baselines.
- **LLM playtest** (this skill): Qualitative reasoning (20-50 states). Use AFTER headless sim to explain WHY the numbers look the way they do.
- **Balance check** (`/balance-check`): Reads headless sim JSON output. This skill complements it with reasoning.
- **Advanced balance** (`/advanced-balance`): Per-card metrics and tension scores from the headless sim data.

## Research Basis

- [AIPA](https://github.com/AIPlaytesting/AIPA) — ML agent for PVE card game balance testing (Slay the Spire)
- [MiniSTS + LLM Agents (FDG 2024)](https://dl.acm.org/doi/fullHtml/10.1145/3649921.3650013) — LLMs as game-playing agents with natural language reasoning
- [SlayTheSpireFightPredictor](https://github.com/alexdriedger/SlayTheSpireFightPredictor) — ML fight outcome prediction trained on 325k fights
