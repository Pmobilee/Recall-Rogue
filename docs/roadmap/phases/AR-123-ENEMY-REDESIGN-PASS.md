# AR-123: Enemy Redesign Pass (LLM Playtest Findings)

**Status:** PENDING
**Priority:** MEDIUM
**Complexity:** Medium (4 enemy changes + 1 new enemy)
**Dependencies:** None
**Source:** LLM playtest session (2026-03-21) — enemy pressure analysis rated 3 enemies as problematic

---

## Overview

The LLM playtest identified several enemies whose quiz-integration mechanics are either anti-learning, frustrating walls, or purely punitive without creating interesting decisions. This AR addresses the worst offenders and adds a missing archetype.

---

## Sub-step 1: Redesign Void Mite

**Problem:** Heals 5 HP when player answers CORRECTLY on Charge. This creates an anti-learning incentive — players avoid Charging entirely, which directly contradicts the game's "knowledge = power" philosophy.

**New mechanic:** Void Mite now **drains 3 block** from the player when they answer correctly on Charge (instead of healing). This preserves the "cost of knowledge" dilemma without punishing correct answers with enemy healing.

- Correct Charge: enemy loses HP as normal, but player loses 3 block
- Wrong Charge: normal wrong-answer penalty, no block drain
- Quick Play: normal damage, no interaction

**Acceptance criteria:**
- [ ] Void Mite no longer heals on correct answers
- [ ] Block drain of 3 on correct Charge is implemented
- [ ] Enemy description/tooltip updated
- [ ] docs/GAME_DESIGN.md updated

---

## Sub-step 2: Nerf Core Harbinger Quick Play Immunity

**Problem:** "Immune to Quick Play damage" removes all player flexibility. Weak quiz knowledge = unwinnable wall, not a challenge.

**New mechanic:** Core Harbinger takes **30% damage from Quick Play** (down from 0%). Charging is still much better (full damage), but Quick Play isn't completely useless.

**Acceptance criteria:**
- [ ] Quick Play deals 30% damage to Core Harbinger (not 0%)
- [ ] Charge still deals full damage
- [ ] Enemy description updated to reflect "resistant to" instead of "immune to"
- [ ] docs/GAME_DESIGN.md updated

---

## Sub-step 3: Redesign Bone Collector

**Problem:** Heal-on-wrong-answer is just punishment that delays fights. Doesn't create interesting strategic decisions.

**New mechanic:** Bone Collector **steals player block** (up to 5) when player answers wrong on Charge. This creates counterplay — build block BEFORE Charging to have a buffer, or skip Charging if you can't afford to lose block.

**Acceptance criteria:**
- [ ] Bone Collector steals up to 5 block on wrong Charge (not heal 5 HP)
- [ ] If player has 0 block, no steal occurs (no penalty beyond wrong-answer multiplier)
- [ ] Enemy description updated
- [ ] docs/GAME_DESIGN.md updated

---

## Sub-step 4: Add Enemy Intent Variation

**Problem:** Enemy attack patterns are fully predictable (Attack→Defend→Attack→Charge→BigHit repeats identically). Creates boring pattern recognition.

**Fix:** Add 2-3 intent variants per enemy. Randomize which pattern they use each cycle. For example, Crystal Golem might sometimes do Attack→Attack→Charge instead of Attack→Defend→Charge.

**Acceptance criteria:**
- [ ] At least 3 Act 1-2 enemies have intent variation
- [ ] Variation is seeded (deterministic per encounter seed)
- [ ] Enemy intent display still shows correct upcoming action
- [ ] docs/GAME_DESIGN.md updated

---

## Sub-step 5: New Enemy — Knowledge Accumulator

**Concept:** An enemy that gains +2 Strength per CORRECT Charge answer. Creates a "confidence vs caution" dilemma — Charging for power also powers up the enemy.

**Stats:** HP 45, base damage 8, Act 2 enemy
**Trait:** `knowledgeAbsorb` — gains +2 permanent Strength each time player answers a Charge quiz correctly in this encounter

**Strategic tension:** Aggressive players Charge everything for burst damage but the enemy scales. Conservative players Quick Play to keep enemy weak but lose Charge power. Optimal play is selective Charging of high-value cards only.

**Acceptance criteria:**
- [ ] New enemy defined in enemy data
- [ ] `knowledgeAbsorb` trait implemented in combat resolution
- [ ] Sprite placeholder (can use existing Act 2 sprite temporarily)
- [ ] docs/GAME_DESIGN.md updated with new enemy entry

