# Arcane Recall — Game Design (Single Source of Truth)

> **One-line summary:** Card roguelite where every card is a fact — answer to attack, build your knowledge deck, the deeper you delve the stronger you become.

---

## 1. Core Philosophy

### The Golden Rule — Learning IS Gameplay

Every design decision must pass this test: **if you remove the educational content, does the game cease to function?**

- **YES (correct):** Without facts on cards, there are no cards. No cards, no combat. No combat, no game. Facts are structurally required. This is "intrinsic integration."
- **NO (wrong):** If you could replace facts with random button presses and the game still works, the learning is decorative. This is "chocolate-covered broccoli." Reject the design.

Reference: Habgood & Ainsworth (2011) demonstrated that intrinsic integration produced significantly more learning AND 7x longer voluntary play time than extrinsic quiz-overlay designs. A 2022 ACM follow-up (n=210) confirmed the mechanism is attentional — players process what the game task demands, so when learning IS the task, attention locks onto educational material automatically.

### The Anti-Prodigy Principle

Prodigy Math Game (150M+ users, ~$50M/yr revenue) uses quizzes as a toll gate to RPG combat. Result: children spend ~3 min on math per 20 min of play. 888 questions needed to raise a standardized test score by one point. Children optimize around the learning.

Arcane Recall inverts this. There is nothing to do EXCEPT engage with facts. Every card play, every deck-building choice, every reward selection involves a fact. The optimization path and the learning path are identical.

### Three Systems Only

| # | System | Purpose |
|---|--------|---------|
| 1 | Card Combat | Turn-based encounters; playing cards requires answering facts |
| 2 | Deck Building | Selecting and evolving fact-cards between encounters |
| 3 | Run Progression | Depth-based dungeon descent with retreat-or-delve risk/reward |

Everything else (crafting, farming, companions, overworld hub, prestige) is cut.

---

## 2. Card Combat

### Turn Structure

```
PLAYER TURN:
  1. Draw hand of 5 fact-cards from draw pile
  2. Player has 3 Action Points (AP) this turn
  3. For each card the player wants to play:
     a. TAP card → card rises 80px, shows info overlay (mechanic name, effect, "Tap or Swipe Up ↑")
        Non-selected cards dim. Cards with insufficient AP are greyed out.
        Player can deselect by tapping backdrop or another card.
     b. TAP selected card again OR SWIPE UP (>60px threshold) → card LOCKED IN.
        Question panel appears ABOVE card hand. Selected card drops back into hand.
        Timer starts. NO BACKING OUT. Must answer or auto-fizzle when timer expires.
     c. ANSWER correctly → card effect activates. Costs 1 AP.
     d. ANSWER incorrectly → card fizzles (discarded, no effect). Still costs 1 AP.
  4. SKIP is free (costs 0 AP). Skipped cards go to discard.
  5. "End Turn" when done (or auto-ends when AP spent).
     Remaining unplayed cards discarded.

ENEMY TURN:
  6. Enemy executes telegraphed attack (intent visible before player turn)
  7. Damage applied minus player's block
  8. Block resets to 0 (unless Fortress passive active)
  9. Next turn begins
```

### The Commit-Before-Reveal Rule (CRITICAL)

Research: Roediger & Karpicke (2006) — retrieval practice = 87% retention vs 44% for restudying. Kornell et al. (2009) — even failed retrieval beats passive viewing. Richland et al. (2009) — "preview without commitment" = LESS learning than committed attempts.

**Stage 1 — In hand:** Cards fan in a natural arc (low-high-low, center card highest). Each card shows mechanic name, effect value, difficulty stars, domain tint, and an AP cost badge (blue circle, top-right). Playable cards have a green glow; insufficient-AP cards are greyed out. NO question.

**Stage 2 — Selected (tap to rise):** Card rises 80px with info overlay showing mechanic name, effect description, and "Tap or Swipe Up ↑" prompt. Non-selected cards dim. Touch drag: selected card visually follows finger upward with opacity fade. Can freely deselect by tapping backdrop. Strategic decision point.

**Stage 3 — Committed (tap again or swipe up >60px):** Selected card drops back into hand. Question panel appears ABOVE the card hand (positioned via `position: fixed; bottom: calc(45vh - 20px)` — no overlap). Dynamic timer starts (see Timer System). No cancel. Must answer or auto-fizzle.

### Action Points (Turn Economy)

**3 AP per turn. Each commit costs 1 AP. Skip is free.**

Why 3/5: STS gives 3 energy with 5 cards. Balatro gives 4 plays with 8 cards. Ratio must be <1 for meaningful choice.

AP scaling: Base 3, hard cap 4 (only via specific passives or rare events).

### Dynamic Timer System

Timers adapt to BOTH floor depth AND question length. Slow readers should feel urgency, not panic.

**Base timer by floor:**

| Floor | Base Timer |
|-------|-----------|
| 1-3 | 12s |
| 4-6 | 9s |
| 7-9 | 7s |
| 10-12 | 5s |
| 13+ | 4s |

**Question length modifier:** Add +1 second per 12 words in total text (question + all answer options) beyond 10 words. A 40-word question on Floor 1 gets 12 + 2.5 ≈ 14 seconds. A 10-word question gets the base 12. (Word bonus increased ~25% from earlier divisor of 15 to improve readability on longer questions.)

**Slow Reader mode (set during onboarding):** "Do you prefer more time to read?" YES adds a flat +3 seconds to all timers and changes the timer bar color from red to amber (less stressful visual). This is NOT Explorer mode (which removes timers entirely). Slow Reader mode preserves urgency but gives breathing room.

**Speed bonus:** Answer in first 25% of the EFFECTIVE timer (after modifiers) → +50% effect.

**Scholar Mode override:** -2s from base per tier. Tier 2 cards require free recall (no multiple choice).

### Card Anatomy

**Front (always visible):** Card name (thematic), mechanic name + effect description (e.g. "Multi-Hit: 3x3 dmg"), effect value, difficulty stars (1-3), domain color tint.

**Back (commit only):** Question text, answer options (3/4/5 by tier), timer bar, hint button.

