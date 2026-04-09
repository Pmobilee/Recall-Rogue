---
name: advanced-balance
description: |
  Extended balance analysis beyond basic win rates: per-card win-rate contribution, tension metrics (HP-at-death, turns-to-outcome, meaningful-choice ratio), and predictability scoring. PROACTIVELY SUGGEST when new cards, relics, or enemies are added — these metrics catch problems the basic headless sim misses.
user_invocable: true
---

# Advanced Balance Analysis

## When to Use

- After any balance change (card values, enemy stats, relic effects)
- When adding new cards or mechanics — run per-card metrics to see if they're picked/played
- When win rates look fine but gameplay "feels off" — tension metrics explain why
- When a fight seems decided before it starts — predictability scoring confirms it
- **PROACTIVE TRIGGER**: Mention this whenever balance, new cards, new enemies, or relics are discussed

## Three Analysis Layers

### Layer 1: Per-Card Win-Rate Contribution

Track which cards are played, how often, and whether playing them correlates with winning.

**What it reveals:**
- Cards picked but never played = dead weight in deck
- Cards with disproportionate win-rate impact = OP or required
- Cards always skipped at reward = boring/weak
- Cards only strong in specific matchups = niche (OK) vs. too niche (problem)

**NOW IMPLEMENTED via `--analytics`:**
Run `npm run sim:analytics` to generate `card-analysis.md` and `card-analysis.json` in `data/playtests/runs/{timestamp}/analytics/`. These files contain pre-computed per-mechanic win rate correlation, deck type distributions, and play frequency data across all profiles.

**Key metrics:**
- `playRate`: % of runs where this card was played at least once
- `winContribution`: win rate of runs where card was played vs. not played
- `chargeRate`: % of plays that were Charge vs Quick Play (high = worth the AP investment)
- `correctImpact`: win rate when Charged correctly vs. incorrectly

### Layer 2: Tension Metrics (Feel Proxies)

Numbers can't capture "feel" directly, but these metrics proxy for it:

**HP at Death** — How close were losses?
- If most deaths are at 1-15 HP: fights feel close and dramatic (good)
- If most deaths are at 50+ HP: fights feel hopeless (bad — enemy is overtuned or player has no recovery)

**Turns to Outcome** — How early is the fight decided?
- If fights end in 3-4 turns: too fast, no strategy develops
- If fights drag past 20 turns: too slow, player is just grinding
- Sweet spot: 6-12 turns for regular, 10-18 for bosses

**Meaningful Choice Ratio** — What % of turns had a non-obvious best play?
- If the optimal play is always "play highest damage card": no real choice (bad)
- If players must weigh block vs attack vs charge vs quick play: genuine tension (good)
- Measure by checking if the heuristic bot's choice matches the "optimal" choice in >90% of turns

**Comeback Frequency** — How often does a player at <30% HP end up winning?
- High (>15%): game has rubber-banding and hope (good for engagement)
- Low (<5%): once you're losing, you've lost (feels unfair)

**These tension metrics are pre-computed in `balance-report.md`** — the analytics run generates avg turns, HP at death distributions, and per-profile fight length data automatically.

### Layer 3: Predictability Scoring

Can you predict win/loss from the state at turn 1?

**Method:** Run a simple logistic regression on headless sim output:
- Features: deck composition (% attack/shield/utility/buff/debuff), enemy ID, relic set, starting HP
- Target: win/loss
- If accuracy >80%: the fight is predetermined — player agency is an illusion

**What it reveals:**
- Which matchups are auto-wins or auto-losses regardless of play
- Whether certain relic combos guarantee victory
- Whether deck composition matters more than play skill (bad for a skill-based game)

**Pre-computed in `correlation-report.md`** — the analytics run computes top positive/negative balance correlations and predictability insights automatically.

## Usage

Run the full analytics suite:
```
npm run sim:analytics
```

This runs 1000+ simulations across all profiles and generates 9 analytics reports in `data/playtests/runs/{timestamp}/analytics/`:

**Original 6 (observational):**
- `card-analysis.md` — per-card win-rate contribution (Layer 1)
- `balance-report.md` — tension metrics: avg turns, HP at death (Layer 2)
- `correlation-report.md` — predictability and balance insights (Layer 3)
- `enemy-analysis.md` — per-enemy difficulty, deadliest enemies, floor difficulty curve
- `relic-analysis.md` — relic impact, combos, category win rates (⚠️ survivorship bias)
- `archetype-analysis.md` — build viability comparison (8 archetype builds)

**3 new survivorship-free reports (Pass 6, 2026-04-09):**
- `relic-performance.md` — per-relic avg floors after acquisition, damage/AP, power score. Uses RelicAcquisition timeline to compute causal impact.
- `card-performance.md` — per-card damage/AP efficiency, charge rate, floor delta. The KEY card balance metric.
- `archetype-performance.md` — HP efficiency, deck diversity (Shannon entropy), avg floors reached.

**IMPORTANT:** The old `relic-analysis.md` uses observational win rates which are almost entirely survivorship bias (proven 2026-04-04). Always prefer `relic-performance.md` for relic balance decisions.

Read these files before doing any manual analysis — they contain pre-computed insights across all three layers.

## Relationship to Other Skills

- **Headless sim** provides the raw data (`npm run sim:analytics` runs it automatically)
- **Balance check** (`/balance-check`) provides the basic narrative report
- **This skill** goes deeper with per-card, tension, and predictability analysis
- **LLM playtest** (`/llm-playtest`) complements with qualitative reasoning about specific states