---

## Sub-step 6: Per-Card Win Contribution Tracking (Headless Sim Enhancement)

**Problem:** The headless sim tracks `cardsPlayed` count per encounter but NOT which card mechanic was played or how it contributed to wins/losses. We need per-card data to make balance decisions.

**Enhancement to `tests/playtest/headless/simulator.ts`:**

Track each card play with:
```typescript
interface CardPlayRecord {
  mechanic: string;      // e.g., 'strike', 'empower', 'hex'
  wasCharged: boolean;
  answeredCorrectly: boolean;
  damageDealt: number;
  chainLength: number;   // chain position at time of play
  wasMomentumFree: boolean;
}
```

Aggregate per-mechanic across all runs in a profile:
- **Pick rate**: how often this mechanic appears in winning vs losing decks
- **Win-rate-when-picked**: win rate of runs that had this mechanic
- **Avg damage contribution**: total damage dealt by this mechanic / total runs
- **Charge-vs-QP ratio**: how often this card gets Charged vs Quick Played
- **Accuracy-when-Charged**: correct rate specifically for this mechanic

Output as `per_card_stats` in the JSON results alongside existing encounter data.

**This replaces the need for `/advanced-balance` skill** — the data comes directly from the sim, not a separate analysis tool.

**Files:**
- `tests/playtest/headless/simulator.ts` — Add CardPlayRecord tracking in the play loop
- `tests/playtest/headless/run-batch.ts` — Aggregate and output per-card stats

**Acceptance criteria:**
- [ ] Each card play records mechanic, charge/QP, correct/wrong, damage, chain
- [ ] Per-mechanic stats aggregated in batch output JSON
- [ ] Can identify "always picked" and "never picked" mechanics
- [ ] Can identify mechanics with unusually high/low win contribution

---

## LLM Playtest Insights (Source Data)

### Enemy Design Rankings (from 6-encounter analysis)

**Best designed (create interesting decisions):**
1. **Fossil Guardian** — "Must Charge 1/turn" forces engagement without removing choice. Player decides WHICH card to Charge (safest option). Graduated pressure, not punishment.
2. **Shadow Mimic** — Copies wrong-answer effects against player. Creates card-by-card risk assessment: Reckless is terrifying to Charge (12 dmg reflected), Block is safe. Genuine tension.
3. **The Curator** — Quiz phases at 66% and 33% HP transform combat into forward-planning puzzle. "Do I trigger the phase now or next turn?" Every turn becomes meaningful.

**Worst designed (need redesign):**
1. **Void Mite** — Heals on CORRECT answers. Players avoid Charging = anti-learning. Rated worst by all agents.
2. **Core Harbinger** — QP immunity removes flexibility. Weak knowledge = unwinnable wall.
3. **Bone Collector** — Heal-on-wrong is punishment without counterplay. Just delays fights.

### Missing Enemy Archetype

The "Knowledge Accumulator" fills a gap: an enemy that gets stronger from correct answers, creating a "confidence vs caution" dilemma. Unlike Void Mite (which punishes learning), this respects the player's knowledge while creating tempo pressure — you CAN Charge for power, but the enemy scales, so you want to kill fast.

### Onboarding Insights (from casual gamer perspective)

- **#1 delight moment:** "Oh! I'm learning Japanese while fighting!" — the quiz connection clicks immediately
- **#1 confusion point:** AP economy (base cost vs surcharge, why Charge costs vary)
- **Retention prediction:** 70% chance casual player returns after 1 session
- **vs Duolingo:** More fun moment-to-moment, less habit-forming without streaks/leaderboards

### Deck Building Insights

- Clear synergy paths exist (Empower+Double Strike, chain focusing, AP economy)
- But they're hidden — new players just pick "highest damage card"
- Deck size tension (more cards = slower cycle) is real but not felt until too late
- Card removal is underrated by players who don't understand deck thinning
- **Comparison to Slay the Spire:** Better mechanics (mastery, fact-pairing, chains) but weaker decision scaffolding (no tooltips, no early synergy hints)

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Headless sim runs with enemy changes (including per-card tracking)
- [ ] Visual inspection of each changed enemy in combat
- [ ] Re-run LLM playtest on redesigned enemies to verify decision quality