**Quiz panel wireframe (appears above card hand when committed):**
```
┌────────────────────────┐
│  What is the hardest   │
│  mineral on Mohs scale?│
│                        │
│  ┌──────────────────┐  │
│  │    Diamond       │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │    Quartz        │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │    Topaz         │  │
│  └──────────────────┘  │
│                        │
│  ▓▓▓▓▓▓▓▓░░░░ 7s      │
│        [Hint 💎1]      │
└────────────────────────┘
```

---

## 3. Domain and Card Type: Fully Decoupled

**Domain = what you learn. Card type = what it does in combat. Independent axes.**

Binding domain to type fails because: (1) players forced into unwanted domains, (2) adding domains requires combat decisions, (3) teacher-created decks can't work, (4) mapping is arbitrary.

### Card Type Assignment Per Run

Game builds 120-fact pool → assigns each fact a type from balanced distribution:

| Card Type | Pool % | Role |
|-----------|--------|------|
| Attack | ~30% | Primary damage |
| Shield | ~25% | Block damage |
| Heal | ~15% | Restore HP |
| Buff | ~10% | Enhance next card |
| Debuff | ~8% | Weaken enemy |
| Utility | ~7% | Draw, scout, manipulate |
| Regen | ~3% | Heal over time |
| Wild | ~2% | Copy/adapt |

### Domain Role

Domains provide: content organization, visual identity (color tint), Knowledge Library categorization, run pool selection. Domains do NOT determine card type, mechanic, or power.

---

## 4. Card Mechanics Pool (35 Mechanics)

Each TYPE has 4-6 mechanics. Per run, each fact gets a random mechanic from its assigned type's pool. Same fact, different mechanic each run. Prevents "France = my Multi-Hit card" memorization.

### Attack Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Strike | Flat damage | 8 |
| Multi-Hit | Damage X times (scales with buffs per hit) | 3 x 3 |
| Heavy Strike | High damage, costs 2 AP | 14 |
| Piercing | Damage, ignores enemy block | 6 |
| Reckless | High damage + self-damage | 12 dmg, 3 self |
| Execute | Damage + bonus if enemy <30% HP | 6 (+8 below 30%) |

### Shield Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Block | Flat block | 6 |
| Thorns | Block + reflect damage | 4 block + 2 reflect |
| Fortify | Block that persists into next turn | 4 persistent |
| Parry | Block + draw bonus if enemy attacks | 3 block + draw |
| Brace | Block equal to enemy's telegraphed attack | Varies |

### Heal Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Restore | Flat heal | 5 |
| Cleanse | Heal + remove 1 debuff | 3 + cleanse |
| Overheal | Heal, excess → temporary block | 4 (overflow) |
| Lifetap | Heal % of damage dealt this turn | 30% turn dmg |

### Buff Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Empower | Next card effect +X% | +30% |
| Double Strike | Next attack hits twice at 60% each | 2x 60% |
| Quicken | +1 AP this turn only | +1 AP |
| Focus | Next card minimum 1.3x difficulty multiplier | Override |

### Debuff Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Weaken | Enemy -25% damage for 2 turns | -25% / 2t |
| Expose | Enemy takes +20% damage for 2 turns | +20% / 2t |
| Slow | Enemy skips next buff/shield action | 1 skip |
| Hex | Poison: 3 dmg/turn for 3 turns | 9 total |

### Utility Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Scout | Draw +1 next turn | +1 draw |
| Foresight | See enemy's next 2 intents | 2-turn vision |
| Recycle | Return 1 card from discard to draw pile top | 1 reclaim |
| Transmute | Transform 1 random hand card to different type | 1 transform |

### Regen Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Sustained | X HP/turn for Y turns | 3/turn x 3 |
| Emergency | Large heal, only below 50% HP | 10 conditional |
| Immunity | Prevent next status damage instance | 1 shield |

### Wild Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Mirror | Copy previous card's effect | Copy |
| Adapt | Choose attack/shield/heal at reduced value | 5/4/4 |
| Overclock | Double effect, draw 4 next turn instead of 5 | 2x, -1 draw |

### Mechanic Assignment Rules

- Assigned randomly per run during pool building
- Heavy Strike (2 AP) limited to max 3 per pool
- Quicken (+1 AP) limited to max 2 per pool
- No duplicate mechanics in the same drawn hand (reroll on draw)

### Modifier Stacking Order

Base value x Tier multiplier (1.0/1.3/1.6) x Difficulty multiplier (0.8-1.6) x Combo multiplier (1.0-2.0) x Speed bonus (1.0/1.5) = Final effect (round down).

### Question Format Rotation

The same fact presents differently each appearance:

```
Fact: "Gold has atomic number 79"

Appearance 1: "The atomic number of gold is ___?" [79 / 47 / 26]
Appearance 2: "Which element has atomic number 79?" [Gold / Silver / Iron]
Appearance 3: "Au (gold) is in which row of the periodic table?" [6 / 4 / 5]
Appearance 4: "True or false: Gold's atomic number is 79" [True / False]
```

Each fact needs 2-4 question variants. System tracks `lastVariantIndex` per fact and never repeats the same format consecutively.

---

## 5. Card Tiers and Mastery Difficulty Escalation

Facts get HARDER as they approach mastery. Bjork's desirable difficulties: harder retrieval = better long-term memory.

| Tier | Name | FSRS Trigger | Question Format | Power | Visual |
|------|------|-------------|----------------|-------|--------|
| 1 | Learning | Stability <5d | 3-option MCQ, generous timer | 1.0x | Standard frame |
| 2a | Recall | Stability 5-15d, 3+ correct | 4-option MCQ OR reverse format | 1.3x | Silver tint |
| 2b | Deep Recall | Stability 15-30d, 5+ correct | 5-option close distractors OR fill-blank | 1.6x | Silver + glow |
| 3 | Mastered | Pass Mastery Trial | Not asked — passive relic | Permanent | Gold frame, relic tray |

### Mastery Trial

Fact at Tier 2b + stability >30d + 7 consecutive correct → qualifies.

- Golden card in hand
- 4-second timer (regardless of floor, no slow reader bonus)
- 5 options with very close distractors
- Hardest variant available
- Correct → Tier 3, passive relic, celebration
- Incorrect → stays Tier 2b, FSRS stability decreases, must requalify

### Pool Exhaustion Prevention

1. **FSRS decay:** Retrievability <0.7 → fact re-enters active pool as Tier 2a, relic goes dormant
2. **Domain exhaustion prompt:** <10 unmastered facts → prompt to add new domain
3. **Content expansion:** 522 launch → 20K+ growth. ~10 months to master all launch content
4. **Mastery Challenge events:** Rare Mystery room. Mastered fact, 3s timer, 5 distractors. Fail → Tier 2b, relic dormant
5. **Minimum active pool:** <15 active facts → Tier 2b facts re-enter as active cards

---

## 6. Passive Relics (Tier 3)

Relic type depends on card type at graduation. Specific passive randomly selected from pool. These create build-around strategies.

### Offensive Passives (Attack graduation)

| Passive | Effect |
|---------|--------|
| First Blood | First attack each encounter +50% damage |
| Chain Lightning | Multi-hit attacks get +1 extra hit |
| Glass Cannon | All attacks +25% damage, take +10% more damage |
| Bloodlust | Killing an enemy heals 5 HP |
| Sharpened Edge | All Strike mechanics +3 base damage |

### Defensive Passives (Shield graduation)

| Passive | Effect |
|---------|--------|
| Iron Skin | Start each encounter with 4 block |
| Retaliation | Blocking an attack deals 2 damage back |
| Fortress | Block carries between turns (no reset) |
| Last Stand | Below 20% HP, all block doubled |
| Aegis | Parry always triggers draw bonus regardless of enemy action |

### Sustain Passives (Heal/Regen graduation)

| Passive | Effect |
|---------|--------|
| Second Wind | Once/encounter: survive killing blow at 1 HP |
| Natural Recovery | Heal 2 HP at encounter start |
| Overgrowth | Overhealing converts to temporary block |
| Vitality | Max HP permanently +5 |

### Tactical Passives (Buff/Debuff/Utility/Wild graduation)

| Passive | Effect |
|---------|--------|
| Combo Master | Combo starts at 1.15x instead of 1.0x |
| Quick Draw | Draw 6 cards instead of 5 |
| Momentum | Perfect turn (3/3 correct) → +1 AP next turn |
| Scholar's Focus | Speed bonus threshold 30% instead of 25% |
| Echo Chamber | Echo cards deal full power (not reduced) |
| Scavenger | +1 currency per encounter per skipped card |
| Foresight Mastery | Always see 2 turns of enemy intent |
| Adaptation | After fizzle, next card +40% |
| Synergy | 3 different types in 1 turn → +3 dmg, +3 block, +3 heal |

### Relic Rules

- Max 12 active relics per run
- Excess: 12 most recently mastered (swap at Sanctum, P2)
- Dormancy: FSRS retrievability <0.7 OR failed Mastery Challenge → grayed out, suspended

---

## 7. Run Structure

### Dungeon Layout

| Depth | Floors | Encounters/Floor | Boss | Retreat |
|-------|--------|-----------------|------|---------|
| Shallow | 1-3 | 3 + 1 event | Floor 3: "The Excavator" | Keep 100% or delve |
| Deep | 4-6 | 3 + 1-2 events | Floor 6: "Magma Wyrm" | Die = keep 80% |
| Abyss | 7-9 | 3 + 2 events | Floor 9: "The Archivist" | Die = keep 65% |
| Endless | 10+ | Scaling | Mini-boss every 3 | Die = keep 50% |

### Retreat-or-Delve Psychology

Kahneman & Tversky's prospect theory: loss aversion at ~2x. At 20% risk (Segment 2), most players push. At 50% risk (Endless), only confident players continue. Escalating risk matches escalating reward. Never exceed 50% loss — total wipeout causes quit behavior on mobile.

### Room Selection

After each encounter, choose from 3 doors:

| Icon | Room | Description |
|------|------|-------------|
| Sword | Combat | Standard encounter, card reward |
| ? | Mystery | Random event (good, bad, or choice) |
| Heart | Rest | Heal 30% HP OR upgrade one card (+25%) |
| Chest | Treasure | Free card/relic, no combat |
| Bag | Shop | Buy/remove cards with currency |

**Reveal rules:**
- Combat rooms ALWAYS show the enemy type (risk assessment)
- Mystery rooms ALWAYS hidden (that's the fun)
- Rest, Treasure, Shop always clearly labeled
- Each floor guarantees at least 1 combat option (prevents heal-stacking to avoid all facts)

### Encounter Termination

1. Enemy HP ≤ 0 → Victory + rewards
2. Player HP ≤ 0 → Defeat, run ends with retreat penalties
3. Turn 15+ → Enemy +3 dmg/turn (soft enrage)

---

## 8. Enemy Design

### Common

| Enemy | HP | Damage | Behavior |
|-------|-----|--------|----------|
| Cave Bat | 22 | 6 (main), 9 (heavy) | Every turn. Teaches speed. |
| Crystal Golem | 45 | 9 every 2 turns, 13 (heavy) | Blocks on off-turns. Sustained damage. |
| Toxic Spore | 18 | 5 + poison | Low HP, DOT. Teaches healing. |
| Shadow Mimic | 28 | 7, copies last card | Punishes repetition. |

### Elites

| Enemy | HP | Special |
|-------|-----|---------|
| Ore Wyrm | 58 | Phase 2 doubles attack |
| Tome Guardian | 50 | Immune to 1 random card TYPE |

### Bosses

| Boss | Floor | HP | Pattern |
|------|-------|-----|---------|
| The Excavator | 3 | 72 | 12 damage, escalating |
| Magma Wyrm | 6 | 100 | 8, +2/turn escalating |
| The Archivist | 9 | 90 | 7 + shuffles hand |

Floor scaling: HP and damage +15% per depth segment. Player: 80 HP start, 100 max, 0 block (resets each turn).

---

## 9. Knowledge Combo

| Consecutive Correct | Multiplier | Visual |
|--------------------|------------|--------|
| 1st | 1.0x | Normal |
| 2nd | 1.15x | Slight glow |
| 3rd | 1.3x | Particle ring |
| 4th | 1.5x | Screen edge pulse |
| 5th | 2.0x | Full celebration burst |

Resets on wrong answer. Persists across turns within encounter. With 3 AP, perfect turn = 3/3. Five consecutive across 2 turns = 2.0x.

Strategic depth: play easy facts first to build combo (metacognitive awareness of own knowledge confidence), or hard facts first for base power. This mechanic literally cannot exist outside an educational card game.

---

## 10. Difficulty System

### Three Layers

| Layer | Scales | Source |
|-------|--------|--------|
| Fact Difficulty | Question hardness (1-3 stars) | FSRS difficulty |
| Question Format | MCQ options, reverse, fill-blank | FSRS stability (tier) |
| Floor Progression | Timer, enemy stats | Dungeon depth |

### Player Modes

| Mode | Timer | Wrong Penalty | Enemy Dmg | Rewards |
|------|-------|--------------|-----------|---------|
| Explorer | None | 50% effect | -30% | 70% |
| Standard | Dynamic (floor + question length) | Fizzle (costs 1 AP) | Normal | 100% |
| Scholar | -2s per tier, Tier 2 = free recall | Fizzle + 3 self-dmg | +20% | 150% |

### Slow Reader Option

Set during onboarding: "Do you prefer more time to read?" Adds flat +3 seconds to all timers. Timer bar color changes from red to amber (less stressful). Preserves urgency without panic. NOT Explorer mode (which removes timers entirely). Can be changed in settings anytime.

### Difficulty-Proportional Power

| FSRS Difficulty | Label | Multiplier |
|----------------|-------|------------|
| 1-3 | Easy | 0.8x |
| 4-5 | Medium | 1.0x |
| 6-7 | Hard | 1.3x |
| 8-10 | Very Hard | 1.6x |

---

## 11. Echo Mechanic

When a fact is answered wrong during a run, 70% chance it reappears later as an "Echo" card.

**Visual:** Translucent/ghostly appearance. Shimmers slightly. Clearly distinct from normal cards.

**Behavior:** Reduced power (0.7x multiplier). Same question, same fact. Second chance while it's still fresh.

**On correct answer:** Echo solidifies into brief golden flash, then disappears. Removes the Echo AND strengthens the original fact's FSRS score (double benefit).

**On wrong again:** Echo discarded normally. FSRS records second miss.

**Design effect:** Poor performance = more Echoes diluting your hand with weaker cards. Natural difficulty from struggling. But each redeemed Echo is a learning win.

Research: Karpicke & Roediger (2008) — immediate re-testing after failure is one of the most effective spaced repetition micro-patterns.

---

## 12. Exploitation Prevention

| Method | How |
|--------|-----|
| Commit-before-reveal | Question hidden until irrevocable commit |
| Action Points | 3 AP forces card selection |
| Fizzle costs AP | Wrong answers waste actions |
| Large pools | 80-120 facts/run, see ~50-60 |
| No-repeat-until-cycled | STS draw pile model |
| Question format rotation | 2-4 variants per fact, never same format consecutively |
| Format escalation | Higher tiers = harder formats (more options, reverse, fill-blank) |
| Mastery Trial | Tier 3 requires 4s timer + 5 close distractors |
| Per-run mechanic randomization | Same fact, different combat behavior each run |
| FSRS decay | Mastered facts return if not maintained |
| Echo mechanic | Wrong facts reappear as ghost cards |

---

## 13. Meta-Progression

| System | Description |
|--------|-------------|
| Knowledge Library | All facts cataloged by domain + mastery; lore entries expand on mastery |
| Passive Relics | Tier 3 = permanent run buffs (Section 6) |
| Card Cosmetics | Milestone rewards; monetizable |
| Domain Unlocking | Master 25 facts → new domain |
| Streaks | Daily completion; 7d→card frame, 30d→rare relic, 100d→exclusive cosmetic, 365d→legendary. 1 freeze/week. |
| Lore Discovery | At 10/25/50/100 mastered facts: narrative connecting learned facts (see Section 13a) |
| Bounty Quests | 1-2 bonus objectives per run (see Section 13b) |

No overworld, no farming/crafting, no study mode, no prestige, no stamina.

### 13a. Lore Discovery System

Mastery milestones (10th, 25th, 50th, 100th mastered fact) unlock a Lore Fragment — a short, fascinating narrative connecting multiple facts the player has learned.

**Example:** After mastering 10 Chemistry facts: "The Alchemist's Dream — For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce."

**Why this works:** Elaborative encoding (Pressley et al., 1987) — connecting isolated facts into narrative improves long-term retention by 40-60%.

**Presentation:** Full-screen, pixel art illustration, atmospheric sound, "Share" button. These are the TikTok moments — shareable, collectible, motivating.

### 13b. Bounty Quest Examples

1-2 randomly selected per run, visible at start:

- "Arcane Surge: Answer 5 Science facts correctly" → +1 card reward at next shop
- "Flawless Descent: Complete 3 encounters without wrong answers" → Rare relic
- "Deep Delve: Reach Floor 6" → 50% extra currency
- "Speed Caster: Answer 10 facts in under 3 seconds each" → Card upgrade token
- "Scholar's Path: Play cards from 4 different domains in one run" → Domain preview unlock
- "Perfect Form: Perfect turn (3/3 correct) at least once" → Cosmetic card frame

---

## 14. Onboarding (First 60 Seconds)

Research: Mobile users decide to keep an app within 7-30 seconds. Duolingo delays signup until AFTER the first lesson. Vampire Survivors has players killing enemies in 3 seconds.

```
0-3s:   Dungeon entrance. "ENTER THE DEPTHS" button.
3-5s:   Brief: "Do you prefer more time to read?" [Yes / No] (Slow Reader toggle)
5-10s:  First encounter. Hand of 5. Tooltip: "Tap a card to examine it"
10-14s: Card rises with info overlay. Tooltip: "Tap again or swipe up to cast"
14-20s: Question panel appears above hand. Correct → juice stack. Wrong → gentle fizzle.
20-35s: Remaining AP. End Turn tooltip.
35-60s: Second encounter. Minimal tooltips.
~2-3m:  Run ends. "Create account to save progress?" (skippable).
Run 2:  Domain selection unlocks.
```

First encounter: 2 AP. Full 3 AP from encounter 3.

### Calibration Deep Scan — Design Status: NEEDS RESEARCH

The original spec proposes a standalone 20-question placement test after Run 1. The core problem it solves is real, but the solution may not be the right one. This section documents the problem space, existing systems that already partially address it, candidate approaches, and open research questions.

#### The Problem: Bored Expert / Cold Start

A player who already knows 80% of general-knowledge facts will spend their first 2-3 runs answering trivially easy Tier 1 questions. Every card is weak (Tier 1 = lowest power), combat feels like busywork, and the player may churn before the system catches up. This is the classic spaced-repetition cold-start problem — the scheduler has no prior data and must assume everything is new.

The inverse problem also matters: a player who knows very little gets overwhelmed by too many wrong answers early, feels dumb, and churns. The Canary system (§21) handles this side via invisible difficulty reduction, but the cold-start calibration question applies to both directions.

#### Existing Systems That Already Calibrate

Two systems already adjust to player knowledge during gameplay:

1. **FSRS (§26)** — Tracks per-fact difficulty, stability, and retrievability. A fact answered correctly gets higher stability → longer interval → faster tier promotion. After ~2-3 correct answers, a well-known fact reaches Tier 2a (stability ≥5d + 3 consecutive correct). This means FSRS self-calibrates within 2-3 encounters per fact — but only for facts the player has actually seen.

2. **Canary System (§21)** — Adjusts game difficulty (not educational rigor) based on per-floor performance. 3+ wrong/floor → easier facts, -15% enemy damage. 5+ correct streak → harder facts, elite variants. This smooths the gameplay experience but doesn't accelerate tier promotion for known facts.

**Gap:** Neither system proactively tests unseen facts. A player may know 80% of a domain's facts, but until each fact appears in a run, FSRS can't know that. With 723 facts and ~80-120 seen per run, full calibration takes 6-9 runs. The question is whether this matters enough to justify a separate calibration flow.

#### Candidate Approaches

**Option A: Standalone Deep Scan (original spec)**
After Run 1, offer an optional 20-question rapid-fire test (no card frames, no timer, no combat). Correct → fact placed at Tier 2a (stability=5, consecutiveCorrect=3). Wrong → stays Tier 1, no penalty.

- *Pro:* Directly solves cold-start for tested facts. Fast (20 questions ≈ 2 minutes). Familiar pattern from language apps (Duolingo placement test).
- *Con:* Immersion break — feels like a school exam, not a game. Domain selection doesn't unlock until Run 2, so what domain do you test? High skip rate likely (optional tests get ~20-30% engagement in mobile). Only calibrates 20 of potentially hundreds of facts. Engineering cost for a one-time-use screen.

**Option B: Gameplay-Inferred Calibration (accelerated FSRS)**
No separate test. Instead, boost FSRS gains during early runs (runs 1-3) so the system calibrates faster from normal play.

Possible mechanics:
- Correct + fast response (under 50% of allotted time) → count as 2 consecutive correct instead of 1 (doubled stability gain)
- 80%+ run accuracy → all correctly-answered facts get a flat stability bonus (+2 days)
- First-time correct on a new fact → start stability at 2d instead of default 1d
- Could be domain-specific: when a player first picks a new domain, the first run in that domain uses accelerated gains

- *Pro:* Zero immersion break — the dungeon IS the placement test. No skip problem (it's invisible). Works for every domain, not just the first. No extra UI to build.
- *Con:* Still takes 2-3 runs to fully calibrate (just faster, not instant). Doesn't help with facts the player hasn't seen yet. May need tuning to avoid over-promoting facts that were lucky guesses.

**Option C: In-Run Domain Probe**
When a player selects a new domain for the first time, the first encounter of that run is a "calibration encounter" — slightly different from normal combat. Present 5-8 rapid questions from the domain (no card effects, no AP cost, just answer). Results seed FSRS state for those facts. Then normal combat begins.

- *Pro:* Domain-aware (tests the domain the player just chose). Stays in the game world (it's an encounter, not a menu). Shorter than 20 questions. Only triggers once per domain.
- *Con:* Still somewhat test-like. Delays getting to real combat. Needs clear narrative framing ("The dungeon tests your knowledge before you enter...").

**Option D: Cut Entirely**
Trust FSRS + Canary to handle calibration organically. Accept that the first 2-3 runs per domain are a warm-up period. Many successful roguelites have early runs that feel easier — this could be a feature, not a bug ("the shallow floors are easy, the depths are where it gets real").

- *Pro:* Zero engineering cost. No design risk. Simplest solution.
- *Con:* Bored experts may churn in runs 1-3 before the system catches up. No mitigation for cold-start.

#### Open Research Questions

1. **How fast does FSRS actually calibrate?** Model the math: if a player sees 80 unique facts in Run 1 and gets 70 correct, how many are at Tier 2a by Run 2? By Run 3? Is the gap between "no calibration" and "perfect calibration" actually noticeable in terms of card power and combat feel?

2. **What do Duolingo/Anki/Memrise do?** Duolingo's placement test is mandatory and well-studied. Anki has no placement — users import decks at their level. Memrise lets users mark known words. What's the engagement data on optional vs mandatory placement? What's the churn difference for users who skip vs complete?

3. **Does card power matter enough early?** Tier 1 cards are weaker, but early enemies are also weak (Canary ensures this). If the power curve is balanced so that Tier 1 cards vs Floor 1-3 enemies feels fine, the cold-start problem may be a non-issue from a gameplay perspective — it only matters educationally (seeing easy questions is boring). But is "boring" the same as "churn-inducing" when the combat itself is engaging?

4. **Domain-specific calibration timing** — Since domain selection unlocks at Run 2, any calibration for a specific domain can't happen until then. Should calibration be per-domain (triggered on first selection) rather than a one-time global event? This changes the UX significantly.

5. **Could the run pool builder handle this?** Instead of a separate calibration step, could RunPoolBuilder intelligently front-load "probe facts" (diverse difficulty within a domain) in early runs, then use the results to seed FSRS for similar facts the player hasn't seen? E.g., if a player aces 5 geography-capital questions, infer they likely know other geography-capital facts and boost those too.

#### Decision Needed

Research the questions above, then pick one of Options A-D (or a hybrid). The implementation is blocked on this decision. Key criteria: player retention impact (does cold-start actually cause churn?), engineering cost vs value, and alignment with the "learning IS gameplay" philosophy (a separate test contradicts this).

---

## 15. Wrong Answer Design

**Anti-shame:** Shame is the enemy of learning, especially with younger players.

- Soft gray-out dissolve (no red X, no "WRONG!")
- Correct answer in blue highlight for 2 seconds
- FSRS records miss
- AP gem dims with crack animation
- Adventurer's Journal: "You'll recall next time: [answer]"
- What NEVER happens: screen shake, red flash, "WRONG!" text, extra damage, reward loss

**Hint (1 Scholar's Insight/use, earn 1/encounter):** Remove 1 wrong option, +5s timer, or reveal first letter.

---

## 16. Portrait UX (Split-Stage Layout)

Research: 94% of smartphone users hold vertically. 49% one-hand, 75% thumb-driven. Clash Royale portrait cited as more playable than Clash of Clans landscape. STS mobile #1 complaint = small text and janky card selection from landscape squeeze. Casino designers call this the "Split-Stage" pattern.

**Top 55% (Display):** Enemy, HP bars, intent, floor counter, relics, AP. No interactives. Top-third tap accuracy: 61%.

**Bottom 45% (Interaction):** Card hand, answer buttons, hint, End Turn. Bottom-third accuracy: 96%.

### Touch Targets

| Element | Size |
|---------|------|
| General | 48x48dp min |
| Cards in hand | `min(18vw, 85px)` width, 1.5:1 aspect ratio |
| Answer buttons | Full width, 56dp height, 8dp spacing |
| End Turn | Full width, 48dp |
| Bottom safe area | 16dp for gesture nav |

### Card States

| State | Size | Shows |
|-------|------|-------|
| In hand | `min(18vw, 85px)` width, 1.5:1 aspect ratio | Mechanic, value, stars, domain tint, AP cost badge (blue circle top-right). Green glow if playable. 30° total fan spread, 20px max arc offset. |
| Selected | Same card, rises 80px | Info overlay: mechanic name, effect, "Tap or Swipe Up ↑". Non-selected cards dim. Touch drag follows finger upward with opacity fade. |
| Committed | Question panel above hand | `position: fixed; bottom: calc(45vh - 20px)`. Selected card drops back into hand. Question, answers, timer, hint. No overlap with card hand. |

### AP Display

3 gem icons below hand. Lit = available, dim = spent.

### Enemy Intent Display

STS-style intent badge shown in combat overlay (center, between AP and bounty strips). Shows icon + value:
- ⚔️ Attack, ⚔️× Multi-attack, 🛡️ Defend, 💪 Buff, ☠️ Debuff, 💚 Heal
- Attack intents have red border highlight
- Hidden during quiz (committed stage) to reduce visual noise
- Data sourced from `turnState.enemy.nextIntent` (pre-rolled by enemyManager)

### End Turn Button

Simplified display: shows "END TURN" only (no AP count). Turns gold with pulsing glow when no actions remain (0 AP or no playable cards). Confirmation popup when tapping End Turn with AP remaining and playable cards available.

---

## 17. Game Juice

### Why Juice Matters

Research on operant conditioning: intensity of positive reinforcement directly correlates with behavior repetition rate. Correct answers create a dopamine loop tied to fact recall. Vampire Survivors creator explicitly referenced gambling psychology. Players WITH sound retain at 1.5-2x rate (mobile game postmortem data).

### Correct Answer (all within 200ms)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Sharp pulse: `Haptics.impact({ style: ImpactStyle.Heavy })` |
| 2 | Flash | White 30%, 150ms fade |
| 3 | Numbers | Arc to enemy, bounce; gold=normal, red=crit (speed bonus) |
| 4 | Card | Launch + streak trail + particle dissolve toward enemy |
| 5 | Enemy | 5px knockback, red flash, smooth HP drain |
| 6 | Sound | Crisp impact (Wordle ding x fighting game punch) |
| 7 | Combo | Escalating text + particles at 3+, burst at 5 |

### Wrong Answer (muted)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Gentle double-tap: `Haptics.notification({ type: NotificationType.Warning })` |
| 2 | Card | Dim, crack, sand-dissolve downward |
| 3 | Reveal | Blue highlight, 2s |
| 4 | Sound | Soft low tone (not a buzzer) |
| 5 | AP gem | Dim + crack |
| 6 | Absence | No shake, no red flash, no damage numbers |

### Other Haptics

- Card tap/select: `Haptics.impact({ style: ImpactStyle.Light })`
- Combo milestone: `Haptics.impact({ style: ImpactStyle.Heavy })` x2 with 100ms delay

---

## 18. Sound Design

| P | Sounds |
|---|--------|
| P1 | Correct impact, wrong tone, draw swoosh, enemy hit/death, turn chime |
| P2 | Dungeon ambient, boss music, combo sounds, UI taps, retreat tension |
| P3 | Per-mechanic sounds, floor themes, tier-up, lore discovery |

Master volume + category toggles. Haptics independent of sound mute.

---

## 19. Accessibility (In Prototype)

Apple and Google factor accessibility into editorial featuring. "Apps We Love" disproportionately highlights accessible apps. Building in from day one is both ethical and strategic.

| Category | Detail |
|----------|--------|
| Visual | Colorblind (shape/icon not just color), 3 text sizes, high contrast, reduce motion (disables shake/particles, keeps haptics) |
| Motor | Tap only, 48dp+ targets, no timer in Explorer, Slow Reader option |
| Cognitive | Explorer soft fail, hints, numeric+icon indicators, 6th-grade reading level |

---

## 20. Daily Expedition

Same seed all players. Score = accuracy x speed x depth x combo. One attempt/day. Leaderboard (read-only). Rewards: participation badge, bonus for top 10%/25%/50%.

Why critical: Wordle's entire viral success = one-a-day appointment. STS daily climb = most-played mode. "Did you beat today's Expedition?" = organic marketing.

---

## 21. Canary System (Invisible Adaptive Difficulty)

3+ wrong/floor: -2s timer, easier facts, -15% enemy dmg, hint more prominent. 5+ correct streak: tighter speed bonus, harder facts, elite variants.

Invisible. Never announced. Never reduces educational rigor (answer count, format unchanged). Only game difficulty flexes. Research: Hunicke (2005) — invisible DDA preserves flow state.

---

## 22. Language Learning Integration

Vocabulary cards require different UI and interaction patterns.

### How Vocabulary Cards Differ

```
TRIVIA CARD:
  Front: "Arcane Barrage — Multi-Hit 3x3"
  Question: "What causes earthquakes?"
  Answers: [Tectonic plates / Solar flares / Ocean currents]

VOCABULARY CARD (Japanese N5):
  Front: "食べる Strike — 8 damage"
  Question: Shows "食べる" with 🔊 audio button
  Answers: [to eat / to drink / to see]

  Tier 2 reverse:
  Question: "How do you say 'to eat' in Japanese?"
  Answers: [食べる / 飲む / 見る]
```

### Language-Specific UI Requirements

- **Audio playback button** on all vocabulary cards (TTS or recorded)
- **Script display** for non-Latin languages (kanji with furigana toggle for Japanese)
- **Sentence context** shown briefly after answering (example sentence using the word)
- **Production cards at Tier 2+:** Type/draw the target word instead of selecting from options

### Language Pack Schema

```typescript
interface VocabularyFact extends Fact {
  targetLanguage: string;       // 'ja', 'es', 'fr'
  nativeWord: string;
  targetWord: string;
  reading?: string;             // Furigana, pinyin, etc.
  audioUrl?: string;
  exampleSentence?: string;
  partOfSpeech?: string;
  jlptLevel?: string;           // N5-N1
  cefrLevel?: string;           // A1-C2
}

interface LanguagePack {
  language: string;
  levels: LanguageLevel[];
  totalVocabulary: number;
}

interface LanguageLevel {
  name: string;                 // "JLPT N5", "CEFR A1"
  description: string;
  vocabularyCount: number;
  facts: VocabularyFact[];
  unlockCriteria: { previousLevelMastery: number; };  // e.g. 80%
}
```

---

## 23. Monetization

Research: Vampire Survivors $57M+ on $5 premium. Duolingo $1B+ freemium subscription. Rewarded ads 76% player preference. Clash Royale 10x revenue from removing time gates.

| Offering | Price |
|----------|-------|
| Free | Full game, unlimited runs, 522 facts, 3-4 domains |
| Ad removal | $4.99 |
| Domain packs | $2.99 each |
| Language packs | $4.99 each |
| Arcane Pass | $4.99/mo (all packs, cosmetics, analytics, family 5x) |
| Cosmetics | Varies (frames, animations, dungeon skins, avatars) |

No pay-to-win. No premium currency. No gacha. Education (primary) + Games (secondary).

---

## 24. Anti-Features

No chat/social. No AI-generated facts without human review. No PvP. No deck editing outside runs. No premium currency. No gacha. No overworld. No farming/crafting. No study mode. No prestige. No stamina. No cancel after commit. No domain-locked types.

---

## 25. Post-Run Summary (Adventurer's Journal)

```
┌──────────────────────────┐
│   EXPEDITION COMPLETE    │
│                          │
│  Depth Reached: 6/9      │
│  Facts Answered: 42      │
│  Accuracy: 81%           │
│  Best Combo: 4x          │
│  New Facts Learned: 7    │
│  Facts Mastered: 2 ↑     │
│                          │
│  ★ Bounty: Arcane Surge ✓│
│                          │
│  [Cards Earned] [Share]  │
│  [Play Again]  [Home]    │
└──────────────────────────┘
```

**Share button** generates a Wordle-style card image: "I explored Depth 6 of Arcane Recall, answered 42 facts with 81% accuracy, and mastered 2 new concepts. How deep can you go?" Communicates achievement without spoiling content. Organic viral loop.

---

## 26. FSRS Integration (replaces SM-2)

FSRS replaced SM-2 as Anki default 2023. Tracks Difficulty (1-10), Stability (days), Retrievability (0-1). Outperforms SM-2 on 350M+ review benchmark. `ts-fsrs` npm package.

### Run Pool

| Source | % |
|--------|---|
| Primary domain | 40% (~48 facts) |
| Secondary domain | 30% (~36 facts) |
| FSRS review queue | 30% (~36 facts, only from previously engaged domains) |

Players never see facts from domains they haven't opted into.

### Domain Partitioning for Performance

At 20,000+ facts, a single FSRS queue is a mobile performance concern. Each domain maintains its own scheduler:

```typescript
interface DomainScheduler {
  domain: FactDomain;
  facts: PlayerFactState[];
  getDueForReview(limit: number): PlayerFactState[];
  getNewFacts(limit: number): Fact[];
}
```

### Player Fact State

```typescript
interface PlayerFactState {
  factId: string;

  // FSRS fields
  difficulty: number;           // 1-10
  stability: number;            // Days of memory stability
  retrievability: number;       // 0-1, current recall probability
  consecutiveCorrect: number;
  nextReviewDate: Date;
  lastReviewDate: Date;
  passedMasteryTrial: boolean;

  // Variant tracking
  lastVariantIndex: number;

  // Stats (for analytics, Canary system, content balancing)
  totalAttempts: number;
  totalCorrect: number;
  averageResponseTimeMs: number;
}
```

### Tier Derivation

```typescript
function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  if (state.stability >= 30 && state.consecutiveCorrect >= 7 && state.passedMasteryTrial) return '3';
  if (state.stability >= 15 && state.consecutiveCorrect >= 5) return '2b';
  if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2a';
  return '1';
}
```

---

## 27. Fact Database

```typescript
interface Fact {
  id: string;
  domain: FactDomain;
  subdomain?: string;
  ageRating: 'all' | '10+' | '13+' | '16+' | '18+';
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
  variants: QuestionVariant[];    // min 2, target 4
  // cardType and mechanic NOT on Fact — assigned per-run
  source?: string;
  tags: string[];
  verifiedAt?: Date;
}

interface RunCard {
  fact: Fact;
  cardType: CardType;
  mechanic: CardMechanic;
  tier: '1' | '2a' | '2b' | '3';
  baseEffectValue: number;
}
```

### Age Gating

| Bracket | Ratings | Examples |
|---------|---------|---------|
| child (<13) | all | "What planet is closest to the sun?" |
| teen (13-17) | all, 10+, 13+ | "What is the pH of stomach acid?" |
| adult (18+) | all through 18+ | Medical terminology, pharmacology |

```typescript
function getEligibleFacts(profile: PlayerProfile): Fact[] {
  const allowed = {
    child: ['all'],
    teen: ['all', '10+', '13+'],
    adult: ['all', '10+', '13+', '16+', '18+']
  };
  return allFacts.filter(f => allowed[profile.ageBracket].includes(f.ageRating));
}
```

### Content Accuracy at Scale (Post-Launch)

- All facts require `verifiedAt` before live database
- Community-submitted facts enter "Provisional" state (visually marked) until verified
- "Report Error" button on every card (tap-and-hold → "This fact seems wrong")
- AI-drafted facts ALWAYS flagged for human review

### Scale

522 launch → 20K+ growth → 5K+ per language pack. All human-verified.

---

## 28. Competitive Moat

No commercial game currently combines spaced repetition with card roguelite mechanics. IEEE peer-reviewed paper: FSRS/SM-2 integration with learning games "has yet to be implemented at scale." SciTePress 2023: roguelites "well-adapted" for declarative knowledge training.

**Defensible advantages:**
1. First mover in "educational card roguelite"
2. FSRS data flywheel (performance improves scheduling AND content selection)
3. Cross-disciplinary expertise barrier (pedagogy + game design + learning science + card balance)
4. Content depth (20K+ facts + language packs)
5. Community content pipeline → network effects

**Market proof:**
- Slay the Spire: 2-person team, $200M+ revenue
- Balatro: Solo dev, 5M+ copies, $9M+ mobile
- Duolingo: 500M+ users, $1B+ revenue
- DragonBox: 93% mastery rates via intrinsic integration
- Prodigy Math: $50M+/year (but inferior integration)

---

## 29. Technical Notes

**Stack:** Svelte 5 + Phaser 3 + TypeScript + Capacitor. Portrait. Mobile-first.

**Deps:** `ts-fsrs`, `@capacitor/haptics`, `@capacitor/preferences`

**Phaser performance:** 60fps target. ~15 game objects in combat. 50 particle cap (correct answer burst = 30 particles, 300ms lifespan). Phaser tweens only (GPU-accelerated, no CSS). Sprite pool for card fan (5 pre-created, reposition don't create/destroy).

**State persistence:** Save after every encounter via `@capacitor/preferences`. 24h survival. Run state JSON <50KB. FSRS data for 500 facts ≈ 25KB.

**Kill metric:** >2x voluntary fact-review volume per minute vs raw flashcard drilling.

**Retention targets:** D1: 40-45%, D7: 18-22%, D30: 8-12%.

---

## Appendix A: Glossary for Coding Agents

| Term | Definition |
|------|-----------|
| Fact | A single piece of knowledge with question variants. Domain is permanent. Card type/mechanic assigned per-run. |
| Card (RunCard) | A playable entity: Fact + assigned type + mechanic + tier + effect value |
| Tier | Evolution stage: 1 (Learning), 2a (Recall), 2b (Deep Recall), 3 (Mastered/Passive) |
| Domain | Subject category (Science, History, etc.). Content label only. Does NOT determine card type. |
| Run | Single playthrough: enter dungeon, delve through floors, retreat or die |
| Floor | One dungeon depth containing 3 encounters + optional events |
| Segment | Group of 3 floors ending in boss + retreat checkpoint |
| Encounter | Single combat: player plays cards vs one enemy |
| Hand | 5 cards drawn from draw pile for current turn |
| AP (Action Points) | 3 per turn. Each card commit costs 1. Skip is free. |
| Draw Pile | Shuffled deck of RunCards for the current run |
| Discard Pile | Played/skipped cards. Reshuffles into draw pile when draw pile empties. |
| Fizzle | Wrong answer. No effect, card discarded, still costs 1 AP. |
| Commit (Cast) | Irrevocable action: tap selected card again or swipe up to lock in. Reveals question panel above hand, starts timer. No cancel. |
| Retreat | End run voluntarily at checkpoint. Keep 100% rewards. |
| FSRS | Free Spaced Repetition Scheduler. Replaces SM-2. Tracks difficulty, stability, retrievability. |
| Stability | FSRS: days of memory stability. Drives tier promotion. |
| Retrievability | FSRS: current recall probability (0-1). Below 0.7 = due for review / relic dormancy. |
| Mastered | Fact that passed Mastery Trial. Becomes passive relic. |
| Passive Relic | Tier 3 card: permanent buff, no hand slot, can go dormant. |
| Echo | Ghost card from wrong answer. 70% reappearance chance. Reduced power. |
| Mastery Trial | Final exam: 4s timer, 5 close distractors. Pass = Tier 3. |
| Mechanic | Specific behavior within a card type (Strike, Multi-Hit, Thorns, etc.). Assigned per-run. |
| Bounty Quest | Optional per-run bonus objective with rewards. |
| Lore Discovery | Narrative milestone at 10/25/50/100 mastered facts. |
| Canary | Invisible adaptive difficulty system. Adjusts game, never educational rigor. |
| Deep Scan | Optional calibration system after first run. Design under review — may be replaced by accelerated FSRS gains during early runs. |
