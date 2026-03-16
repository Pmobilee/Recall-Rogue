# Recall Rogue — Game Design (Single Source of Truth)

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

Recall Rogue inverts this. There is nothing to do EXCEPT engage with facts. Every card play, every deck-building choice, every reward selection involves a fact. The optimization path and the learning path are identical.

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
  6. Enemy block resets to 0 (STS-style — must re-defend each turn)
  7. Enemy executes telegraphed action (intent visible before player turn)
     - Defend intents add block to enemy (absorbs damage before HP)
  8. Player damage applied minus player's block
  9. Player block resets to 0 (unless Fortress passive active)
  10. Next turn begins
```

### Partial Fizzle Mechanic (Skill-Floor Narrowing)

**Wrong answers no longer result in zero effect.** Instead, fizzled cards apply 20% of their base effect value. This includes:
- Attack: 20% of damage (including lifetap healing)
- Shield: 20% of block
- Buff/Debuff/Utility: 20% of effect (scaled down)

**No modifiers apply to fizzle damage:** Speed bonuses, combo multipliers, and relic bonuses do not affect fizzled effects — only the raw 20% base value applies. This narrows the skill gap between beginners (who fizzle more often) and experts (who don't), ensuring early-game mistakes aren't as punishing while preserving incentive for correct answers.

### Fact-Card Shuffling (Per-Draw Randomization)

Card slots (type + mechanic + base effect) and facts (the questions to answer) are paired RANDOMLY each time a hand is drawn. The deck tracks card slots and facts as separate pools.

**Why:** Without shuffling, a known fact permanently bonded to a powerful mechanic (e.g., Heavy Strike 14 dmg) becomes a guaranteed nuke. Shuffling ensures every hand is unpredictable — you can't rely on always knowing the answer to your best card.

**How it works:**
1. At run start, `buildRunPool()` creates card SLOTS (type + mechanic) and a separate fact pool
2. Each `drawHand()` call draws N card slots from the draw pile
3. N facts are drawn from the fact pool (excluding cooldown facts)
4. Slots and facts are paired randomly
5. Tier multiplier (1.0x/1.3x/1.6x) is derived from the fact's FSRS mastery tier — mastered facts are more powerful regardless of which card type they land on

**First-draw funScore bias:** On the very first encounter of a run (floor 1, encounter 1), fact assignment is weighted so facts with funScore >= 7 are 2x more likely to appear in the opening hand. This creates a strong first impression with the most engaging content. Subsequent draws use uniform random assignment.

**Applies to:** All cards (knowledge AND vocabulary).

### Encounter Cooldown & Anti-Repetition (AR-53)

**All facts seen during an encounter** (not just answered ones) enter a 3–5 encounter cooldown. This prevents the same fact from appearing on consecutive encounters even if the player skipped or didn't play that card.

**Three layers of deduplication prevent repetition:**

1. **Same-hand dedup**: No two cards in the same 5-card hand can share the same underlying fact. This uses three filters:
   - Exact fact ID dedup (no `ja-grammar-n5-ga-meaning` twice)
   - Base key dedup (same language + statement + answer combination)
   - **Root ID dedup**: Strips variant suffixes (`-meaning`, `-recall`, `-fill`, `-forward`, `-reverse`, etc.) to group related facts. If `ga-meaning` is in hand, `ga-recall` and `ga-fill` are blocked too.

2. **Encounter cooldown**: ALL facts that appeared in ANY hand during an encounter enter cooldown (3–5 encounters, random per fact). Root-sibling variants are also blocked — if `ga-meaning` is in cooldown, `ga-recall` is blocked too.

3. **Cross-run dedup**: Facts from the last 2 runs are deprioritized (pushed to end of shuffle) when building the next run's pool.

**Edge case:** If cooldown would exhaust the fact pool (available facts < hand size), cooldown relaxes to 1 encounter. If still insufficient, cooldown is disabled for that draw.

### The Commit-Before-Reveal Rule (CRITICAL)

Research: Roediger & Karpicke (2006) — retrieval practice = 87% retention vs 44% for restudying. Kornell et al. (2009) — even failed retrieval beats passive viewing. Richland et al. (2009) — "preview without commitment" = LESS learning than committed attempts.

**Stage 1 — In hand:** Cards fan in a natural arc (low-high-low, center card highest). Each card shows mechanic name, effect value, difficulty stars, domain tint, and an AP cost badge (blue circle, top-right). Playable cards have a green glow; insufficient-AP cards are greyed out. NO question. **Hover pop-out (mouse only):** hovering over a card lifts it 18px and scales to 1.15x with a snappy 150ms transition, giving a satisfying browse feel. Hover is suppressed during drag or when a card is selected.

**Stage 2 — Selected (tap to rise):** Card rises 80px with info overlay showing mechanic name, effect description, and "Tap or Swipe Up" prompt. Non-selected cards dim. Can freely deselect by tapping backdrop. Strategic decision point.

**Stage 2b — Drag-to-play (mouse + touch):** Grabbing any card and dragging upward smoothly lifts and scales it (up to 1.3x). After 40px, the card info overlay appears; after 60px, a green "ready to cast" glow signals the threshold. Releasing above 60px casts the card directly (bypasses the two-step select-then-cast flow). Releasing below the threshold returns the card to hand with no action. Uses unified pointer events for both mouse and touch.

**Stage 3 — Committed (tap again, swipe up >60px, or drag-to-play):** Selected card drops back into hand. Question panel appears ABOVE the card hand (positioned via `position: fixed; bottom: calc(45vh - 20px)` — no overlap). Dynamic timer starts (see Timer System). No cancel. Must answer or auto-fizzle.

### Action Points (Turn Economy)

**3 AP per turn. Cards cost 0, 1, 2, or 3 AP. Skip is free.**

Why 3/5: STS gives 3 energy with 5 cards. Balatro gives 4 plays with 8 cards. Ratio must be <1 for meaningful choice.

AP scaling: Base 3, hard cap 4 (only via specific passives or rare events).

#### Variable AP Costs

Cards now cost 0, 1, 2, or 3 AP instead of all costing 1 AP. This creates resource allocation tension — "one big play or two small plays?" decisions.

**AP Cost Distribution (base, pre-upgrade):**
- **0 AP:** Quicken (free +1 AP), Foresight (free: reveal 2 intents + draw 1)
- **1 AP:** Strike, Block, Emergency, Scout, Recycle, Focus, Cleanse, Empower, Weaken, Expose, Mirror, Adapt, Piercing, Reckless, Execute, Parry, Brace, Hex, Transmute, Immunity, Thorns
- **2 AP:** Multi-Hit, Lifetap, Fortify, Overheal, Double Strike, Slow, Overclock
- **3 AP:** Heavy Strike (consumes entire turn for 20 damage)

**AP Cost as Upgrade Axis:**
Many 2-3 AP cards can have their AP cost reduced by 1 via upgrade, creating meaningful upgrade decisions. Example: upgrade Heavy Strike from 3→2 AP (transformative resource unlock) vs upgrade Strike for +3 damage (incremental). This makes upgrades more interesting — not just about power creep, but about opening new strategic possibilities.

**Upgraded AP distribution:**
- 0 AP base: Quicken, Recycle, Foresight (3 cards)
- 0 AP upgraded: Scout+, Cleanse+, Immunity+ (plus the 3 base 0-AP cards = 6 total at 0 AP)
- 1 AP: 16 cards (most upgrades keep 1 AP)
- 2 AP: 1 card (Heavy Strike+, reduced from 3→2)

**AP Badge Colors:**
- Green (#059669): 0 AP (free)
- Blue (#1e40af): 1 AP (standard)
- Orange (#d97706): 2 AP (heavy)
- Red (#dc2626): 3 AP (full turn)

### Complete Card Mechanics Reference (AR-55)

All 31 card mechanics available in the game, organized by type and phase.

#### Phase 1 Mechanics (Core Set)

| Mechanic | Type | AP | Effect | Notes |
|----------|------|-----|--------|-------|
| **Strike** | Attack | 1 | 8 damage | Bread and butter |
| **Multi-Hit** | Attack | 2 | 4 damage × 3 hits | One question, multi-hit. Synergizes with buffs |
| **Block** | Shield | 1 | 6 block | Standard defense |
| **Thorns** | Shield | 1 | 6 block + 3 reflect | Block + retaliate when hit (AR-55: was 2 AP) |
| **Emergency** | Shield | 1 | 4 block (8 if HP < 30%) | Desperation shield |
| **Empower** | Buff | 1 | +50% to next card | Setup for big plays (AR-55: was +30%) |
| **Quicken** | Buff | 0 | +1 AP this turn | Free action — quiz IS the cost |
| **Weaken** | Debuff | 1 | -25% enemy damage, 2 turns | Defensive debuff |
| **Expose** | Debuff | 1 | +50% damage taken, 1 turn | Offensive debuff. Combo with big attacks |
| **Scout** | Utility | 1 | Draw 2 cards | Hand cycling tool (AR-55: was draw 1) |
| **Recycle** | Utility | 1 | Draw 3 cards | Premium cycling tool |
| **Cleanse** | Utility | 1 | Remove all debuffs + draw 1 | Situational lifesaver |
| **Mirror** | Wild | 1 | Copy previous card's effect | High skill ceiling. Requires setup |
| **Adapt** | Wild | 1 | Auto-picks best needed effect | Smart auto-play. Always useful |

#### Phase 2 Mechanics (Post-Launch)

| Mechanic | Type | AP | Effect | Notes |
|----------|------|-----|--------|-------|
| **Heavy Strike** | Attack | 3 | 20 damage | All-in. Entire turn on one question |
| **Piercing** | Attack | 1 | 6 damage (ignores block) | Anti-shield |
| **Reckless** | Attack | 1 | 12 damage, 3 self-damage | High risk, high reward |
| **Execute** | Attack | 1 | 6 + 8 bonus if enemy < 30% HP | Finisher |
| **Lifetap** | Attack | 2 | 8 damage + heal 20% dealt | Sustain attack |
| **Fortify** | Shield | 2 | 7 persistent block (carries to next turn) | Proactive defense (AR-55: was 5) |
| **Parry** | Shield | 1 | 3 block + draw 1 if enemy attacks | Conditional card advantage |
| **Brace** | Shield | 1 | Block = enemy telegraph | Perfect block. Reads the enemy |
| **Overheal** | Shield | 2 | 10 block (2× if HP < 50%) | Emergency mega-shield (AR-55: was 9/1.5×) |
| **Double Strike** | Buff | 2 | Next attack hits twice at full power | Burst enabler (AR-55: was 2×60%) |
| **Slow** | Debuff | 2 | Skip enemy's next action | Expensive but powerful vs bosses |
| **Hex** | Debuff | 1 | 3 poison × 3 turns (9 total) | Damage over time |
| **Foresight** | Utility | 0 | Reveal 2 intents + draw 1 | Free scouting (AR-55: was 1 AP, no draw) |
| **Transmute** | Utility | 1 | Transform random hand card | Gamble on better options |
| **Immunity** | Utility | 1 | Absorb next hit up to 8 damage | Universal defense (AR-55: was status-only) |
| **Focus** | Buff | 1 | Next card costs 1 less AP | AP efficiency combos. Focus + Heavy Strike = 3 AP total |
| **Overclock** | Wild | 2 | 2× next card effect | Burst amplifier (AR-55: removed -1 draw penalty) |

#### Free-Play Design (AR-55)

Two 0-AP cards (Quicken, Foresight) create "bonus action" moments where answering a quiz correctly IS the cost — no AP spent. This:
- Rewards quiz knowledge with extra plays
- Creates exciting hands where you can play 4-5 cards in a turn (3 AP cards + 1-2 free cards)
- Eliminates "dead draw" frustration — even utility cards feel worth playing
- Maintains the quiz-as-cost philosophy: you still must answer correctly to get the effect

#### Key Balance Principles

1. **Every card must be worth the quiz risk.** Getting a question wrong = fizzle + wasted AP. Weak effects (old Scout draw-1, old Empower +30%) felt terrible because the fizzle downside outweighed the success upside.
2. **Power scales with mastery, not difficulty.** Tier 1 = 1.0×, Tier 2a = 1.3×, Tier 2b/3 = 1.6×. No ease-based multiplier.
3. **Challenge scales via quiz format, not card power.** Higher tiers face harder questions (more options, fill-blank, reverse), not weaker cards.
4. **No strictly dominated cards.** Every mechanic should have at least one situation where it's the best play.

### Dynamic Timer System

Timers adapt to BOTH floor depth AND question length. Slow readers should feel urgency, not panic.

**Base timer by floor:**

| Floor | Base Timer | Segment |
|-------|-----------|---------|
| 1-6 | 12s | Shallow Depths |
| 7-12 | 9s | Deep Caverns |
| 13-18 | 7s | The Abyss |
| 19-24 | 5s | The Archive |
| 25+ | 4s | Endless |

**Question length modifier:** Add +1 second per 12 words in total text (question + all answer options) beyond 10 words. A 40-word question on Floor 1 gets 12 + 2.5 ≈ 14 seconds. A 10-word question gets the base 12. (Word bonus increased ~25% from earlier divisor of 15 to improve readability on longer questions.)

**Slow Reader mode (set in Settings):** Adds a flat +3 seconds to all timers and changes the timer bar color from red to amber (less stressful visual). This is NOT Story Mode (which removes timers entirely). Slow Reader mode preserves urgency but gives breathing room.

**Speed bonus:** Answer in first 25% of the EFFECTIVE timer (after modifiers) → +50% effect.


### Card Anatomy & Frame System

Cards now use hand-crafted PNG card frames per mechanic, providing visual coherence and thematic reinforcement.

#### Card Frame Assets

**30 hand-crafted card frames (PNG → WebP pipeline)** grouped by 6 mechanic categories:

| Category | Frames | Visuals |
|----------|--------|---------|
| Attack (golden slash) | 5 | Golden energy, dynamic slash, scene of combat |
| Defence (blue shield) | 5 | Blue crystalline shield, protective aura |
| Buff (golden radiate) | 5 | Golden light, uplifting glow, expansion effect |
| Debuff (purple tendrils) | 5 | Purple decay, withering vines, dissolution |
| Utility (prismatic) | 5 | Rainbow shimmer, transformative energy |
| Wild (morphic) | 5 | Chaotic transformation, multiple forms |

Each frame includes:
- **Title area:** Card name (thematic) in top-left
- **Pixel art scene:** Mechanic-specific 2D scene illustrating the card's effect
- **Gemstone badge:** Top-left corner, colored by AP cost, holds AP value as overlay
- **Parchment text area:** Bottom third, card description text:
  - Grey text = base effect
  - Green text = buffed effect
  - Red text = debuffed effect

#### Card Animation Sequence

After answering correctly, cards execute a 5-phase animation sequence:

| Phase | Duration | Description | Audio |
|-------|----------|-------------|-------|
| **Reveal** | 250ms | Card flips to cardback; reveal animation |  |
| **Swoosh** | 250ms | Type-specific effect plays (slash, pulse, tendrils, etc.) | Archetype-matched synth sound |
| **Impact** | 300ms | 3D directional movement toward impact zone; particles/screen shake | Impact sfx |
| **Discard** | 200ms | Card minimizes and flies to discard pile in bottom-right | Whoosh sfx |
| **Total** | ~1000ms | Full animation lifecycle |  |

**Animation archetypes:**
- **Attack:** Golden slash + lunge forward
- **Shield:** Blue pulse + rise/expand
- **Buff:** Golden radiate + expand outward
- **Debuff:** Purple tendrils + dissolve inward
- **Utility:** Prismatic shimmer + morph shape
- **Wild:** Multi-color flash + adaptive motion

**Wrong answers:** Fizzle animation (400ms) — violent shake, sparks, fade out. The card exits to the **discard pile position (bottom-left)** with a swoosh — same exit direction as discarded cards. AP cost is always paid on a wrong answer (see §2 Action Points / Wrong Answer AP Cost).

**Draw / discard swoosh animations (Web Animations API):**

- **Draw**: Cards spring from the draw pile icon as tiny dots (scale 0.05) to their fan position via WAAPI with staggered delays (80ms per card index). Uses `composite: 'replace'` with the card's inline fan `transform` as the end state, so Svelte's positioning is never overridden.
- **Played card discard**: A ghost card (animation buffer copy) flies from its current position to the discard pile via WAAPI, triggered by a `MutationObserver` detecting the `card-discard` class change (200ms).
- **Fizzle**: Same ghost card path but with grayscale filter applied at the end keyframe and longer duration (400ms).
- **End-of-turn**: Remaining hand cards stagger-fly to the discard pile (250ms + 40ms per card stagger), then `onendturn()` fires after the last animation completes.
- **Reshuffle sequence**: When the draw pile empties, `reshuffleHoldingHand` holds `handCards` as an empty array during the reshuffle animation (discard→draw). Once the reshuffle completes, hand cards mount and swoosh in from the refilled draw pile.

*Implementation note:* CSS keyframe animations were tried first but conflict with Svelte's inline `transform`-based fan positioning — `!important` in keyframes is ignored per spec, and CSS custom properties (`--draw-pile-x/y`) aren't guaranteed set when the `0%` frame resolves. WAAPI with double `requestAnimationFrame` solves both issues.

**Discard pile indicator:** Bottom-left of combat HUD shows growing card pile count as cards are discarded. Draw pile indicator sits bottom-right.

#### Quiz panel wireframe (appears above card hand when committed)
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
| Attack | ~35% | Primary damage |
| Shield | ~30% | Block damage |
| Buff | ~12% | Enhance next card |
| Debuff | ~10% | Weaken enemy |
| Utility | ~8% | Draw, scout, manipulate |
| Wild | ~5% | Copy/adapt (copies target type's BASE_EFFECT value) |

### Domain Role

Domains provide: content organization, visual identity (color tint), Knowledge Library categorization, run pool selection. Domains do NOT determine card type, mechanic, or power.

### Fact Domains (16 Total)

**Original domains (content exists):**
- General Knowledge — broad trivia, cross-domain surprising facts
- Natural Sciences — biology, chemistry, physics, earth science
- Geography — countries, capitals, landmarks, demographics
  - **Capitals** — Geography subcategory: ~215 world capital facts with bi-directional questions (country→capital and capital→country) (selectable in Deck Builder)
  - **Flags of the World** — Geography subcategory: ~214 sovereign state flag facts with SVG flag images displayed in quiz questions (selectable in Deck Builder)
- History — events, figures, dates, civilizations, wars, inventions

**New knowledge domains (AR-16):**
- Space & Astronomy — planets, stars, missions, phenomena, cosmology, astronauts
- Mythology & Folklore — gods, creatures, legends, creation myths across all cultures
- Animals & Wildlife — species, behaviors, habitats, record-holders, taxonomy
- Human Body & Health — anatomy, nutrition, diseases, psychology, history of medicine
- Food & World Cuisine — dishes, ingredients, techniques, food history, cultural traditions
- Art & Architecture — movements, masterpieces, artists, famous buildings, design history

**Language vocabulary domains (AR-18):**
- Japanese (JLPT N5–N1)
- Spanish (CEFR A1–C2)
- French (CEFR A1–C2)
- German (CEFR A1–C2)
- Dutch (CEFR A1–C2)
- Czech (CEFR A1–C2)
- Korean (TOPIK 1–6)
- Mandarin Chinese (HSK 1–6)

Domain count determines content breadth. Each knowledge domain targets 10K+ facts. Each language targets 5K+ vocabulary entries across all proficiency levels.

---

## 4. Card Mechanics Pool (35 Mechanics, 18 at Launch)

Each TYPE has 4-6 mechanics. Per run, each fact gets a random mechanic from its assigned type's pool. Same fact, different mechanic each run. Prevents "France = my Multi-Hit card" memorization.

**Launch Phase Gating:** Each mechanic has a `launchPhase` (1 or 2). At launch, only Phase 1 mechanics (18 of 35) are active. Phase 2 mechanics are gated behind the `ENABLE_PHASE2_MECHANICS` feature flag in `balance.ts`. This ensures a tighter, more learnable mechanic set for new players. Phase 2 mechanics will unlock post-launch after player feedback.

### Attack Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Strike | Flat damage | 10 |
| Multi-Hit | Damage X times (scales with buffs per hit) | 3 x 3 |
| Heavy Strike | High damage, costs 2 AP | 14 |
| Piercing | Damage, ignores enemy block | 6 |
| Reckless | High damage + self-damage | 12 dmg, 3 self |
| Execute | Damage + bonus if enemy <30% HP | 6 (+8 below 30%) |
| Lifetap | Heal 20% of damage dealt this turn | 20% dmg |

### Shield Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Block | Flat block | 8 |
| Thorns | Block + reflect damage | 4 block + 2 reflect |
| Fortify | Block that persists into next turn | 4 persistent |
| Parry | Block + draw bonus if enemy attacks | 3 block + draw |
| Brace | Block equal to enemy's telegraphed attack | Varies |
| Cleanse | Block + remove 1 debuff | 6 + cleanse |
| Overheal | Block, excess → temporary shield | 7 (overflow) |
| Emergency | Large shield, only below 50% HP | 10 conditional |

### Buff Mechanics

The three buff identities in Recall Rogue:
- **Empower** = more POWER (+50% next card effect)
- **Quicken** = more ACTIONS (+1 AP free, quiz IS the cost)
- **Focus** = cheaper COSTS (next card -1 AP)

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Empower | Next card effect +50% | +50% |
| Double Strike | Next attack hits twice at full power | 2x 100% |
| Quicken | +1 AP this turn only | +1 AP |
| Focus | Next card costs 1 less AP | -1 AP |

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
| Immunity | Prevent next status damage instance | 1 shield |

### Wild Mechanics

| Mechanic | Effect | Base Value |
|----------|--------|------------|
| Mirror | Copy previous card's effect | Copy |
| Adapt | Choose attack/shield/buff/debuff/utility — copies target type's BASE_EFFECT | Varies (target type's base) |
| Overclock | Double effect, draw 4 next turn instead of 5 | 2x, -1 draw |

### Mechanic Assignment Rules

- Assigned randomly per run during pool building
- Heavy Strike (2 AP) limited to max 3 per pool
- Quicken (+1 AP) limited to max 2 per pool
- No duplicate mechanics in the same drawn hand (reroll on draw)
- Starter deck mechanics are simplified: attack cards default to Strike, shield cards to Block, with only 1–2 advanced mechanics (Multi-Hit, Thorns) sprinkled in. Complex mechanics are earned through card rewards.

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

## 4.5. Status Effects & Combat Buffs

Every active effect on the player or enemy is displayed as a clickable icon during combat. Tapping any icon shows a popup listing ALL active effects on that target with natural language descriptions.

### Debuffs (applied to enemy or player)

| Icon | Effect | Description | Source |
|------|--------|-------------|--------|
| ☠️ | Poison | Deals X damage at end of turn, then decreases by 1 | Hex card, enemy debuff intents |
| 💧 | Weakness | Attacks deal 25% less damage per stack | Weaken card, enemy debuff intents |
| 🎯 | Vulnerable | Takes 50% more damage | Expose card, enemy debuff intents |
| 🐌 | Slow | Skips next defend/buff action | Slow card |
| 🔥 | Burn | Deals X fire damage at end of turn | Future use |
| 🩸 | Bleed | Deals X bleed damage at end of turn | Future use |
| ❄️ | Freeze | Skips action | Future use |

### Buffs (applied to enemy or player)

| Icon | Effect | Description | Source |
|------|--------|-------------|--------|
| 💪 | Strength | Attacks deal +25% damage per stack | Enemy buff intents |
| 💚 | Regen | Heals X HP at end of turn | Future use |
| 🛡️ | Immunity | Absorbs next poison instance | Immunity card |

### Player Turn Buffs (from card mechanics, last 1 turn)

| Icon | Effect | Description | Source Card |
|------|--------|-------------|------------|
| 🌿 | Thorns | Deals X damage back when enemy attacks | Thorns |
| ⚡ | Empower | Next card gets +X% effect | Empower |
| ⚔️ | Double Strike | Next attack hits twice at 60% power | Double Strike |
| 🔮 | Focus | Next card gets minimum 1.3x multiplier | Focus |
| 👁️ | Foresight | Can see future enemy intents for X turns | Foresight |
| 🏰 | Fortify | Block persists into next turn | Fortify |
| ⚙️ | Overclock | Next card effect doubled, draw -1 next turn | Overclock |

### Stacking Rules
- **Poison**: Stacks additively (2 poison + 3 poison = 5 poison). Decreases by 1 each turn after dealing damage.
- **Weakness/Vulnerable**: Duration extends to max(existing, new). Stacks increase effect count.
- **Strength**: Stacks additively per buff application.
- **Turn buffs** (Thorns, Empower, Double Strike, etc.): Do not stack — reapplying refreshes the effect.

### Visual Display
- Status effect icons appear below enemy HP bar (enemy effects) and above player HP bar (player effects)
- Each icon shows: effect emoji, stack count badge (if >1), turns remaining counter
- Tapping any icon opens a full-list popup showing ALL active effects on that target with descriptions
- Icons appear when effects are applied and disappear when they expire

---

## 5. Card Tiers and Mastery Difficulty Escalation

Facts get HARDER as they approach mastery. Bjork's desirable difficulties: harder retrieval = better long-term memory.

| Tier | Internal | Display Name | FSRS Trigger | Question Format | Power | Visual |
|------|----------|-------------|-------------|----------------|-------|--------|
| 1 | 1 | Learning | Stability <2d | 3-option MCQ, generous timer | 1.0x | Standard frame (bronze) |
| 2a | 2a | Proven | Stability ≥2d, 2+ correct | 4-option MCQ OR reverse format | 1.3x | Silver tint |
| 2b | 2b | Proven | Stability ≥5d, 3+ correct | 5-option close distractors OR fill-blank | 1.6x | Silver + glow |
| 3 | 3 | Mastered | Pass Mastery Trial | Not asked — earns Mastery Coin | Permanent | Gold frame |

**Display Simplification:** Players see only 3 tiers: **Learning** (bronze), **Proven** (silver), and **Mastered** (gold). Internal tiers 2a/2b are both displayed as "Proven" — the sub-tier distinction is invisible to players. This reduces cognitive load while preserving the FSRS-driven difficulty escalation under the hood. Functions `getTierDisplayName()` and `getDisplayTier()` in `tierDerivation.ts` handle this mapping.

### Mastery Trial

Fact at Tier 2b (stability ≥5d, 3+ consecutive correct) + additional stability ≥10d + 4 consecutive correct total → qualifies for Tier 3.

- Golden card in hand
- 4-second timer (regardless of floor, no slow reader bonus)
- 5 options with very close distractors
- Hardest variant available
- Correct → Tier 3, Mastery Coin awarded, celebration
- Incorrect → stays Tier 2b, FSRS stability decreases, must requalify

### Pool Exhaustion Prevention

1. **FSRS decay:** Retrievability <0.7 → fact re-enters active pool as Tier 2a
2. **Domain exhaustion prompt:** <10 unmastered facts → prompt to add new domain
3. **Content expansion:** 10K+ facts per domain at launch across 10 knowledge domains + 6 language packs. Years of content depth.
4. **Mastery Challenge events:** Rare Mystery room. Mastered fact, 3s timer, 5 distractors. Fail → Tier 2b
5. **Minimum active pool:** <15 active facts → Tier 2b facts re-enter as active cards

### Tier-Up Celebration Animations

When a correct answer causes a card to advance to a higher tier (consecutiveCorrect crosses a threshold), a short celebration animation plays before the card launches:

| Transition | Color | Animation |
|---|---|---|
| Tier 1 → 2a (Recall) | Blue glow | Card rumbles, blue pulse radiates outward |
| Tier 2a → 2b (Deep Recall) | Green glow | Card rumbles, green pulse, brief sparkle particles |
| Tier 2b → 3 (Mastered) | Purple/Gold glow | Card rumbles, purple-to-gold gradient pulse, per-fact unique animation (future art asset) |

**Timing**: The tier-up animation inserts a ~600ms celebration phase between the existing "reveal" (400ms) and "mechanic" (500ms) phases. Total correct-answer sequence becomes: reveal → tier-up celebration → mechanic → launch.

**Detection**: After updating FSRS state on correct answer, compare the card's tier before and after. If tier increased, trigger the celebration before proceeding to the mechanic phase.

**Mastery Trial exception**: Tier 2b → 3 only occurs via the Mastery Trial, which already has its own golden card ceremony. The purple/gold tier-up animation plays as an additional flourish within that ceremony.

**Per-fact mastery animation**: When a card reaches Tier 3, a unique pixel-art animation specific to that fact plays (e.g., a lightning bolt fact shows lightning striking). These animations are generated as art assets in a future content phase. Until then, a generic gold burst placeholder is used.

---

## 5.5. Combat Visuals & Enemy Sprites

### Enemy Sprite Rendering

Enemy sprites are rendered via the **EnemySpriteSystem**, a centralized Phaser system that encapsulates all enemy visual display and animation. All 88 enemies now have unique pixel art sprites, significantly enhancing visual variety and dungeon identity compared to the pre-sprite phase. The system uses a single static PNG texture per enemy (no hit/death variants) and applies procedural animations for idle, attack, hit, and death states.

#### 3D Paper Cutout Effect

Enemy sprites use a **layered container with 3D paper cutout effect**:
1. **Shadow layer** — Offset dark copy (±4px) beneath the main sprite, creates depth illusion
2. **Outline layer** — Pixelated black outline (4 cardinal-direction copies: ±4px), 1px thickness, enhances readability on complex backgrounds
3. **Main sprite** — Layered on top, single PNG texture per enemy

This effect works on both real enemy sprites and placeholder colored rectangles (for enemies without art assets).

#### Idle Animation

Gentle, non-intrusive continuous animation applied to all enemies:
- **Vertical bob:** ±5px, 2.5s period (subtle breathing motion)
- **Scale breathing:** 1.0 → 1.02 scale, 3s period (gentle expansion/contraction)
- **Rotation wobble:** ±1° rotation, 4s period (gentle sway)

These animations use Phaser tweens and combine for a living, present feel without distraction.

#### Combat Animations

**Attack:** Enemy leans forward (+10° rotation), lurches forward (+22px translate), scales up to 1.1x. Snaps back to idle with elastic spring (bounce easing).

**Hit (wrong answer):** Enemy leans backward (−12° rotation), knockback (−15px translate), white screen flash (0.1s). Elastic spring-back to idle. Triggers haptic feedback (Heavy vibration).

**Death:** Sequential state changes:
1. **Red tint + jitter:** 0.3s, rapid micro-shakes (±2px)
2. **Gray ash tint:** Fade from red to desaturated gray over 0.5s
3. **Squish:** ScaleY → 0.3, squash-and-stretch collapse over 0.4s
4. **Ash particle burst:** 15-20 particles (gray, drifting upward with alpha fade)
5. **Fade out:** Full opacity → 0% over 0.5s, container disappears

Total death sequence: ~2.5s. Plays immediately on enemy HP → 0.

#### Placeholder Display

Enemies without sprite assets display as **colored rectangles** with the same layered 3D effect (shadow + outline). A **"?" icon** (white, centered) indicates missing art. Colored rectangles use the enemy's domain color tint (e.g., "History" domain = brown tint).

#### Enemy Display Sizes

Sprites display with aspect-ratio-preserving scaling, with the longest dimension constrained to:

- **Common enemies:** 300px (longest edge)
- **Elite enemies:** 340px (longest edge)
- **Mini-bosses:** 340px (longest edge)
- **Bosses:** 400px (longest edge)

### Enemy Rarity System

Common enemies have rarity tiers affecting spawn frequency and visual distinction:

| Rarity    | Spawn Weight | ~Distribution | Name Color |
|-----------|-------------|---------------|------------|
| Standard  | 10          | ~59%          | Gray #9ca3af |
| Uncommon  | 5           | ~29%          | Green #4ade80 |
| Rare      | 2           | ~12%          | Gold #fbbf24 |

Per region: ~7 standard, 3 uncommon, 1 rare out of 11 common enemies.
Selection uses weighted random (same pattern as intent selection).

### Difficulty Variance

Each common enemy instance spawns with a random difficulty multiplier (0.8–1.2x), affecting both HP and damage output. Non-common enemies always use 1.0x (no variance). This creates encounter-to-encounter variety even with the same enemy type.

### Animation Archetypes

Each enemy is assigned one of 8 animation archetypes that define procedural idle, attack, and hit tween parameters. These archetypes provide variety in combat feel and enemy personality without requiring hand-animated sprite sheets:

| Archetype  | Feel                  | Used By                         |
|------------|-----------------------|---------------------------------|
| Swooper    | Fast diagonal bob     | Bats, moths, drakes             |
| Slammer    | Slow heavy breathe    | Golems, trolls, titans          |
| Crawler    | Side-to-side sway     | Spiders, grubs, beetles         |
| Caster     | Hovering float        | Imps, wraiths, elementals       |
| Floater    | Large slow drift      | Jellyfish, sprites, phantoms    |
| Lurcher    | Unsteady wobble       | Shamblers, slimes, worms        |
| Striker    | Alert rapid stance    | Raptors, hounds, stalkers       |
| Trembler   | Still with twitches   | Sentinels, scarabs, golems      |

Config defined in `src/data/enemyAnimations.ts`, consumed by `EnemySpriteSystem`. Hit/death animations are also fully procedural (tweens + particles).

### Enemy Size Tiers

Enemy sprite size scales by category for visual impact hierarchy:

| Category   | Size (px) | % of Boss |
|------------|-----------|-----------|
| Common     | 300       | 75%       |
| Elite      | 340       | 85%       |
| Mini-boss  | 340       | 85%       |
| Boss       | 400       | 100%      |

### Enemy Roster Summary

88 total enemies across 4 dungeon regions, each with unique pixel art sprites:
- **45 common** (11-12 per region, with rarity tiers)
- **25 mini-boss** (6-7 per region)
- **10 elite** (2-3 per region)
- **8 boss** (2 per region)

Regions: Shallow Depths (floors 1-6), Deep Caverns (7-12), The Abyss (13-18), The Archive (19-24).

All enemy sprites are processed via `scripts/process-enemy-sprites.mjs` from source PNGs into mobile-ready formats (`.webp` for standard devices, `_1x.webp` for low-end). Sprite assets preload at CombatScene startup for seamless combat transitions.

#### Performance & Accessibility

**Reduced Motion:** When `prefers-reduced-motion` is active, all animations are disabled. Enemies display statically. Attack/hit/death states still show visually (no animation, instant transitions).

**Device-Tier Scaling:** On low-end devices, particle count and tween complexity scale down to 0.65x (fewer particles, shorter durations, simpler easing). Determined by `performance.memory.jsHeapSizeLimit` check in `EnemySpriteSystem.ts`.

---

## 5.6. VFX Systems (Atmosphere & Status Effects)

### Combat Atmosphere System (D2)

Creates atmospheric effects that evolve as the player descends deeper into the dungeon, with each floor theme providing visual feedback on progression.

#### Floor Themes
- **Dust (Floors 1-3):** Tan/beige dust particles with gentle downward gravity, subtle fog overlay
- **Embers (Floors 4-6):** Orange/red embers with upward gravity (heat rising), thicker fog
- **Ice (Floors 7-9):** Cyan/blue ice particles with slight downward gravity, ethereal atmosphere
- **Arcane (Floors 10-12):** Purple/violet arcane wisps with slight upward gravity, magical aura
- **Void (Floors 13+):** Dark purple/black void particles with slight upward gravity, menacing aura

#### Effects
- **Fog overlay:** Front-most layer (depth 2) with semi-transparent black rectangle covering bottom 40% of display zone. Alpha oscillates gently (sine wave, 3s period) to create breathing effect. Boss encounters use stronger fog (15% alpha) than regular encounters (8% alpha).
- **Ambient particles:** Procedurally spawned every 500ms, one particle per spawn (respects device-tier budgets). Particles spawn randomly across the upper-middle display area, drift per theme physics, fade to 0% alpha over 3s lifespan. Budget: low-end = 10 particles total, mid-tier = 20, flagship = 50.

#### Device Adaptation
- **Low-end:** 0.65x effect scale, 10 particle budget
- **Mid-tier:** 1.0x scale, 20 particle budget
- **Flagship:** 1.0x scale, 50 particle budget
- **Reduce Motion:** All atmosphere effects disabled. Fog and particles do not render.

### Status Effect Visual System (D3)

Renders persistent visual overlays on the enemy showing active status effects, providing real-time feedback on combat state.

#### Effect Types

| Effect | Particle Tint | Gravity | Rate | Visual Style |
|--------|---------------|---------| -----|--------------|
| **Poison** | Green (#44ff44) | 60 (downward) | 3/sec | Dripping toxin |
| **Burn** | Orange (#ff6600) | -40 (upward) | 3/sec | Rising embers |
| **Freeze** | Cyan (#88ccff) | 5 (gentle down) | 2/sec | Drifting frost |
| **Bleed** | Red (#cc0000) | 80 (fast down) | 2/sec | Falling droplets |
| **Buff** | Gold (#ffd700) | 0 (none) | 0 | Rotating aura ring |
| **Debuff** | Purple (#9b59b6) | 0 (none) | 0 | Rotating aura ring |

**Buff/Debuff Mapping:**
- **Buff effects** (strength_up, empower, quicken) render as a rotating golden aura ring (60px radius) with pulsing alpha (0.1–0.25 range)
- **Debuff effects** (weaken, expose, slow) render as a rotating purple aura ring with same pulsing pattern

#### Particle-Based Effects
- **Poison/Burn/Freeze/Bleed:** Spawned every interval (based on rate), offset ±30px from enemy position
- **Speed variation:** Particles move at different velocities per effect (poison 10-25px/s, burn 15-30px/s, freeze 5-15px/s, bleed 8-20px/s)
- **Lifespan:** 800ms per particle with alpha fade-out over duration
- **Depth:** Rendered at depth 999 (in front of enemy sprite, behind dialogue overlays)
- **Angle:** Particle spray angle depends on gravity direction (upward effects: 250-290°, downward: 70-110°)

#### Effect Lifecycle
- **Add:** When an effect is first applied to the enemy, its visual system initializes
- **Persistent:** Visual continues rendering every game frame while effect is active
- **Remove:** When effect expires or is cleansed, visual system destroys particles/tweens and clears map entry
- **Multi-effect:** Multiple status effects can be active simultaneously (e.g., poisoned + burning), each with independent particle streams

#### Device Adaptation
- **Low-end:** 0.65x particle scale (smaller, thinner trails)
- **Mid/Flagship:** 1.0x particle scale
- **Reduce Motion:** All status effect visuals disabled. No particles or aura rings render.

---

## 5.7. VFX Systems (Hub & Ceremonies)

### Campfire Living Fire (C1)

A Canvas2D overlay renders a living campfire tied to the player's streak:

| Streak | Particles | Glow Radius | Glow Alpha |
|--------|-----------|-------------|------------|
| None | 10 | 80px | 0.10 |
| 3-day | 20 | 100px | 0.14 |
| 7-day+ | 30 | 120px | 0.18, occasional spark pops |

30fps throttled, warm palette (0xFF6B1A → 0xFFCC00), sin-wave flicker. Disabled on reduce-motion.

### Hub Ambient Micro-Animations (C2)

CSS-only sprite animations on camp objects:
- **Cat/Pet:** `.ambient-breathe` — scaleY 1→1.005 over 3s
- **Tent/Profile:** `.ambient-sway` — translateY ±1px over 4s
- **Anvil/Relics:** `.ambient-spark` — gold dot pseudo-element with 8s pop interval

All disabled by `@media (prefers-reduced-motion: reduce)`.

### Echo Card Visuals (C3)

Echo cards (wrong-answer ghosts that reappear later in a run) have distinct haunted styling:
- Lower opacity (0.65), dashed purple border, desaturation filter
- Chromatic aberration via box-shadow color offsets (red/cyan shift)
- `echoShimmer` keyframe animation (5-step opacity+filter cycle)
- `echoWisp` pseudo-element with radial gradient floating animation

### Near-Death Tension (C4)

When player HP drops below 25%:
- Svelte overlay: `filter: saturate(0.7)` desaturation on non-critical elements
- Phaser: Red vignette overlay at screen edges with heartbeat pulse (1Hz)
- Combined effect makes clutch plays feel heroic

### Enrage Visual Indicator (C5)

When enemy enters enrage phase (turn budget exceeded):
- Intensified idle animations (1.5x bob amplitude, 1.3x speed)
- Red glow rectangle border around enemy sprite with pulsing tween
- Continuous red particle border (spawned every 300ms)

### Charge Attack Telegraph (C6)

During enemy charge turns (0-damage preparation):
- Growing orange glow circle around enemy (radius tween 20→60px)
- Orange particle accumulation (1 particle/200ms, expanding radius)
- Camera pull-back (scale 0.97→1.0 on release turn)

### Reward Altar Ceremony (D1)

4-phase ceremony when selecting a card reward (1200ms total, skippable):
1. **Altar Brighten** (0-300ms): `filter: brightness(1.3)` pulse
2. **Ceremony Rise** (300-600ms): Card options rise with staggered translateY
3. **Selected Glow** (600-900ms): Selected card intensifies type-colored glow
4. **Spotlight Narrow** (900-1200ms): Spotlight tightens to selected card

### Perfect Turn Celebration (D5)

3/3 correct answers in a turn triggers:
- ComboCounter shows "PERFECT!" text with golden glow (already built into combo system)
- Triple heavy haptic feedback
- Brief golden screen pulse (200ms)

### Run End Statistics (D6)

Post-run screen animations:
- **Victory:** Gold rain pseudo-elements, stat rows cascade in with 80ms stagger delay
- **Defeat:** Desaturation (`filter: grayscale(0.7)`), red header pulse
- Stat values pop with `statPop` keyframe emphasis animation
- 300ms interaction delay before buttons appear
- All disabled on reduce-motion

---

## 6. Relic System

Relics are permanent passive buffs collected during runs. The system replaces the old Tier 3 passive relic model with an STS-inspired relic economy.

### Mastery Coins

When a fact reaches Tier 3 (passes Mastery Trial), the player earns 1 **Mastery Coin**. Coins are the permanent meta-currency for unlocking relics. Existing players receive retroactive coins for all Tier 3 facts on save migration.

Mastered facts **do not** directly grant a relic anymore. The old "fact -> relic assignment/pool sprite pick" model is removed.

Current flow:
1. Pass Mastery Trial -> gain +1 Mastery Coin.
2. Spend coins in the Hub relic shop.
3. Unlocked relics are added to the eligible in-run relic pool.

### Relic Catalogue

50 relics total: 25 free starters (available to all players) + 25 unlockable (purchased with Mastery Coins).

**Categories:** Offensive, Defensive, Sustain, Tactical, Knowledge, Economy, Cursed.
**Rarities:** Common, Uncommon, Rare, Legendary.
**Data:** `src/data/relics/starters.ts` (25 free), `src/data/relics/unlockable.ts` (25 unlockable).

#### Free Starters (25, cost 0)

| ID | Name | Category | Effect |
|----|------|----------|--------|
| whetstone | Whetstone | Offensive | All attack cards +2 flat damage |
| flame_brand | Flame Brand | Offensive | First attack each encounter +40% damage |
| barbed_edge | Barbed Edge | Offensive | Strike-tagged mechanics +2 base damage |
| war_drum | War Drum | Offensive | +1 damage per combo level this turn |
| sharp_eye | Sharp Eye | Offensive | Speed bonus +75% instead of +50%, speed threshold widened to 35% |
| iron_buckler | Iron Buckler | Defensive | +3 block at start of each turn |
| steel_skin | Steel Skin | Defensive | Take 2 less damage from all sources (min 1) |
| thorned_vest | Thorned Vest | Defensive | 2 reflect damage, 4 if no block |
| stone_wall | Stone Wall | Defensive | All shield cards +3 block |
| herbal_pouch | Herbal Pouch | Sustain | Heal 5 HP at encounter start; if >80% HP, +3 block instead |
| vitality_ring | Vitality Ring | Sustain | +15 max HP this run |
| medic_kit | Medic Kit | Sustain | Lifetap cards +20% effectiveness, heal effects +3 |
| last_breath | Last Breath | Sustain | Once/encounter: survive killing blow at 1 HP, +8 block, +5 damage |
| swift_boots | Swift Boots | Tactical | Draw 6 cards/turn instead of 5 |
| combo_ring | Combo Ring | Tactical | Combo starts at 1.10x instead of 1.0x |
| momentum_gem | Momentum Gem | Tactical | Perfect turn grants +1 AP next turn |
| speed_charm | Speed Charm | Tactical | Speed bonus threshold 35% instead of 25%, fast answers heal 1 HP |
| cartographers_lens | Cartographer's Lens | Tactical | Permanent foresight (see 2 enemy intents) |
| scholars_hat | Scholar's Hat | Knowledge | Correct answers heal 2 HP and deal +1 damage; wrong answers heal 1 HP |
| memory_palace | Memory Palace | Knowledge | 2 correct in a row: +4 damage to next attack |
| curiosity_gem | Curiosity Gem | Knowledge | Tier 1 (Learning) cards +15% effect |
| brain_booster | Brain Booster | Knowledge | Hints cost no currency |
| gold_magnet | Gold Magnet | Economy | +25% currency from encounters |
| lucky_coin | Lucky Coin | Economy | +2 flat currency per encounter |
| scavengers_pouch | Scavenger's Pouch | Economy | +2 currency per skipped card |

#### Unlockable Relics (25, Mastery Coin costs 25-70)

| ID | Name | Cat | Effect | Rarity | Cost |
|----|------|-----|--------|--------|------|
| berserker_band | Berserker Band | Off | Below 50% HP: attacks +40% | Uncommon | 40 |
| chain_lightning_rod | Chain Lightning Rod | Off | Multi-hit +2 extra hits | Rare | 50 |
| venom_fang | Venom Fang | Off | Attacks apply 2 poison/3 turns | Uncommon | 35 |
| crescendo_blade | Crescendo Blade | Off | Each correct attack: +10% dmg (stacks) | Uncommon | 45 |
| executioners_axe | Executioner's Axe | Off | Execute threshold 40%; +3 attack below 30% enemy HP | Rare | 50 |
| fortress_wall | Fortress Wall | Def | Block carries between turns (max 20) | Uncommon | 45 |
| mirror_shield | Mirror Shield | Def | Block absorb: reflect 20% damage | Rare | 50 |
| iron_resolve | Iron Resolve | Def | Below 50% HP: block +50%, attacks +15% | Uncommon | 40 |
| phase_cloak | Phase Cloak | Def | 20% chance to dodge attacks | Rare | 60 |
| blood_pact | Blood Pact | Sustain | Heal 35% of damage dealt/turn | Rare | 40 |
| phoenix_feather | Phoenix Feather | Sustain | Once/boss: resurrect at 35% HP, +15 block | Rare | 40 |
| renewal_spring | Renewal Spring | Sustain | Heal 15% max HP on floor advance; if >80% HP, +5 block | Uncommon | 35 |
| quicksilver | Quicksilver | Tactical | Start encounters with +1 AP | Rare | 60 |
| time_dilation | Time Dilation | Tactical | Quiz timer +3 seconds | Uncommon | 30 |
| afterimage | Afterimage | Tactical | Perfect turn: +1 card draw next turn | Uncommon | 40 |
| echo_lens | Echo Lens | Tactical | Echo cards at full power (1.0x) | Uncommon | 35 |
| double_vision | Double Vision | Tactical | First card each encounter costs 0 AP | Rare | 55 |
| polyglot_pendant | Polyglot Pendant | Knowledge | Secondary domain cards +25% damage | Uncommon | 40 |
| eidetic_memory | Eidetic Memory | Knowledge | Facts correct 3+ times: +25% effect | Rare | 50 |
| speed_reader | Speed Reader | Knowledge | Speed bonus at 20% of timer | Rare | 55 |
| domain_mastery | Domain Mastery | Knowledge | 4 same-domain correct: next card +75% | Rare | 60 |
| prospectors_pick | Prospector's Pick | Economy | Card rewards have 4 options | Uncommon | 45 |
| miser_ring | Miser's Ring | Economy | Run end: 10% currency → mastery coins | Uncommon | 50 |
| glass_cannon | Glass Cannon | Cursed | Attacks +35% dmg, take +10% more (+5% per wrong) | Uncommon | 25 |
| blood_price | Blood Price | Cursed | +2 cards/turn +1 AP/turn, lose 3 HP/turn | Uncommon | 30 |

### Relic Archive (Hub Relic Shop)

The camp **Anvil** opens the **Relic Archive** screen (internally still routed as `relicSanctum` for backward compatibility):
- Browse all 50 relics filtered by rarity/category
- View full details: icon, name, rarity, description, dungeon backstory, effects
- **Unlock** relics by spending Mastery Coins
- **Exclude** relics from run pool (toggle)
- Shows mastery coin balance and unlock progress

Unlocking a relic does not equip it directly. It only makes that relic eligible for future in-run drops/reward choices.

### In-Run Acquisition

Relics are collected during runs. No active relic limit — all collected relics stay active.

| Trigger | Relic Award |
|---------|-------------|
| First mini-boss of run (Floor 1, Enc 3) | Choose 1 of 3 relics (RelicRewardScreen) |
| Subsequent mini-bosses | 1 random relic (toast notification) |
| Boss encounters | Choose 1 of 3 relics (better rarity weights) |
| Regular encounters | 10% chance random relic drop (toast notification) |

**Rarity weights (regular):** Common 50%, Uncommon 30%, Rare 15%, Legendary 5%.
**Rarity weights (boss):** Common 25%, Uncommon 35%, Rare 25%, Legendary 15%.

Relics already held or previously offered in the run are excluded from the pool. Only unlocked (or starter) and non-excluded relics are eligible.

### Combat Integration

Relic effects are resolved by `relicEffectResolver.ts` — a centralized service with pure functions. The encounter bridge builds `activeRelicIds: Set<string>` from the run's collected relics at encounter start. Effect hooks fire at: encounter start, card play, turn end, damage taken, lethal, perfect turn, correct answer, card skip.

### Relic Display

During runs, collected relics appear in the **RelicTray** at the bottom of the combat screen (horizontal scroll, overflow badge). Tapping shows name + description tooltip. Trigger pulse animation on activation.

### Dormancy

Removed. Relics collected in a run stay active for the entire run. The old FSRS-based dormancy system no longer applies.

### Hidden Relic Synergies

Certain relic combinations trigger hidden synergies that provide subtle bonuses without explicit tooltips. Players discover these through experimentation and community sharing. Synergies are graded by rarity (Tier 1 = common pairs, Tier 3 = legendary triples).

**Synergy Activation:**
- Checked at encounter start via `relicSynergyResolver.detectActiveSynergies()`
- Bonuses apply automatically during combat
- Subtle visual feedback (golden flash, brief name callout) hints activation
- No explicit tooltip explains the bonus — players must experiment

**Synergy Catalogue:**

| Synergy | Tier | Requirements | Hint |
|---------|------|--------------|------|
| Glass Berserker | 1 | glass_cannon + berserker_band | Natural stacking |
| Immortal Puncher | 1 | blood_pact + berserker_band | Sustain at low HP |
| Untouchable | 1 | fortress_wall + mirror_shield + stone_wall | Block stacking + reflect |
| Crescendo Executioner | 2 | crescendo_blade + executioners_axe | Enhanced execute + crescendo |
| Perpetual Motion | 2 | blood_price + blood_pact + quicksilver | Reduced cost, increased lifesteal |
| Knowledge Engine | 2 | eidetic_memory + domain_mastery + scholars_hat | Enhanced knowledge bonuses |
| Speed Demon | 2 | Any 2 of: speed_reader, sharp_eye, speed_charm | Enhanced speed mechanics |
| Echo Master | 2 | echo_lens + combo_ring | Echo-combo synergy |
| Phoenix Rage | 3 | phoenix_feather + glass_cannon + berserker_band | Post-resurrect power spike |
| Perfect Storm | 3 | scholars_hat + memory_palace + domain_mastery | Streak-based bonus |
| Mastery Ascension | 3 | 5+ Tier 3 cards in deck (no relic requirement) | Knowledge mastery reward |

**Design Philosophy:**
- Synergies reward observant players and deck experimentation
- No relic is "useless" — every one has at least one hidden pair
- Tier 3 synergies are rare (often requiring 3+ relics or specific deck composition)
- Synergy bonuses never exceed 25% power increase — they feel like a pleasant surprise, not game-breaking

---

## 7. Run Structure

### Dungeon Layout

| Segment | Floors | Encounters/Floor | Bosses | Death Penalty |
|---------|--------|-----------------|--------|---------------|
| Shallow Depths | 1-6 | 3 (2 regular + 1 mini-boss) + events | Floor 3 & 6: randomly The Excavator **or** Magma Core | Die = keep 80% |
| Deep Caverns | 7-12 | 3 (2 regular + 1 mini-boss) + events | Floor 9 & 12: randomly The Archivist **or** Crystal Warden | Die = keep 65% |
| The Abyss | 13-18 | 3 (2 regular + 1 mini-boss) + events | Floor 15 & 18: randomly Shadow Hydra **or** Void Weaver | Die = keep 50% |
| The Archive | 19-24 | 3 (2 regular + 1 mini-boss) + events | Floor 21 & 24: randomly Knowledge Golem **or** The Curator | Die = keep 35% |
| Endless | 25+ | Scaling | Boss every 3 floors (cycles through boss pool) | Die = keep 35% |

**Boss Selection:** Each boss floor randomly picks one boss from its segment's pool using the seeded RNG, so the same run seed always produces the same boss sequence but different seeds vary the encounter. Both bosses in a pool may appear in the same run (e.g., both The Excavator and Magma Core on floors 3 and 6). Boss pools by segment:
- **Shallow Depths:** The Excavator, Magma Core
- **Deep Caverns:** The Archivist, Crystal Warden
- **The Abyss:** Shadow Hydra, Void Weaver
- **The Archive:** Knowledge Golem, The Curator

Each floor has 3 encounters: encounters 1-2 are regular combat (common enemies), encounter 3 is always a mini-boss (or full boss on boss floors: 3, 6, 9, 12, 15, 18, 21, 24).

### Retreat-or-Delve Psychology

Kahneman & Tversky's prospect theory: loss aversion at ~2x. At 20% risk (Segment 1), most players push. At 65% risk (Segment 4), only confident players continue. Escalating risk matches escalating reward. Never exceed 65% loss — total wipeout causes quit behavior on mobile.

### Dungeon Map (Act Map)

Each act uses a scrollable vertical map with branching paths, similar to Slay the Spire. The full map is visible from the start — no fog of war.

**Map structure:**
- 15 rows per act, with 3–5 nodes per row
- Paths branch and merge using a non-crossing edge rule (STS-style)
- Row 0: always 3 combat nodes (start options)
- 3–5 elite rooms distributed randomly across rows 5–12 (never before row 5)
- Row 13: pre-boss row (rest or shop only)
- Row 14: single boss node (all paths converge)

**Node types:**

| Icon | Node | Description |
|------|------|-------------|
| Sword | Combat | Standard encounter, card reward |
| ! | Elite | Harder enemy, guaranteed relic drop |
| Skull | Boss | Act boss, triggers retreat-or-delve checkpoint |
| ? | Mystery | Random event (good, bad, or choice) |
| Heart | Rest | Heal 30% HP OR upgrade one card |
| Chest | Treasure | Free card, no combat |
| Bag | Shop | Buy/sell cards + buy relics with currency |

**Generation rules:**
- Map generated deterministically from the run seed (same seed = same map)
- Room distribution weighted by segment: more combat early, more variety (rest/shop/mystery) later
- Guaranteed at least 1 rest node and 1 shop node per act
- After clearing a node, only directly connected next-row nodes are selectable
- Boss defeated → special event → retreat-or-delve checkpoint
- Retreat → hub; Delve → new act map generated for the next segment
- Guaranteed 3–5 elite nodes per act, with `ELITE_MIN_ROW = 4` (row index, = 5th row). Excess elites are demoted to combat; too few are promoted from combat.

**Map Cinematic Scroll (Floor Entry):** When entering a new floor (run start + after each boss), the map plays a one-time cinematic sequence (tracked by map seed — plays only once per floor):
1. Map zooms to 1.5× centered on the boss node for ~1 second
2. Zooms out to full-map view
3. Camera sweeps down to the player's starting nodes
The boss node renders the actual boss sprite (not a crown emoji) with a 3D floating animation. Elite nodes display a purple menacing pulse. The scrollbar is hidden during the cinematic. Subsequent re-visits to the same floor's map do not replay the cinematic.

**Player interaction:**
1. After `onArchetypeSelected()`, an ActMap is generated and the `dungeonMap` screen appears
2. Player taps a node to navigate to it (combat/rest/shop/mystery/etc.)
3. After the encounter reward screen, player returns to the dungeon map
4. Locked nodes (future, not yet reachable) are shown at 70% opacity — visible but clearly not selectable
5. Visited nodes (already completed) are shown at 25% opacity with grayscale filter

### Card Upgrade System (Rest Sites & Post-Mini-Boss)

Cards can be upgraded at rest sites and post-mini-boss encounters, gaining a "+" suffix (e.g., "Strike+") and boosted numeric values. Upgrades do NOT replace mechanics — they enhance existing values.

**How It Works:**
1. Player enters Rest Room and selects **Upgrade Card** option
2. 3 card candidates are offered, sorted by knowledge tier (Tier 2b > Tier 2a > Tier 1)
3. Player taps one card → it gains `isUpgraded: true` and boosted values → returns to deck

**Upgrade Bonuses Per Mechanic:**

| Mechanic | Base | Upgraded | Change |
|----------|------|----------|--------|
| strike | 8 dmg | 11 dmg | +3 base |
| multi_hit | 3×3 | 4×3 | +1 hit |
| block | 6 | 8 | +2 |
| thorns | 4/2 | 5/3 | +1/+1 |
| restore | 8 | 11 | +3 |
| cleanse | 6 | 8 | +2 |
| empower | 30% | 40% | +10% |
| quicken | +1 AP | +1 AP + draw 1 | adds draw |
| weaken | 2 turns | 3 turns | +1 turn |
| expose | 1 turn | 2 turns | +1 turn |
| scout | draw 1 | draw 2 | +1 draw |
| recycle | cycle 1 | cycle 1 + draw 1 | +1 draw |
| sustained | 3 regen | 4 regen | +1 |
| emergency | 4 burst | 6 burst | +2 |
| mirror | 1.0x | 1.25x | +0.25 |
| adapt | 1.0x | 1.25x | +0.25 |
| heavy_strike | 3 AP, 20 dmg | 2 AP, 20 dmg | AP cost -1 |

**Upgrade Axes:**
Upgrades fall into two categories:
1. **Value boosts** — increased damage, healing, duration, or card draws (e.g., Strike 8→11 dmg)
2. **AP cost reduction** — reduced AP cost for 2-3 AP cards (e.g., Heavy Strike 3 AP→2 AP). This creates more interesting upgrade decisions: "Do I want more damage on my standard cards, or unlock a resource-efficient heavy hitter?"

**Visual Indicator:** Upgraded cards display a subtle blue glow border in the hand.

**Post-Mini-Boss Upgrade Flow:**
- After defeating a mini-boss (encounter 3 on non-boss floors), player auto-heals 15% max HP
- First mini-boss of the run → relic reward instead of upgrade
- Mini-bosses 2+ → upgrade selection (pick 1 of 3 cards)

This creates STS-style card scaling: early runs feel tight, but depth 6+ upgrades can snowball into powerful synergies.

### Deck Building Strategy

**Starter Deck Size:** Runs begin with a lean deck of ~15 cards (down from 20). This creates meaningful choice around each reward and prevents the hand from becoming too bloated.

**Starter Deck Composition (Slay the Spire Model):** The starter deck is deliberately simple — mostly basic Strike (attack, 8 dmg) and Block (shield, 6 block) cards, following the Slay the Spire philosophy of starting simple and building complexity through card rewards. Of the ~15 starter cards:
- ~6 attack cards: mostly Strike, with 1 Multi-Hit for variety
- ~5 shield cards: mostly Block, with 1 Thorns for variety
- ~4 utility/buff/debuff cards: retain their assigned mechanics
Complex mechanics (Execute, Piercing, Fortify, Parry, Overheal, etc.) are only available as **card rewards after combat encounters**, not in the starter deck. This is enforced by `simplifyStarterMechanics()` in `encounterBridge.ts`.

**Deck Evolution:** Players grow their deck after each encounter victory by choosing a card TYPE to add. Additionally, players can visit Shop rooms to:
- **Buy cards** with gold currency (add specific cards to deck)
- **Sell/remove cards** (thin the deck, gain currency)

This gives players three levers for deck building:
1. **Type selection after encounters** — Strategic reward choices
2. **Card purchasing at shops** — Intentional insertions
3. **Card removal/selling at shops** — Pruning weak cards

Combined, these create STS-style deck building agency: "I'm thinning junk and doubling down on my shield strategy" is a legitimate play pattern.

### Shop Enhancement System

Shop rooms offer both buying and selling operations. Players gain gold currency from encounter victories, enabling progressive deck refinement.

**Buy Side:**
- 2 random relics available per shop visit
- 2 random cards from player's eligible pool
- Prices scale by rarity/tier with floor-based discounts

**Relic Pricing:**
| Rarity | Price |
|--------|-------|
| Common | 60g |
| Uncommon | 100g |
| Rare | 160g |
| Legendary | 250g |

**Card Pricing:**
| Tier | Price |
|------|-------|
| Tier 1 (Learning) | 15g |
| Tier 2a (Recall-a) | 30g |
| Tier 2b (Recall-b) | 45g |
| Tier 3 (Mastered) | 75g |

**Floor Discount:** Shop prices decrease by 3% per floor (max 40% discount at floor 13+). Encourages late-run purchasing while maintaining early economy tension.

**Sell Side:** (unchanged from existing system)
- Remove unwanted cards from deck, gain gold
- Useful for thinning weak cards and funding relic purchases

**Gold Economy:**
- Awarded after every encounter victory (scales with enemy difficulty)
- Typical run nets ~800–2,200g across 24 floors
- Early floors (1–6): favor combat/upgrades; shops are secondary
- Mid floors (7–15): shops become primary resource sink (card/relic purchases)
- Late floors (19–24): gold abundance enables strategic last-minute purchases

**Strategic Interplay:**
Shop purchasing creates a metagame tension: aggressive early runs might starve gold (1,000g for a Rare relic), while greedy farming wastes combat floor opportunities. This mirrors STS "greed vs. tempo" deck-building decisions.

### Card Reward System

After an encounter victory, the player receives a card reward. Rather than being offered 3 random cards (random fact + random type), the player now chooses a CARD TYPE they want to add to their deck, and a random fact from the encounter's pool is assigned to that type.

**The Flow:**
1. Encounter ends (player victory)
2. Reward screen shows 3 card TYPE options (e.g., "Attack," "Shield," "Heal," "Buff," "Debuff," "Utility")
3. Player taps the type they want
4. A random undrawn fact from the encounter's ~120-fact pool is assigned to that type → new card added to deck
5. Deck strategy is now legible: "I'm building a shield-heavy deck" becomes a real choice

**Type Option Curation:**
The 3 types shown are weighted strategically, not purely random:
- Always include at least 1 Attack option and 1 defensive option (Shield or Heal)
- The third slot rotates between Buff, Debuff, Utility, Wild, or Regen
- Rare mechanics (Thorns, Overclock, Multi-Hit variants) can appear as special call-outs within a type
- All options remain equally clickable — curation is for visual variety, not hard gating

**Why This Works for Learning:**
Players still engage with diverse facts because fact assignment is random. Choosing "Attack" doesn't mean you know what fact you'll get — you might get a Science fact, a History fact, or an Art fact. But now players control their *mechanical deck identity* independent of *educational domain coverage*. Players can build intentionally while still seeing a full breadth of facts.

**Anti-Exploitation Note:**
Card type selection does not let players avoid any domain. A player building an all-Attack deck still sees facts from every domain they've engaged with during the run. Type selection affects combat strategy, not educational scope.

### Reward Altar Presentation

Post-encounter rewards are presented as physical objects on an atmospheric altar scene rather than UI buttons.

**Scene composition:**
- A spotlight cone illuminates a surface from above
- Surface style varies by biome: stone slab (caves), wooden table (library), mossy altar (forest), ornate pedestal (temple)
- A decorative cloth/mat sits on the surface with reward icons arranged on top

**Reward icons** (pixel-art objects, not buttons):

| Reward Type | Icon Variants |
|---|---|
| Attack card | Sword, axe, dagger, staff, bow |
| Shield card | Round shield, tower shield, buckler |
| Heal card | Potion bottle, herbs, bandage roll |
| Buff/Utility card | Scroll, crystal, tome, amulet |
| Gold | Small pile of gold coins |
| Potion | Glowing flask |
| Relic | Ornate glowing artifact |

**Interaction flow:**
1. All reward options displayed as icons on the altar (pick one)
2. Tap an icon → it lifts, spotlight focuses, stats tooltip appears below
3. "Accept" button appears at bottom (no fact preview or reroll — the fact is hidden until after selection)
4. On accept → chosen reward flies to deck/inventory, others fade to shadow
5. A "New Fact Acquired" toast appears for 2.5 seconds showing the fact text of the gained card
6. Each icon has subtle idle animation (bob, shimmer, glow pulse)

**Art assets required:** ~30 icon sprites (multiple variants per reward type), 4-5 altar surface backgrounds, cloth/mat overlay, spotlight effect.

### Encounter Termination

1. Enemy HP ≤ 0 → Victory + card reward (type selection screen)
2. Player HP ≤ 0 → Defeat, run ends with retreat penalties
3. Segment-based enrage — turn budget tightens on deeper floors:
   - Floors 1-6 (Shallow Depths): enrage from turn 9
   - Floors 7-12 (Deep Caverns): enrage from turn 8
   - Floors 13-18 (The Abyss): enrage from turn 7
   - Floors 19-24 (The Archive): enrage from turn 6
   - Floors 25+ (Endless): enrage from turn 5
   - Phase 1: +2 dmg/turn for first 3 enrage turns
   - Phase 2: +4 dmg/turn after 3 enrage turns (on top of phase 1 cap of 6)
   - Desperate attack: enemies below 30% HP deal +3 bonus damage per turn

### Save/Resume System

Players can quit mid-run and resume later. Only ONE active run save at a time. Save state is stored in `localStorage` under key `recall-rogue-active-run`.

**Auto-save triggers:**
- After every encounter victory (before card reward)
- After card reward selection
- After selecting a map node (before encounter starts)
- When player enters campfire/pause screen
- When app goes to background

**Resume flow:**
- On app startup, if an active run save exists, the Hub shows a "Run in progress" banner with Continue/Abandon buttons
- Continue/Abandon buttons appear **reactively** when navigating back to Hub mid-run (no page refresh needed)
- Resume restores full run state (floor, HP, deck, pool, relics, screen position)
- **Abandon confirmation modal**: Tapping Abandon shows a popup with run progress (current floor, gold earned, encounters won, facts answered correctly) and asks "Are you sure?" before abandoning. This prevents accidental loss of run progress.
- Abandon clears the save; FSRS progress is kept but run rewards are lost

**Save cleared on:** run end (victory, defeat, retreat, abandon)

### Campfire Pause Screen

A cozy pause screen accessible via a pause button (top-right corner, CSS pseudo-element bars icon) during combat and the dungeon map.

**Displays:** Floor number, HP, deck size, relics collected, accuracy percentage.

**Actions:**
- **Resume Run** — returns to the previous screen
- **Return to Hub** — saves run state and goes to hub (player can resume later)

### Special Events (Post-Boss)

After defeating a boss, the player receives a card reward and then faces a special event before the retreat-or-delve checkpoint.

| Event | Effect |
|-------|--------|
| Relic Forge | Choose 1 of 3 relics from eligible pool |
| Card Transform | Upgrade one card mechanic to next tier |
| Deck Thin | Remove up to 2 cards from your deck |
| Knowledge Spring | All facts answered correctly this run gain +1 day FSRS stability |
| Mystery Event | Random beneficial effect (heal 20 HP, gain 50 gold, or draw +1 card) |

Events are randomly selected from the pool after each boss fight.

---

## 8. Enemy Design

### Common

| Enemy | HP | Damage | Behavior |
|-------|-----|--------|----------|
| Cave Bat | 19 | 11 (main), 15 (heavy) | Every turn. Teaches speed. |
| Crystal Golem | 38 | 12 every 2 turns | Gains block on off-turns via defend intent. Can charge for 25 dmg spike attack. |
| Toxic Spore | 15 | 10 + poison | Low HP, DOT. Teaches defensive play. |
| Shadow Mimic | 24 | 12, copies last card (4×3 flurry) | Punishes repetition. |

### Elites

| Enemy | HP | Special |
|-------|-----|---------|
| Ore Wyrm | 58 | Phase 2 doubles attack, can charge for 30 dmg spike. |
| Fossil Guardian | 45 | Immune to history domain |

### Mini-Bosses (Encounter 3 on non-boss floors)

| Enemy | HP | Damage | Behavior |
|-------|-----|--------|----------|
| Crystal Guardian | 52 | 11 | Golem variant, gains block per turn |
| Venomfang | 45 | 10 | Spider, applies poison on attack |
| Stone Sentinel | 60 | 10 | Tanky — low attack, high HP. Can charge for 28 dmg spike. |
| Ember Drake | 48 | 10/13 | Glass cannon — 10 (fire breath), 13 (inferno blast) |
| Shade Stalker | 42 | 11 | Copies player's last played card type |
| Bone Collector | 54 | 10 | Heals 5 HP when player answers wrong |

### Bosses (Every 3rd floor — Randomized Per Region)

Boss selection is **randomized per region** using the seeded RNG. Each boss floor draws from its segment's pool of 2 bosses. Both bosses in a pool can appear in the same run.

**Shallow Depths pool (floors 3 and 6):**

| Boss | HP | Pattern |
|------|----|---------|
| The Excavator | 70 | 12 damage, phase 2 at 40% HP, escalating. Phase 2 can charge for 35 dmg spike. |
| Magma Core | 75 | 8 + poison, phase 2 volcanic blast buffed at 40% HP |

**Deep Caverns pool (floors 9 and 12):**

| Boss | HP | Pattern |
|------|----|---------|
| The Archivist | 85 | 7 + shuffles hand, phase 2 at 50% HP |
| Crystal Warden | 90 | 12 damage, status immunity, counter + heal |

**The Abyss pool (floors 15 and 18):**

| Boss | HP | Pattern |
|------|----|---------|
| Shadow Hydra | 110 | 14 damage, phase 2 at 50% HP doubles attacks |
| Void Weaver | 140 | 18 damage, hand disruption, Void Storm multi-attack, debuffs |

**The Archive pool (floors 21 and 24):**

| Boss | HP | Pattern |
|------|----|---------|
| Knowledge Golem | 120 | 17 damage, +5 bonus on wrong answers. Can charge for 32 dmg spike. |
| The Curator | 140 | 18 damage, all mechanics, phase 2 nerfed at 40% HP (final boss) |

Floor scaling: HP and damage +15% per depth segment. Player: 100 HP start and max, 0 block (resets each turn).

**Floor-based enemy damage scaling (AR-31, AR-32):** Enemy attack damage is multiplied by a floor-dependent factor via `getFloorDamageScaling(floor)` in `enemyManager.ts`:
- Floors 1-3: 0.85x (reduced damage for onboarding)
- Floors 4-6: 1.0x (baseline)
- Floors 7+: +4% per floor above 6 (e.g., floor 10 = 1.16x) — controlled by `FLOOR_DAMAGE_SCALING_PER_FLOOR` in `balance.ts`

**Post-encounter healing (AR-31, AR-32):** After each non-defeat encounter, the player heals 6% of max HP (`POST_ENCOUNTER_HEAL_PCT` in `balance.ts`). In Relaxed Mode, an additional 6% is added (12% total, via `RELAXED_POST_ENCOUNTER_HEAL_BONUS`). Boss and mini-boss encounters grant a further 15% bonus healing (`POST_BOSS_ENCOUNTER_HEAL_BONUS`), for 21% normal / 27% Relaxed Mode after boss fights.

**Per-turn enemy damage cap (AR-32):** Enemy damage per turn is capped by segment via `ENEMY_TURN_DAMAGE_CAP` in `balance.ts`, applied in `executeEnemyIntent()`. This prevents spike deaths from high-strength buffed enemies:
- Segment 1 (floors 1-6): 30 damage cap
- Segment 2 (floors 7-12): 35 damage cap
- Segment 3 (floors 13-18): 45 damage cap
- Segment 4 (floors 19-24): 55 damage cap
- Endless (floors 25+): no cap

Segment mapping is handled by `getSegmentForFloor()` in `enemyManager.ts`.

**Charge Attacks:** Select enemies can prepare a high-damage attack via a two-turn sequence:
1. **Turn 1 — Charging intent:** Enemy uses a "Charging" action that deals 0 damage and telegraphs `"Charging: [attack name]!"` on the next turn's intent panel.
2. **Turn 2 — Automatic release:** The telegraphed attack automatically fires, applying the charged damage value **without any damage cap applied** — charged attacks always penetrate segment caps. Charged damage is still modified by enemy strength status effects and floor damage scaling.
3. **Strategy impact:** The 0-damage charging turn gives the player a free turn to build resources (draw bonus cards, apply status effects, heal via passives) before the spike. Creates dramatic tension and recoverable "close call" moments.

**Charge intent design:** Typically 1.2–1.4x a standard attack for that enemy at that floor level. Crystal Golem charges 25 dmg (vs typical 12), Ore Wyrm phase 2 charges 30 dmg (vs typical 14), Stone Sentinel charges 28 dmg (vs typical 10). Selected enemies get 1–2 charge intents in their intent pools to ensure rarity without trivializing the mechanic.

**Early mini-boss HP reduction (AR-31, AR-32):** Mini-bosses on floors 1-3 have their HP multiplied by 0.60x (`EARLY_MINI_BOSS_HP_MULTIPLIER` in `balance.ts`), making them less punishing during early progression.

---

## 9. Knowledge Combo

| Consecutive Correct | Multiplier | Visual | Bonus |
|--------------------|------------|--------|-------|
| 0-1 (base) | 1.0x | Normal | — |
| 2nd | 1.15x | Slight glow | — |
| 3rd | 1.30x | Particle ring | — |
| 4th | 1.50x | Screen edge pulse | — |
| 5th | 1.75x | Bright flash | — |
| 6th+ | 2.00x | Full celebration burst | +1 HP heal per correct answer (capped at max HP) |

Resets on wrong answer. Persists across turns within encounter. With 3 AP, perfect turn = 3/3. Six consecutive across 2 turns = 2.0x multiplier plus 1 HP heal.

**Combo Heal:** At 6+ consecutive correct answers, the player heals 1 HP per correct answer (afterwards). Healing caps at max HP. This rewards sustained accuracy with a survival bonus, creating a powerful incentive to maintain streaks.

**UI Display:** Card hand displays effective (post-multiplier) card values in green with a glow effect when combo multiplier > 1, so players can always see what their card will actually do after combo scaling applies.

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

All players play on Normal difficulty. Difficulty selection is currently disabled in Settings.

| Internal ID | Display Name | Timer | Wrong Penalty | Enemy Dmg | Reward Multiplier |
|-------------|-------------|-------|--------------|-----------|-------------------|
| normal | Normal | Dynamic (floor + question length) | Fizzle + costs 1 AP | Normal | 1.00x |

*Note: Relaxed mode (no timer, reduced penalties) exists in the codebase but is hidden from the UI. `STORY_MODE_FORCED_RUNS` is set to 0 and all forced-difficulty code defaults to Normal.*

### Wrong Answer AP Cost (All Modes)

**Wrong answers ALWAYS deduct 1 AP, even in relaxed mode.** Previously, relaxed mode refunded the AP cost on wrong answers. This was removed to preserve the core economy constraint: every card play commits an action point regardless of outcome. The card still fizzles (no combat effect) in relaxed mode, but the AP is consumed. This ensures that wrong answers have a real cost in all modes and prevents relaxed mode from trivializing resource management.

**Reward multipliers** are applied at run end via `DIFFICULTY_REWARD_MULTIPLIER` in `balance.ts`. Normal mode earns standard rewards (1.00x multiplier).

### Slow Reader Option

Adds flat +3 seconds to all timers. Timer bar color changes from red to amber (less stressful). Preserves urgency without panic. NOT Story Mode (which removes timers entirely). Can be changed in Settings anytime. (Previously asked during onboarding; now set exclusively in the Settings panel.)

### Tier-Based Card Power (AR-54)

Card power scales with mastery tier — learning makes cards stronger, never weaker. The old ease-based system (EASE_POWER) was removed because it created a perverse incentive where struggling = more power and mastery = less power.

| Tier | Display | Power | Quiz Format |
|------|---------|-------|-------------|
| 1 | Learning | 1.0x | 3-option MCQ, generous timer |
| 2a | Proven | 1.3x | 4-option MCQ or reverse |
| 2b | Proven | 1.6x | 5-option close distractors or fill-blank |
| 3 | Mastered | 1.6x (permanent) | Not asked — earns Mastery Coin |

**Design rationale:** Players who learn get stronger decks. Challenge at higher tiers comes from harder quiz formats (more options, fill-blank, reverse), not from weaker cards. This aligns gameplay incentives with educational goals — there is never a reason to deliberately get answers wrong.

### Learning Threshold Reward Gate

Players can play any content they want — no limitations. But camp/meta-progression rewards are disabled when the system detects the run wasn't a genuine learning experience.

**Philosophy:** "Play whatever you want. Learn whatever you want. But you can't grind mastered content for camp rewards."

**Detection signals (any one triggers practice run mode):**

| Signal | Threshold | When Checked |
|--------|-----------|-------------|
| Pool mastery > 75% | Tier 2b+ facts exceed 75% of pool | Run start |
| Overall accuracy > 85% | All facts answered during run | Run end |
| Novel fact accuracy > 80% | Tier 1 (new/unseen) facts, min 3 answered | Run end |
| Perfect run | Zero wrong answers, 5+ questions | Run end |

**What gets disabled:**
- Dust (camp currency)
- Relic shards
- Any persistent progression rewards

**What still works:**
- SM-2 spaced repetition updates (learning always counts)
- In-run gold and card rewards (already consumed during play)
- Run stats display (accuracy, floors, cards played)

**Player feedback:**
- Pre-run: "Practice Run — Camp rewards disabled" banner shown during combat if pool mastery > 75%
- Post-run: Informative message on RunEndScreen — neutral tone, suggests trying a less familiar domain

**Implementation:** `isPracticeRun()` in `masteryScalingService.ts`, accuracy counters in `RunState`, reward zeroing in `endRun()`.

---

## 11. Echo Mechanic

When a fact is answered wrong during a run, 85% chance it reappears later as an "Echo" card.

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
| Relic Archive | 50 relics unlocked via Mastery Coins, collected in runs (Section 6) |
| Card Cosmetics | Milestone rewards; monetizable |
| Domain Unlocking | Master 25 facts → new domain |
| Streaks | Daily completion; 7d→card frame, 30d→mastery coins, 100d→exclusive cosmetic, 365d→legendary. 1 freeze/week. |
| Lore Discovery | At 10/25/50/100 mastered facts: narrative connecting learned facts (see Section 13a) |
| Bounty Quests | 1-2 bonus objectives per run (see Section 13b) |

No overworld, no farming/crafting, no prestige, no stamina. Study presets (§26b) allow topic selection but are not a standalone study mode.

### 13a. Lore Discovery System

Mastery milestones (10th, 25th, 50th, 100th mastered fact) unlock a Lore Fragment — a short, fascinating narrative connecting multiple facts the player has learned.

**Example:** After mastering 10 Chemistry facts: "The Alchemist's Dream — For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce."

**Why this works:** Elaborative encoding (Pressley et al., 1987) — connecting isolated facts into narrative improves long-term retention by 40-60%.

**Presentation:** Full-screen, pixel art illustration, atmospheric sound, "Share" button. These are the TikTok moments — shareable, collectible, motivating.

### 13b. Bounty Quest Examples

1-2 randomly selected per run, visible at start:

- "Arcane Surge: Answer 5 Science facts correctly" → +1 card reward at next shop
- "Flawless Descent: Complete 3 encounters without wrong answers" → Mastery Coins
- "Deep Delve: Reach Floor 6" → 50% extra currency
- "Speed Caster: Answer 10 facts in under 3 seconds each" → Card upgrade token
- "Scholar's Path: Play cards from 4 different domains in one run" → Domain preview unlock
- "Perfect Form: Perfect turn (3/3 correct) at least once" → Cosmetic card frame

---

## 14. Onboarding (First 60 Seconds)

Research: Mobile users decide to keep an app within 7-30 seconds. Duolingo delays signup until AFTER the first lesson. Vampire Survivors has players killing enemies in 3 seconds.

```
0-3s:   Dungeon entrance. "ENTER THE DEPTHS" button.
3-10s:  First encounter (Story Mode forced for Run 1). Hand of 5. Tooltip: "Tap a card to examine it"
10-14s: Card rises with info overlay. Tooltip: "Tap again or swipe up to cast"
14-20s: Question panel appears above hand. Correct → juice stack. Wrong → gentle fizzle.
20-35s: Remaining AP. End Turn tooltip.
35-60s: Second encounter. Minimal tooltips.
~2-3m:  Run ends. "Create account to save progress?" (skippable).
Run 2:  Study Mode selector unlocks on hub (dropdown near dungeon gate: All Topics, Build New Deck, etc.).
Run 4:  Archetype selection unlocks (runs 1-3 auto-assign 'Balanced').
```

First encounter: 2 AP. Full 3 AP from encounter 3.

### Calibration Deep Scan — Design Status: RESOLVED (Option B)

**Selected approach: Gameplay-Inferred Calibration (accelerated FSRS gains during early runs 1-3).**

#### The Problem: Bored Expert / Cold Start

A player who already knows 80% of general-knowledge facts will spend their first 2-3 runs answering trivially easy Tier 1 questions. Every card is weak (Tier 1 = lowest power), combat feels like busywork, and the player may churn before the system catches up. This is the classic spaced-repetition cold-start problem — the scheduler has no prior data and must assume everything is new.

The inverse problem also matters: a player who knows very little gets overwhelmed by too many wrong answers early, feels dumb, and churns. The Canary system (§21) handles this side via invisible difficulty reduction, but the cold-start calibration question applies to both directions.

#### Solution: Accelerated FSRS During Early Runs

Instead of a separate placement test (immersion-breaking) or accepting slow calibration, FSRS gains are boosted during runs 1-3. This allows the system to calibrate 2-3x faster from normal gameplay without breaking immersion.

**Mechanics:**

1. **Correct + Fast Response (Runs 1-3 only):** Answer a question correctly AND within 50% of the allotted timer → count as 2 consecutive correct answers instead of 1. This doubled stability gain accelerates promotion to Tier 2a (2d+ stability).

2. **Run Accuracy Bonus (Runs 1-3):** Achieve 80%+ accuracy across the entire run → all correctly-answered facts receive a flat stability bonus of +2 days. This ensures even medium-difficulty facts tier up faster if the player demonstrates broad knowledge.

3. **First-Encounter Stability Boost:** First time a new fact is answered correctly → start FSRS stability at 2 days instead of default 1 day. Makes one successful answer meaningful rather than requiring multiple correct answers to show progress.

4. **Domain-Specific Acceleration (Domain Unlock at Run 2):** When a player selects a new domain for the first time (starting at Run 2), the first run in that domain applies all three accelerated gains.

**Why This Works:**
- Zero immersion break — the dungeon IS the placement test
- No skip problem (gains are invisible, baked into normal play)
- Works for every domain, not just the first
- No new UI screens required
- Still requires 2-3 runs to fully calibrate (faster, not instant), which matches the game's "shallow floors are easier" narrative

**Note on Convergence:** If early-run playtesting reveals convergence is still too slow (e.g., Tier 1 cards vs early enemies feels too weak even with accelerated gains), Option C (in-run domain probe with narrative framing) can be implemented as a fallback without architectural changes.

### Run-Start Archetype Selection — Deck Strategy Layer

**Availability:** Unlocks at Run 4 (after 3 completed runs). During runs 1-3, the archetype selection screen is skipped and 'Balanced' is automatically assigned. This reduces cognitive load during onboarding — new players focus on learning combat basics before making strategic deck choices. Controlled by `ARCHETYPE_UNLOCK_RUNS` in `balance.ts`. At run start, before the first encounter, players select a preferred **Deck Archetype Bias**. This is a SOFT preference, not a hard constraint.

**Archetype Options:**

| Archetype | Description | Card Type Bias | Play Feel |
|-----------|-------------|-----------------|-----------|
| Balanced | Equal distribution across all types (default) | Even across all types | Flexible, adaptable |
| Aggressive | Prioritizes damage output and tempo | +3 Attack, +2 Buff, -2 Shield, -2 Heal | Fast, offensive |
| Defensive | Prioritizes survival and damage mitigation | +3 Shield, +2 Heal, -2 Attack, -2 Debuff | Durable, reactive |
| Control | Prioritizes disruption and enemy manipulation | +3 Debuff, +2 Utility, -2 Attack, -1 Heal | Strategic, puzzle-like |
| Hybrid | Custom blend (pick 2-3 preferred types) | Player-selected weighting | Highly personalized |

**How It Works:**

1. Player selects an archetype at run start (simple UI: 5 icons, select 1, or "Custom" for Hybrid)
2. This archetype is stored as a soft preference for the run
3. When the 3 card TYPE options appear after each encounter, they are weighted toward the chosen archetype, but NOT exclusively
4. Example: If "Aggressive" is chosen, the reward screen might show [Attack, Attack, Buff] most of the time, but occasionally show other types (Shield, Heal, Debuff) to avoid forced homogeneity

**Why This Matters:**

- **Deck identity:** Players can now say "I'm playing an Aggressive deck" and feel agency over their build
- **Educational coverage preserved:** Even though types are weighted, facts are still randomly assigned regardless of type choice. A player building all-Attack still sees diverse subjects.
- **Replayability:** Choosing a different archetype creates a different run experience without changing the underlying learning content
- **Progressive strategy depth:** New players can pick "Balanced" and learn the game. Experienced players can commit to "Defensive" and optimize around durability passives (Iron Skin, Retaliation, Fortress)

**Fallback:** If a player wants to override the archetype preference mid-run, they can always pick whatever type is offered. The archetype is a suggestion, not a lock.

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

**Top 55% (Display):** Enemy sprite, enemy HP bar, enemy name header (color-coded by category). No interactives. Top-third tap accuracy: 61%. Phaser renders the enemy sprite and HP bars; Svelte overlay renders the enemy name header, intent panel, floor info, and bounty strip.

**Bottom 45% (Interaction):** Card hand, answer buttons, hint, End Turn, player HP bar (at 88% Y), relic tray (at 92% Y, horizontal scroll), bounty strip (bottom-right, above End Turn). Bottom-third accuracy: 96%.

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
| In hand | `min(18vw, 85px)` width, 1.5:1 aspect ratio | Mechanic, value, stars, domain tint, AP cost badge (blue circle top-right). Green glow if playable. 30° total fan spread, 20px max arc offset. Mouse hover: +18px lift, 1.15x scale. |
| Dragging | Same card, follows pointer | Lifts and scales (up to 1.3x). Info overlay at 40px drag. Green glow at 60px (cast threshold). Opacity fades with distance. |
| Selected | Same card, rises 80px | Info overlay: mechanic name, effect, "Tap or Swipe Up". Non-selected cards dim. |
| Committed | Question panel above hand | `position: fixed; bottom: calc(45vh - 20px)`. Selected card drops back into hand. Question, answers, timer, hint. No overlap with card hand. |

### AP Display

3 gem icons below hand. Lit = available, dim = spent.

### Enemy Name Header

Color-coded enemy name displayed in the Svelte combat overlay at 38vh (centered, 18px bold, text-shadow). Color indicates enemy category:

| Category | Color |
|----------|-------|
| Common | `#9ca3af` (gray) |
| Elite | `#60a5fa` (blue) |
| Mini-boss | `#a78bfa` (purple) |
| Boss | `#fbbf24` (gold) |

Data sourced from `turnState.enemy.template.category` (derived `enemyCategory`).

### Enemy Intent Display

**Simplified Panel:** Color-coded intent button shown in Svelte combat overlay at the top center of the screen. Each intent type has a distinct background color for instant readability. The panel displays only the telegraph name (e.g., "Venom Bite") and the numeric value (e.g., damage or block amount). No floor info or type label in the main panel.

| Intent | Background | Icon | Label |
|--------|-----------|------|-------|
| Attack | Red | ⚔️ | ATTACK |
| Multi-attack | Red | ⚔️⚔️ | ATTACK |
| Defend | Blue | 🛡️ | DEFEND |
| Buff | Gold | 💪 | BUFF |
| Debuff | Purple | 🔮 | DEBUFF |
| Heal | Green | 💚 | HEAL |

- **Panel structure**: Icon + telegraph name + numeric value (e.g., "⚔️ Toxic Cloud 2")
- **Interactive**: The intent panel is a tappable button
- **Detail popup**: Tapping the panel opens a centered modal overlay with full breakdown of the intent:
  - Header: Icon + intent name
  - Body: Human-readable description (e.g., "Deals 15 damage", "Applies 2 poison for 3 turns", "Hits 3 times for 5 damage each")
  - Dismiss: Tap anywhere outside the popup or the close button
- **Visibility**: Hidden during quiz (committed stage) to reduce visual noise during answer selection
- **Data sourced from**: `turnState.enemy.nextIntent` (pre-rolled by enemyManager)
- **Component**: `CardCombatOverlay.svelte` lines 130 (state), 896–930 (panel + popup HTML), 1117–1290 (CSS)

### Enemy Block (Shield) System

Enemies can gain block via defend intents, following STS conventions:

- **Gaining block:** When an enemy executes a defend intent, `enemy.block += intent.value`.
- **Absorbing damage:** Player damage hits block first. Blocked damage is subtracted from block; remaining damage hits HP.
- **Block decay:** Enemy block resets to 0 at the START of each enemy turn (before the enemy acts). Block gained from defend lasts through the entire player turn, then clears when the enemy acts again.
- **Visual display:** Blue semi-transparent bar overlays the enemy HP bar when block > 0. Shield icon and block amount shown to the left of the HP bar. HP bar fill turns blue while block is active, returns to red when block is depleted.
- **Data:** `EnemyInstance.block` field (number, default 0). Managed by `enemyManager.applyDamageToEnemy()` and `turnManager.endPlayerTurn()`.

### End Turn Button

Simplified display: shows "END TURN" only (no AP count). Turns gold with pulsing glow when no actions remain (0 AP or no playable cards). Confirmation popup when tapping End Turn with AP remaining and playable cards available.

### First-Person Dungeon Perspective

Combat and room exploration use a first-person viewpoint — the player character is not visible in dungeon scenes.

**Combat framing:**
- Upper ~55% of screen: first-person view of the room with the enemy/boss looming large, facing the player directly
- Lower ~45%: card hand and interaction area (unchanged)
- Enemy sprite sizes (Phaser): Common 200px, Elite 250px, Boss 300px. Enemy Y position at 35% of scene height.
- Player HP bar at 88% Y, relic tray at 92% Y (both near bottom of display zone, above interaction area)
- Boss encounters use even larger sprites with a dramatic zoom-in on room entry

**Phaser vs Svelte rendering split:**
- **Phaser (CombatScene):** Enemy sprite, enemy HP bar (with block overlay), hit/death animations, damage particles, screen flash
- **Svelte overlay (CardCombatOverlay):** Enemy name header (color-coded), intent panel, floor info, bounty strip (bottom-right above End Turn), card hand, answer buttons, combo counter, damage numbers

**Room transitions:**
- Entering a new room triggers a fade-in from black (~400ms) for pacing and atmosphere
- Door/room selection presented as a first-person hallway with 2-3 visible doorways to choose from

#### Instant Screen Loading

All screens preload their background images behind a transition overlay before revealing content. Players see a brief loading animation (pulsing dots), then the fully-loaded screen appears instantly with no visible asset pop-in. This applies to all screens: camp hub, room selection, combat, rest sites, shops, mystery events, rewards, retreat/delve, and run end.

**Player character visibility:**
- NOT visible during dungeon crawl (first-person)
- Visible at the camp hub between runs (third-person camp scene)

---

## 17. Game Juice

### Why Juice Matters

Research on operant conditioning: intensity of positive reinforcement directly correlates with behavior repetition rate. Correct answers create a dopamine loop tied to fact recall. Vampire Survivors creator explicitly referenced gambling psychology. Players WITH sound retain at 1.5-2x rate (mobile game postmortem data).

### Card Play Animation Sequence (Post-Answer)

After answering a quiz, the played card goes through a multi-phase CSS animation sequence orchestrated by `CardCombatOverlay.svelte`. Cards are copied to an `animatingCards` buffer before logical removal from the hand, so exit-animating cards remain visible via a separate non-interactive `{#each}` loop.

**Correct answer — with cardback art** (total ~1200ms):

| Phase | Duration | What happens |
|-------|----------|--------------|
| Reveal | 400ms | Card enlarges to ~1.8x, centers on screen, flips via CSS 3D `rotateY(180deg)` to show unique cardback art (WebP from `/public/assets/cardbacks/lowres/`) |
| Mechanic | 500ms | Mechanic-specific CSS animation plays on the revealed face (slash, glow, ripple, etc.). Juice effects (haptics, damage numbers, particles) fire during this phase |
| Launch | 300ms | Card flies upward (`translateY(-120vh)`) and is removed from the DOM |

**Correct answer — no cardback art** (total ~800ms): Skip flip, mechanic animation plays on card front, then launch.

**Wrong answer** (total ~400ms): Fizzle animation — card shakes and fades out. No flip, no mechanic animation.

**`prefers-reduced-motion`**: Simplified fade + color flash replaces flip and mechanic animations.

Card DOM uses dual-face structure: front and back containers with `backface-visibility: hidden` and a shared `transform-style: preserve-3d` wrapper. Cardback availability is checked at runtime via `cardbackManifest.ts` (`import.meta.glob` build-time discovery).

Animation state machine: `CardAnimPhase = 'reveal' | 'mechanic' | 'launch' | 'fizzle' | null`

### 31 Mechanic-Specific Animations

Each card mechanic has a unique CSS `@keyframes` animation that plays during the mechanic phase. Defined in `mechanicAnimations.ts`, rendered in `CardHand.svelte`.

| Type | Mechanic | Animation |
|------|----------|-----------|
| Attack (red) | strike | Diagonal slash |
| Attack | multi_hit | 3 staggered slashes |
| Attack | heavy_strike | Crush + shake |
| Attack | piercing | Center point glow |
| Attack | reckless | Flame border + shake |
| Attack | execute | Crosshair + pulse |
| Shield (blue) | block | Crystal border |
| Shield | thorns | Shimmer + spikes |
| Shield | fortify | Ring pulses |
| Shield | parry | Diagonal streak |
| Shield | brace | Thick metallic border |
| Heal (green) | restore | Green glow pulse |
| Heal | cleanse | Rising sparkles |
| Heal | overheal | Green-blue gradient |
| Heal | lifetap | Red-to-green sweep |
| Buff (gold) | empower | Golden streaks up |
| Buff | quicken | Lightning flash |
| Buff | double_strike | Twin arcs |
| Buff | focus | Contracting rings |
| Debuff (purple) | weaken | Dark ripple |
| Debuff | expose | Crack lines |
| Debuff | slow | Clock sweep |
| Debuff | hex | Poison drip |
| Utility (teal) | scout | Eye blink |
| Utility | recycle | Circular arrow |
| Utility | foresight | Card fan |
| Utility | transmute | Hue-rotate |
| Regen (nature) | sustained | Heartbeat pulse |
| Regen | emergency | Red-green flash |
| Regen | immunity | Golden bubble |
| Wild (rainbow) | mirror | Chrome sweep |
| Wild | adapt | Border morph |
| Wild | overclock | Electric flashes |

### Correct Answer Juice Stack (fires during mechanic phase)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Sharp pulse: `Haptics.impact({ style: ImpactStyle.Heavy })` |
| 2 | Flash | White 30%, 150ms fade |
| 3 | Numbers | Arc to enemy, bounce; gold=normal, red=crit (speed bonus) |
| 4 | Card | Mechanic animation → launch + streak trail toward enemy |
| 5 | Enemy | 5px knockback, red flash, smooth HP drain |
| 6 | Sound | Crisp impact (Wordle ding x fighting game punch) |
| 7 | Combo | Escalating text + particles at 3+, burst at 5 |

**CombatParticleSystem (A2):** Multi-emitter particle manager powering all Phaser-side VFX. Uses 4 procedural textures (4x4 square, 6px circle, 4px diamond, 2x8 streak) generated at runtime. Methods: `burstImpact()`, `burstDirectional()`, `comboMilestone()`, `tierUpCascade()`, `enemyDeathAsh()`, `goldCoinShower()`, `statusEffect()`, `startAmbient()`, `stopAmbient()`, `rewardReveal()`. Particle budgets from QualityPreset: low=40, mid=80, flagship=150 total particles.

### wowFactor Display (Learning Tier Only)

After a correct answer on a **Learning-tier (Tier 1)** card, if the fact has a `wowFactor` string, a brief overlay displays it for 2.5 seconds. This surfaces the "mind-blowing restatement" generated by the content pipeline (see §25) at the moment of peak engagement — right after a correct answer.

**Rules:**
- Only fires for Tier 1 cards (Learning) — players seeing a fact for the first few times benefit most from elaborative framing
- Maximum 3 wowFactor displays per encounter (prevents fatigue)
- 200ms fade-in, 300ms fade-out animation
- Overlay appears below the question area, styled as semi-transparent dark panel with amber accent
- Counter resets each encounter (tracked per turn-1 reset)

### Wrong Answer (muted)

| # | Element | Detail |
|---|---------|--------|
| 1 | Haptic | Gentle double-tap: `Haptics.notification({ type: NotificationType.Warning })` |
| 2 | Card | Fizzle: shake + fade out (400ms) |
| 3 | Reveal | Blue highlight, 2s |
| 4 | Sound | Soft low tone (not a buzzer) |
| 5 | AP gem | Dim + crack |
| 6 | Absence | No shake, no red flash, no damage numbers, no flip |

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
| Motor | Tap only, 48dp+ targets, no timer in Story Mode, Slow Reader option |
| Cognitive | Story Mode soft fail, hints, numeric+icon indicators, 6th-grade reading level |

---

## 20. Daily Expedition

Same seed all players. Score = accuracy x speed x depth x combo. One attempt/day. Leaderboard (read-only). Rewards: participation badge, bonus for top 10%/25%/50%.

Why critical: Wordle's entire viral success = one-a-day appointment. STS daily climb = most-played mode. "Did you beat today's Expedition?" = organic marketing.

### Implementation Status (March 10, 2026)

- Daily runs now submit to backend leaderboard category `daily_expedition` with `metadata.dateKey` (`YYYY-MM-DD`).
- Backend enforces one Daily submission per user per date key.
- Daily leaderboard API supports date-key filtering so rankings are scoped to the current daily seed cycle.
- Endless mode submits to separate backend category `endless_depths` and keeps local fallback rows for offline/unauthenticated sessions.

---

## 21. Canary System (Invisible Adaptive Difficulty)

Graduated assist tiers based on performance within a floor:

- **Deep Assist** (5+ wrong answers): 0.65x enemy damage, -2s timer, easier facts
- **Assist** (3+ wrong answers): 0.80x enemy damage, -1s timer, modestly easier facts
- **Neutral** (baseline): 1.0x enemy damage, standard timer, standard fact difficulty
- **Challenge** (5+ correct streak): 1.1x enemy damage, tighter speed bonus, harder facts, elite variants

Invisible. Never announced. Never reduces educational rigor (answer count, format unchanged). Only game difficulty flexes. Graduated tiers smooth the cold-start onboarding and protect against engagement collapse from frustration. Research: Hunicke (2005) — invisible DDA preserves flow state.

---

## 21.5. Japanese Language Decks (JLPT N5–N1)

**Data sources:** Full-Japanese-Study-Deck (GitHub) + JMdict (215,611 entries)

Japanese language learning integrates 4 specialized subdecks totaling **13,073 facts** across JLPT proficiency levels (N5 beginner → N1 expert). Players select Japanese as a study domain at run start (`StudyModeSelector`), and the run pool builder routes them to Japanese facts via language-specific domain resolution.

**Korean** (11,400 facts) and **Chinese** (13,472 facts) also have grammar decks alongside vocabulary, generated from hanabira.org (MIT license). See Architecture doc section 13.5 for the full breakdown across all 8 languages (108,950 total language facts).

### Vocabulary Subdeck (7,726 facts)

JLPT level distribution:
- **N5** (beginner): 822 facts
- **N4** (intermediate-low): 774 facts
- **N3** (intermediate): 3,347 facts
- **N2** (advanced): 1,242 facts
- **N1** (master): 3,828 facts

Quiz format (Tier 1): "What does '食べる' (たべる) mean in English?" with furigana ruby annotations above kanji. Answers: [to eat / to drink / to see].

Tier 2 reverse: "How do you say 'to eat' in Japanese?" Answers: [食べる / 飲む / 見る].

### Kanji Subdeck (2,096 facts)

Radical-based kanji learning with JLPT distribution:
- **N5**: 79 facts
- **N4**: 164 facts
- **N3**: 546 facts
- **N2**: 189 facts
- **N1**: 1,118 facts

Quiz format (Tier 1): "What does the kanji '日' mean?" Answers: [sun/day / moon / fire].

Includes mnemonic explanation (e.g., "日 (square shape) = sun in enclosed space"). Tier 2 reverse: "Write the kanji for 'sun'" (production mode).

### Grammar Subdeck (644 facts)

Grammatical patterns with 6 JLPT levels:
- **N5**: 16 facts
- **N4**: 32 facts
- **N3**: 142 facts
- **N2**: 252 facts
- **N1**: 144 facts
- **Additional**: 58 facts (non-level-specific)

Quiz format (Tier 1): "What does the grammar pattern '〜が' mean?" Answers: [marks the subject / indicates possession / marks an object].

Includes usage examples and sentence context.

### Kana Subdeck (416 facts)

Hiragana and katakana recognition with pre-generated distractors using visually similar kana pairs (e.g., あ/お, ソ/ン, シ/ツ). Two subcategories:
- **`japanese_hiragana`**: 208 facts (basic + dakuten + compound hiragana)
- **`japanese_katakana`**: 208 facts (basic + dakuten + compound katakana)

Distractors are curated hand-matched pairs based on visual similarity rather than random pool selection, ensuring distractors are genuinely confusable and pedagogically useful.

Quiz format (Tier 1): "What is the romaji reading for 'あ'?" Answers: [a / i / u].

Reverse Tier 2: "Write the hiragana for 'a'".

### Display Options Panel (`DeckOptionsPanel.svelte`)

Language-specific settings accessible from **Knowledge Library** screen via a gear icon.

**Current Japanese toggles** (extensible via `LanguageDeckOption` interface):
- **Furigana display** (default: ON) — shows ruby annotations (phonetic guide) above kanji
- **Romaji display** (default: OFF) — displays romanized Japanese alongside native script

Settings persisted in localStorage (`card:deckOptions`), keyed by `targetLanguage`.

### Implementation Files

**Services:**
- `src/services/deckOptionsService.ts` — Persisted store for language-specific display options (furigana, romaji toggles). Exports `getDeckOptions(language)`, `setDeckOption(language, key, value)`, `toggleDeckOption(language, key)`.

**UI Components:**
- `src/ui/FuriganaText.svelte` — Ruby annotation component. Accepts `text: string` (kanji) and `furigana: string[]` (phonetic readings). Renders HTML `<ruby>` tags for mobile accessibility.
- `src/ui/DeckOptionsPanel.svelte` — Modal toggle UI for language-specific options. Dispatches `options-changed` event on change.
- Modified `src/ui/components/CardExpanded.svelte` — Reads deck options store; conditionally renders furigana/romaji based on toggle state.

**Data Types:**
- `src/types/vocabulary.ts` — Updated with:
  - `LanguageDeckOption` interface: `{ key: string; value: boolean; label: string; }`
  - `LanguageConfig` extended with `subdecks: Subdeck[]` and `options: LanguageDeckOption[]`

**Content Pipeline:**
- `scripts/content-pipeline/vocab/extract-fjsd-japanese.mjs` — Extracts 13,073 Japanese facts from Full-Japanese-Study-Deck repo (vocab IDs, kanji-info, grammar, kana) and JMdict (meaning lookups). Outputs to `data/raw/japanese/{vocabulary,kanji,grammar,kana}.json`.
- `scripts/content-pipeline/vocab/merge-japanese-facts.mjs` — Merges extracted facts per subdeck into `src/data/seed/facts-generated.json` with proper schema (targetLanguage, subdeck, jlptLevel, visualization_description for card backs).

### Data Sources

**Files:**
- `data/references/full-japanese-study-deck/` — Cloned FJSD repo with structured JLPT vocab IDs, kanji-info.json (radical mappings), grammar.json, and kana.json.
- `data/references/jmdict/jmdict-eng.json` — JMdict English dictionary (215,611 entries, CC-BY-SA 4.0).
- `data/raw/japanese/` — Extracted facts per subdeck and JLPT level.

### Data Flow

```
FJSD repo (vocab IDs, kanji-info, grammar, kana)
+ JMdict (meanings)
  ↓
extract-fjsd-japanese.mjs
  → data/raw/japanese/vocabulary.json
  → data/raw/japanese/kanji.json
  → data/raw/japanese/grammar.json
  → data/raw/japanese/kana.json
  ↓
merge-japanese-facts.mjs
  → src/data/seed/facts-generated.json (appended)
  ↓
build-facts-db.mjs
  → public/facts.db (13,073 Japanese facts indexed)
  → seed-pack.json (includes Japanese metadata)
```

### JLPT Level Gating (Future)

Reserve option: lock Tier 2+ cards to N3+ levels (e.g., N5 players see only N5-selected kanji in production challenges). Controlled via `requireMinJLPTForProduction = false` in `balance.ts` at launch.

---

## 21.6. Vocabulary Card System

### Card Structure
Each vocabulary card represents a word in one of 8 supported languages. Cards are created programmatically from open-source dictionary data — not LLM-generated.

### Required Fields Per Word
- `targetWord` — The word in the target language
- `englishTranslation` — English meaning (hub language)
- `reading` — Pronunciation guide (CJK only: pinyin, furigana, romanization)
- `partOfSpeech` — noun, verb, adjective, adverb, etc.
- `level` — Proficiency level (HSK / JLPT / TOPIK / CEFR)
- `frequencyRank` — Word frequency ranking (nice to have)

### Quiz Format
Players see one of four question types per vocab card:
1. **L2→L1 Meaning** (Tier 1, 3 options): "What does '猫' mean?" → [cat, dog, bird]
2. **L1→L2 Reverse** (Tier 2a, 4 options): "How do you say 'cat' in Chinese?" → [猫, 狗, 鸟, 鱼]
3. **Reading/CJK** (Tier 1, 3 options): "What is the reading of '猫'?" → [māo, gǒu, niǎo]
4. **Fill-blank** (Tier 2b, 5 options): "'___' means 'cat' in Chinese" → [猫, 狗, 鸟, 鱼, 马]

### Distractor Selection (Runtime)
Wrong answers are selected at runtime from the same-language vocabulary pool — NOT pre-generated by LLM:
- **POS match**: Same part of speech (nouns with nouns)
- **Level proximity**: Within ±1 level of the correct word
- **Semantic bins**: ~50 broad categories (animals, colors, food...) + ~200 narrow sub-categories
  - Easy difficulty → distractors from different bins
  - Medium difficulty → same broad bin, different sub-bin
  - Hard difficulty → same sub-bin (very tricky!)

### Difficulty Mapping
| HSK | JLPT | CEFR | Difficulty |
|-----|------|------|-----------|
| 1-2 | N5 | A1-A2 | 1 (Easy) |
| 3 | N4 | B1 | 2 (Medium) |
| 4 | N3 | B2 | 3 (Hard) |
| 5 | N2 | C1 | 4 (Expert) |
| 6-7 | N1 | C2 | 5 (Master) |

---

## 22. Language Learning Integration (Post-Launch)

**Status:** Language domains are hidden from the Study Mode Selector at launch (`ENABLE_LANGUAGE_DOMAINS = false` in `balance.ts`). Language content (Japanese N3-N5, etc.) exists in the facts database but is not selectable until the feature flag is enabled post-launch. This allows focus on knowledge domains for initial launch quality.

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

### Card Back Visual Descriptions — Language-Themed Requirement

Every fact and vocabulary card has a `visualDescription` field used as the prompt for pixel art card back generation (via ComfyUI + SDXL). These descriptions must follow strict rules:

**General Rules (all cards):**
- Describe a CONCRETE visual scene, not an abstract concept
- ONE clear focal subject embodying the fact/word meaning
- 20-40 words, vivid colors, dramatic lighting, pixel-art-friendly composition
- Subject fills 80% of frame with breathing room at edges
- No text, labels, numbers, UI elements, realistic human faces, political symbols, violence beyond fantasy, sexual content

**Language-Specific Theming (CRITICAL):**
Vocabulary card visuals MUST be culturally themed to the target language. This creates visual cohesion within a language pack and makes cards feel intentional rather than generic.

| Language | Visual Theme | Setting Examples | Style Notes |
|----------|-------------|-----------------|-------------|
| Japanese (ja) | Feudal Japan / Yokai folklore | Torii gates, bamboo forests, tatami rooms, castle towns, onsen, shrine paths, paper lanterns, zen gardens | Ukiyo-e color palette influence, cherry blossoms, moonlit scenes |
| Spanish (es) | Mediterranean / Latin American | Terracotta plazas, flamenco stages, agave fields, Aztec temples, jungle cenotes, haciendas | Warm sunset tones, vibrant reds/oranges/golds |
| French (fr) | Belle Époque / Provincial France | Cobblestone cafés, lavender fields, cathedral stained glass, misty bridges, vineyard hillsides | Soft pastels, romantic lighting, art nouveau touches |
| German (de) | Central European / Gothic | Half-timbered towns, Black Forest paths, clockwork workshops, medieval guild halls, Alpine passes | Dark greens, amber, mechanical/precise composition |
| Dutch (nl) | Dutch Golden Age / Lowlands | Windmills, tulip fields, canal houses, Delft blue pottery, trading ships, dike landscapes | Cool blues, warm oranges, clean geometric composition |
| Czech (cs) | Bohemian / Central European | Prague castle spires, medieval clock towers, forest trails through Bohemian hills, stained glass windows, cobblestone lanes, beer hall scenes | Rich amber, deep forest green, gothic architectural details |
| Korean (ko) | Joseon Dynasty / Modern Seoul | Hanok villages, palace courtyards, mountain temples, neon-lit streets, ceramic workshops | Bold primary colors, clean geometric composition |
| Mandarin (zh) | Imperial China / Wuxia | Misty mountain peaks, tea houses, silk roads, dragon murals, floating lantern festivals | Ink wash influence, jade/crimson/gold palette |

**Example — Japanese vocabulary:**
- Bad: "A hand reaching into a display of three glowing orbs" (generic fantasy, no cultural identity)
- Good: "A samurai kneeling in a moonlit zen garden, reaching toward a stone lantern with patient resolve" (for 我慢する — to endure/be patient)
- Good: "A merchant in a bustling Edo-period market carefully weighing golden coins on a wooden abacus" (for 計算する — to calculate)

**Example — Spanish vocabulary:**
- Good: "A matador gracefully dodging a charging bull in a sun-drenched arena, cape streaming behind" (for esquivar — to dodge)

**Anti-Patterns (NEVER do these):**
- Generic fantasy scenes with no cultural connection
- Literal translations of the word (e.g., "a person eating" for 食べる — too boring)
- Stereotypical/offensive cultural depictions
- Scenes that could apply to any language

**Source field requirement:** Every fact MUST have a `sourceName` field citing where the fact was verified. Wikipedia is preferred. Unverified facts must NOT enter production.

---

## 23. Monetization

Research: Vampire Survivors $57M+ on $5 premium. Duolingo $1B+ freemium subscription. Rewarded ads 76% player preference. Clash Royale 10x revenue from removing time gates.

| Offering | Price |
|----------|-------|
| Free | Full game, unlimited runs, all domains, community facts |
| Ad removal | $4.99 |
| Domain packs | $2.99 each |
| Language packs | $4.99 each |
| Arcane Pass | $4.99/mo (all packs, cosmetics, analytics, family 5x) |
| Cosmetics | Varies (frames, animations, dungeon skins, avatars) |

No pay-to-win. No premium currency. No gacha. Education (primary) + Games (secondary).

### Implementation Status (March 10, 2026)

- Ad-removal entitlement implemented as a one-time product (`$4.99`) with persisted local unlock state.
- Arcane Pass/Season Pass/Cosmetic Store are surfaced in-app from the social hub.
- Scholar Challenge is implemented as a weekly deterministic run mode with one-attempt-per-week reservation and cycle-scoped leaderboard submission (`weekKey`).
- Arcane Pass subscriber category filtering is implemented in run setup and applied by the run-pool builder.

### Subscriber Category Filtering (Implemented)

Arcane Pass subscribers gain access to fine-grained category filters within each domain, beyond what study presets (§26b) offer. Free players can create study presets selecting domains and top-level subcategories (e.g., Geography > Capitals); subscribers can drill down further and toggle specific sub-categories within a domain (e.g., "WW2 only", "Ancient Rome only", "Turn off Medieval"). This applies to the run pool builder — filtered categories are excluded from fact selection during runs.

**Design constraints:**
- Minimum 1 sub-category must remain active per domain (can't empty the pool)
- Filters persist across runs until changed
- UI: accessible from the Study Mode Selector for custom study presets (subscriber-gated)
- Free players see the filter UI greyed out with an upgrade prompt
- Sub-categories are derived from fact taxonomy (`category[1]`, fallback `categoryL2`, fallback `General`)

### Scholar Challenge (Weekly Curated Run)

- Weekly cycle key is Monday UTC (`YYYY-MM-DD`).
- Run seed and curated domain pair are deterministic for the cycle.
- One attempt is reserved per player per week; completion submits to leaderboard category `scholar_challenge` with `metadata.weekKey`.
- Global leaderboard fetch supports week-key filtering with local fallback rows when offline/unavailable.

### Home Screen (Camp Hub) & Cosmetic Progression

The between-runs hub is a full-screen interactive pixel art camp scene. A cave background image fills the viewport, with 11 positioned pixel art sprites serving as tappable navigation buttons. Each sprite maps to a game feature.

**Camp scene layout** (10 tappable zones + 1 decorative):

| # | Sprite | Position | Action | Notes |
|---|--------|----------|--------|-------|
| 1 | Dungeon Gate | Top center | Start/Resume Run | Primary entry; `data-testid="btn-start-run"`. Study Mode dropdown (`StudyModeSelector.svelte`) positioned near gate for pre-run topic selection. |
| 2 | Bookshelf | Mid-left | Library | Card collection and fact review |
| 3 | Signpost | Mid-right | Settings | Game settings |
| 4 | Anvil | Center-left | Relics | Opens Relic Archive (unlock/exclude relics via Mastery Coins) |
| 5 | Campfire | Dead center | Decorative | Streak visual; not clickable. Future: animation tiers based on streak |
| 6 | Tent | Center-right | Profile | Player profile and stats |
| 7 | Player Character | On top of tent | Shop | Opens social/shop screen (daily modes, competitive entries, pass/store access) |
| 8 | Cat (Pet) | By campfire | "Grrr" popup | Speech bubble appears for 2s. Future: pet interactions and unlockable dialogue |
| 9 | Journal (Book) | Foreground-left | Journal | Run history and adventurer's journal |
| 10 | Quest Board | Foreground-right | Quests | Opens leaderboard/quest entry point |
| 11 | Treasure Chest | Foreground-center | Customize | Opens Camp Upgrades modal (cosmetic tiers, outfits, companions) |

**Run-resume affordance on Home:** If an active run save exists, a banner appears above the hub scene with **Resume** and **Abandon** actions (abandon shows a confirmation modal with run stats).

**HUD overlays** (pinned to screen corners, not scene objects):
- Top-left: Streak count pill (fire icon + number)
- Top-right: Dust/currency balance pill (gem icon + number)

**Camp upgrade modal** (accessed via Treasure Chest): Contains the element upgrade grid (Tent, Seating, Campfire, Decor — 4 tiers each), outfit selector (Scout, Warden, Scholar, Vanguard), and companion selector (Cat, Owl, Fox, Dragon Whelp with unlock costs).

**Sprite organization**: Each sprite lives in its own folder (`/public/assets/camp/sprites/{name}/`) with a `-base` suffix (e.g., `campfire-base.png`). Future cosmetic variants are added alongside (e.g., `campfire-tier2.png`, `campfire-streak5.png`). This supports visual upgrades where each element can have multiple sprite tiers.

**Technical model:** `campState = { tiers: { tent: 0, seating: 0, campfire: 0, decor: 0 }, outfit: 'scout', activePet: 'cat', unlockedPets: ['cat'] }` — tiers map to sprite variants. Upgrades are purely visual sprite swaps. State persists in localStorage.

**Gold sink design:** Camp upgrades are the primary gold sink. Pricing scales exponentially per tier. No gameplay advantage — purely cosmetic progression that rewards consistent play.

**Navigation model:** Primary home navigation is sprite-based. Dedicated screens use their own back controls to return to hub.

**Desktop/mobile layout:** The app renders in a centered portrait game column (`width: min(100vw, calc(100vh * 571 / 1024))`) with dark side gutters on wider displays. Firefly particles animate behind the game frame. On narrow/mobile screens, the hub fills the viewport width while preserving portrait-first interaction zones.

---

## 24. Anti-Features

No chat/social. No AI-generated facts without human review. No PvP. No premium currency. No gacha. No overworld. No farming/crafting. No prestige. No stamina. No cancel after commit. No domain-locked types. Study presets configure which facts appear in runs but do not allow mid-run deck editing or card-by-card selection.

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

**Share button** generates a Wordle-style card image: "I explored Depth 6 of Recall Rogue, answered 42 facts with 81% accuracy, and mastered 2 new concepts. How deep can you go?" Communicates achievement without spoiling content. Organic viral loop.

---

## 26. FSRS Integration (replaces SM-2)

FSRS replaced SM-2 as Anki default 2023. Tracks Difficulty (1-10), Stability (days), Retrievability (0-1). Outperforms SM-2 on 350M+ review benchmark. `ts-fsrs` npm package.

### Run Pool

| Source | % |
|--------|---|
| Primary domain | 30% (~36 facts) |
| Secondary domain | 25% (~30 facts) |
| FSRS review queue | 45% (~54 facts, only from previously engaged domains) |

Players never see facts from domains they haven't opted into.

**Study preset override:** When a study preset is selected (see §26b), the preset's domain + subcategory filters replace the primary/secondary split. `presetPoolBuilder.ts` resolves the preset into a weighted fact pool, maintaining the 45% FSRS review queue.

### Question Variety — Reducing Repetition

Two systems work together to ensure players don't see the same facts repeatedly across runs:

**Weighted review shuffle:** Instead of strict `nextReviewAt` sorting (which always surfaces the same overdue facts first), review facts are selected using urgency-based weights:
- Overdue (past due date): 3x weight — strongly favored but not guaranteed
- Due within 24h: 2x weight
- Due within 7d: 1x weight
- Not yet due: 0.3x weight

This preserves FSRS integrity (overdue cards are still strongly prioritized) while introducing enough randomness that the opening hand of each run feels fresh.

**Recently-played deprioritization:** The last 2 runs' fact IDs are stored in localStorage. When building the domain portion of the run pool (~55% of total), facts seen in recent runs are deprioritized. Review cards (FSRS queue, ~45% of pool) are NOT affected — FSRS scheduling always takes priority for spaced repetition correctness.

### Stratified Difficulty Sampling

Within each domain allocation, facts are sampled by difficulty to ensure a balanced challenge curve:

| Difficulty | Target % | Range |
|-----------|----------|-------|
| Easy (1-2) | 30% | 25-35% |
| Medium (3) | 45% | 40-50% |
| Hard (4-5) | 25% | 20-30% |

These are soft targets — if a domain lacks facts at a given difficulty, shortfalls backfill from medium first, then any remaining bucket. This prevents runs from being all-easy or all-hard regardless of domain content distribution.

### New Player Funness Bias

Early runs (0–9) probabilistically bias card pool selection toward higher-funScore facts using weighted random shuffling during stratified sampling. The bias decays linearly to zero over runs 10–99. At run 100+, no bias is applied (normal random selection).

**Boost parameters:**
- Runs 0–9: Full boost (funScore 10 facts are 2× more likely to appear; funScore 1 facts are 0.2× more likely)
- Runs 10–99: Linear decay from full boost to zero
- Runs 100+: No boost (all facts equally likely within their difficulty tier)

**Mechanism:** The system preserves difficulty distribution — only weights WHICH facts within each difficulty tier are selected. A Medium (difficulty 3) fact with funScore 10 is more likely to be picked over another Medium fact with funScore 1, but both remain Medium difficulty cards. This front-loads engaging content for player retention without compromising learning progression.

**Implementation:** Applied in `runPoolBuilder.ts` and `presetPoolBuilder.ts` via weighted shuffle in `stratifiedSample()`, with boost calculation in `funnessBoost.ts`. Reads `totalDivesCompleted` from player save data (passed via `encounterBridge.ts`).

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
  if (state.stability >= 10 && state.consecutiveCorrect >= 4 && state.passedMasteryTrial) return '3';
  if (state.stability >= 5 && state.consecutiveCorrect >= 3) return '2b';
  if (state.stability >= 2 && state.consecutiveCorrect >= 2) return '2a';
  return '1';
}
```

---

## 26b. Study Presets & Deck Builder

### Study Presets (Custom Decks)

Players can create up to 10 named **study presets**, each selecting any combination of domains and subcategories. Presets are managed in a **Deck Builder** tab within the Library screen.

**Preset definition:**
- Name (player-chosen, e.g., "Ancient History + Science")
- Selected domains (any combination from the 16 available)
- Selected subcategories within each domain (e.g., Geography > Capitals, Geography > Flags)
- Stored locally, persisted across sessions

**Types:** `StudyPreset` and `DeckMode` in `src/data/studyPreset.ts`. CRUD operations in `src/services/studyPresetService.ts`.

### Study Mode Selector (Hub Screen)

The hub screen includes a **Study Mode dropdown** near the dungeon gate, replacing the need to pick 2 domains each run.

**Dropdown options:**
- **All Topics** — general pool across all domains (default)
- **Saved presets** — each named preset appears as an option
- **Languages** — each enabled language domain
- **Build New Deck** — opens the Deck Builder directly

**Rules:**
- Locked when a run is active (cannot change mid-run)
- Previous run's mode is remembered as the default selection
- UI component: `src/ui/components/StudyModeSelector.svelte`

### Mastery Scaling (Anti-Cheat)

When a player uses a custom deck with heavily mastered content, reward scaling prevents farming easy facts for leaderboard advantage.

**At run start**, `masteryScalingService.ts` calculates the **deck mastery %** — the percentage of facts in the selected pool at tier 2b or 3 (Mastered/Deep Recall).

| Mastery % | Label | Reward Multiplier | Timer Boost |
|-----------|-------|-------------------|-------------|
| < 40% | Normal | 1.0x | +0 virtual floors |
| 40–60% | Practiced | 0.85x | +1 virtual floor |
| 60–80% | Expert | 0.65x | +2 virtual floors |
| 80–95% | Mastered | 0.40x | +4 virtual floors |

- **Reward multiplier** reduces currency/XP earned at run end
- **Timer boost** adds virtual floors to the timer calculation, making timers shorter (as if the player were deeper in the dungeon)
- A transparent **"Expert Mode" badge** is shown in the combat HUD when mastery scaling is active (Practiced or above)

### Pool Size Warnings

If the selected study mode has too few facts, warnings are shown before run start:

| Condition | Warning | Effect |
|-----------|---------|--------|
| < 40 facts available | "Small deck — no loot, no leaderboard" | Rewards and leaderboard submission disabled |
| < 25% of facts unmastered | "Mostly mastered" | Same as above — practice mode only |

Players can still play (practice mode) but run results do not count for rewards or leaderboards.

### Leaderboard Eligibility by Deck Type

| Study Mode | Leaderboard |
|------------|-------------|
| All Topics (general) | General leaderboard |
| Single-domain preset | Domain-specific leaderboard |
| Multi-domain preset | No leaderboard (too variable) |
| Language | Language-specific leaderboard |

### Geography Sub-Decks

Geography has selectable subcategories that auto-appear in the Deck Builder:

| Subcategory | Facts | Format |
|-------------|-------|--------|
| Capitals | ~215 | Bi-directional MCQ (country→capital, capital→country) |
| Flags | ~214 | SVG flag images displayed above question text |

Flag facts include an `imageUrl` field pointing to `/assets/flags/flag-{slug}.svg`. When a fact has `imageUrl`, the quiz UI renders the image above the question text (max 80px tall, white background, rounded corners). 227 flag SVG files are extracted from the Anki community deck and served as static assets. The image has an error fallback that hides the `<img>` element if the SVG fails to load.

---

## 27. Fact Database

```typescript
interface Fact {
  id: string;
  domain: FactDomain;
  subdomain?: string;
  ageRating: 'all' | '10+' | '13+' | '16+' | '18+';
  baseDifficulty: 1 | 2 | 3 | 4 | 5;
  variants: QuestionVariant[];    // min 2, target 5
  imageUrl?: string;              // Optional image for quiz display (e.g., flag SVGs)
  // cardType and mechanic NOT on Fact — assigned per-run

  // Source verification (MANDATORY — see §22 and Content Accuracy below)
  sourceName: string;             // REQUIRED. e.g., "Wikipedia", "NASA", "Jisho.org"
  sourceUrl?: string;             // Recommended. Permalink to verification source
  verifiedAt?: Date;              // Null until human-reviewed. Required before production.

  // Card art generation (see §22 Card Back Visual Descriptions)
  visualDescription?: string;     // 20-40 word pixel art scene prompt. Language-themed for vocab.
  pixelArtPath?: string;          // Path to generated card back sprite (null until generated)
  pixelArtStatus?: 'none' | 'generating' | 'review' | 'approved' | 'rejected';

  tags: string[];
}

interface RunCard {
  fact: Fact;
  cardType: CardType;
  mechanic: CardMechanic;
  tier: '1' | '2a' | '2b' | '3';
  baseEffectValue: number;
}
```

### Question Variant Requirements

**Knowledge facts:** Minimum 4 variants, target 5. Variant types:
- **Forward**: Direct question → correct answer (e.g., "What causes oil formation?")
- **Reverse**: Answer/description → identify the subject (e.g., "Heat and pressure on organic matter over millions of years produces...")
- **Negative**: "Which is NOT..." → identify the false option (e.g., "Which is NOT a factor in oil formation?")
- **Context**: Scenario/context paragraph → identify the relevant fact (e.g., "Petroleum geologists study the transformation of ancient organic material. This process requires...")
- **Fill-blank**: Statement with key term blanked (e.g., "Oil is formed from ___ under heat and pressure over millions of years")
- **True/false**: Statement that may be subtly wrong (e.g., "Oil is formed from volcanic activity under the ocean" → False)

**Q&A length constraints** (enforced by `QA_LIMITS` in `balance.ts`):

| Variant Type | Question Max Words | Answer Max Words |
|---|---|---|
| forward | 12 | 5 |
| reverse | 15 | 4 |
| negative | 10 | 5 |
| fill_blank | 15 | 3 |
| true_false | 15 | 1 |
| context | 15 | 4 |

- Base question limit: 12 words
- Answer limit: 5 words / 30 characters
- Answer options must be within 20% character count of each other

**Distractor quality rules:**
- All options must be similar length (within 20% character count)
- All options must be similarly specific (no "obviously detailed" correct answer)
- Distractors must be plausible to someone who doesn't know the answer
- For negative variants, the distractors ARE correct facts (the wrong answer is the one that IS true)
- 8–12 distractors per fact (top-level pool), max 30 characters each

**CRITICAL: NEVER generate distractors from database pools**

Distractors (wrong answers for quiz questions) must NEVER be pulled from `correct_answer` values of other facts in the same domain/subcategory. This approach produces semantically nonsensical garbage — a bird species name as a distractor for a bird behavior question, a random capital for a flag question, etc. On March 12, 2026 we had to strip 58,359 garbage distractors produced this way.

ALL distractors MUST be generated by an LLM (GPT-5.2+ or Haiku agent) that reads the specific question, understands what's being asked, and produces plausible wrong answers that:
- Are semantically coherent with what the question asks
- Match the format and length of the correct answer
- Are factually WRONG but plausible to a student
- Come from the LLM's world knowledge, NOT from database queries

The ONLY permitted use of DB queries for distractors is POST-GENERATION VALIDATION — checking that a generated distractor doesn't accidentally match another fact's correct answer.

Scripts like `mine-distractors.mjs` or any `SELECT correct_answer FROM facts WHERE category = ...` approach for distractor generation are PERMANENTLY BANNED.

**Vocabulary facts:** Exempt from variant expansion. The existing forward/reverse/fill-blank system is sufficient because answer options are always similar-length words.

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

### Content Accuracy at Scale (MANDATORY)

Incorrect facts destroy trust in an educational product. This is non-negotiable:

- **`sourceName` is REQUIRED** on every fact — ingestion pipeline rejects facts without it
- **`sourceUrl` is strongly recommended** — Wikipedia permalinks preferred over live articles
- All facts require `verifiedAt` timestamp before entering production database
- Community-submitted facts enter "Provisional" state (visually marked) until verified
- "Report Error" button on every card (tap-and-hold → "This fact seems wrong")
- AI-drafted facts ALWAYS flagged for human review before `verifiedAt` is set
- Vocabulary facts: verified against authoritative language sources (Jisho.org for Japanese, RAE for Spanish, Larousse for French)

**Source Quality Tiers:**

| Tier | Source Type | Trust Level | Pipeline Action |
|------|-----------|-------------|-----------------|
| Gold | Wikipedia permalink, NASA, NIH, Oxford, authoritative language dictionaries | High | Accept if schema valid |
| Silver | Educational sites, textbooks, encyclopedias | Medium | Accept, flag for spot-check |
| Bronze | AI-generated, no URL, unverifiable | Low | Reject unless manually verified first |

### Visual Description Pipeline

Every fact requires a `visualDescription` for card back art generation. See §22 for full rules.

- General knowledge facts: fantasy/educational scene illustrating the fact
- Vocabulary facts: **language-themed** scenes (see §22 for per-language cultural requirements)
- `pixelArtStatus` tracks generation state: `none` → `generating` → `review` → `approved`/`rejected`
- Cards with `pixelArtStatus: 'none'` use a generic domain-colored card back as fallback

### Data Quality Maintenance

The pipeline includes ongoing normalization passes to maintain schema consistency across the growing fact database:

- **Domain normalization (March 2026):** 171 facts had non-canonical domain names normalized to correct enum values (e.g., misspelled or legacy domain strings).
- **Variant quality fixes:** 934 variant-level corrections applied, including true/false distractor cleanup, `answer` field consistency alignment, and empty distractor backfills.
- **Entity reclassification:** 148 entities moved to their correct domains based on content review. 110 Latin taxonomic group entries flagged to skip (pure taxonomy groups with no quiz-worthy facts).

These passes run as part of the `audit-fact-quality.mjs` quality gate and are re-run whenever new batches are ingested.

### Scale

122 current → 10K+ per domain → 5K+ per language pack. All human-verified. All sourced.

---

## 27.5. Content Quality Pipeline

### Mandatory Haiku Processing

Every fact that enters the game database MUST be processed by a Haiku LLM agent via Claude Code's Agent tool. No exceptions. This applies to:
- Wikidata-sourced facts (transformed from raw structured data into quiz format)
- Hand-crafted facts (quality-checked and scored)
- Auto-generated facts (fully reviewed and re-scored)

### Quality Requirements Per Fact

Each fact must have:
- **Quiz question**: Clear, concise, 10-20 words, ends with ?
- **Correct answer**: Definitive, 1-5 words
- **3+ distractors**: Plausible wrong answers, same type as correct answer
- **Explanation**: Engaging 1-2 sentence explanation with a "wow" hook
- **Fun score (1-10)**: Subjective interest rating. Facts scoring ≤2 are rejected
- **Difficulty (1-5)**: Accurate difficulty for average adult player
- **2+ variants**: Alternative question angles (forward, reverse, fill_blank)

### Distractor Blocklist

These are NEVER acceptable as distractors: "Unknown", "Other", "None of the above", "None of these", "All of the above", "N/A", "...", empty strings, "[object Object]"

### QA Gates (Enforced by Default)

- `promote-approved-to-db.mjs`: `enforce-qa-gate: true`, `approved-only: true`
- `audit-fact-quality.mjs`: Blocklist check, format validation, `_haikuProcessed` flag required
- Facts without `_haikuProcessed: true` cannot enter the database

### No Anthropic API

All LLM processing uses Claude Code Agent tool (`model: "haiku"`). No `@anthropic-ai/sdk` or external API calls. The `LOCAL_PAID_GENERATION_DISABLED` flag in `haiku-client.mjs` stays `true`.

---

## 28. Content Generation Strategy

### Commercially Safe Sources Only

All fact content must come from sources with licenses that permit commercial use without ShareAlike obligations. This is non-negotiable for a commercial product.

**Approved license types:**
- CC0 (public domain dedication) — preferred, no restrictions
- CC-BY (attribution only) — permitted, must credit source
- US Government works — public domain by law
- MIT / Apache 2.0 licensed datasets — permitted

**Prohibited license types:**
- CC-BY-SA (ShareAlike) — derivative work ambiguity risk for commercial games
- CC-BY-NC (NonCommercial) — explicitly prohibits commercial use
- GPL-licensed datasets — viral copyleft
- Unlicensed / unknown — assume all rights reserved

### Primary Data Sources (Verified & Commercial-Safe)

| Source | License | Use Case | Domains |
|--------|---------|----------|---------|
| Wikidata SPARQL | CC0 | Universal backbone — structured facts across ALL domains | All 10 |
| CIA World Factbook (factbook.json) | CC0 | 266 countries × 200 fields | Geography, General Knowledge |
| Nobel Prize API | CC0 | 660+ prizes, laureates, motivations | General Knowledge, History |
| NASA Open APIs | US Gov (PD) | APOD, NeoWs, Mars Rover, mission data | Space & Astronomy |
| NASA Exoplanet Archive | US Gov (PD) | 6,128+ confirmed exoplanets (use selectively) | Space & Astronomy |
| PubChem (NIH) | US Gov (PD) | 119M compounds — use notable subset only | Natural Sciences |
| NIST Physical Constants | US Gov (PD) | 350+ fundamental constants | Natural Sciences |
| Frictionless Periodic Table | CC0 | 118 elements with properties | Natural Sciences |
| ITIS | US Gov (PD) | 839K taxonomic names — filter to recognizable species | Animals & Wildlife |
| GBIF | CC0/CC-BY (filter!) | 2.5B+ occurrences — MUST exclude CC-BY-NC (~18%) | Animals & Wildlife |
| USDA FoodData Central | CC0 | 400K+ foods, 117 nutrients per item | Food, Human Body |
| Met Museum Open Access | CC0 | 470K+ artworks spanning 5,000 years | Art & Architecture |
| Art Institute of Chicago | CC0 | 131K+ artworks | Art & Architecture |
| Rijksmuseum | CC0 | 800K+ objects | Art & Architecture |
| Getty Vocabularies | ODC-By 1.0 | 77K art concepts, 380K artists, 2.4M places | Art & Architecture |
| Smithsonian Open Access | CC0 | 5.1M+ items cross-domain | Cross-domain |
| OpenStax CC-BY textbooks | CC-BY 4.0 | Biology, A&P, Chemistry, Physics, History, Psychology | Sciences, Health, History |
| World Bank Open Data | CC-BY 4.0 | 16K indicators, 200+ economies | Geography |
| GeoNames | CC-BY 4.0 | 25M geographical names | Geography |
| MANTO (Mythlab) | CC-BY 4.0 | 5,400 Greek mythology entities | Mythology |
| FactGrid Roscher | CC0 | 15K+ mythology entities | Mythology |
| Leipzig Corpora | CC-BY 4.0 | Frequency-ranked word lists (270+ languages) | Languages (ES/FR/DE/KO) |
| Tatoeba | CC-BY 2.0 FR | Bilingual sentence pairs | All languages |
| JMdict/EDRDG | CC-BY-SA 4.0 (commercial OK) | 214K+ Japanese dictionary entries | Japanese |
| complete-hsk-vocabulary | MIT | HSK 2.0 + 3.0 vocabulary (11K+ words) | Mandarin Chinese |

### Haiku-Powered Question Generation

Raw structured data from the sources above is transformed into the game's Fact schema using **Claude Haiku API** calls. This is the core of the content pipeline.

**Pipeline flow:**
```
Wikidata SPARQL query → structured JSON
    → Claude Haiku prompt (with domain-specific system prompt)
    → Fact schema JSON (question, answer, distractors, difficulty, funScore)
    → Schema validation
    → Duplicate detection
    → Human verification queue
    → Production database
```

**Why Haiku:** Cost-efficient ($0.25/M input, $1.25/M output), fast (sub-second), good enough for question/distractor generation. At ~500 tokens per fact, generating 10K facts ≈ $6.25 per domain. Total for all 10 domains ≈ $62.50.

**Haiku generates:**
- Quiz question text (natural language, engaging phrasing)
- 4–5 question variants per fact (forward, reverse, negative, fill-blank, true/false, context)
- 8–12 plausible distractors with difficulty tiers (easy/medium/hard), max 30 chars each
- `difficulty` rating (1–5)
- `funScore` rating (1–10)
- `visualDescription` (culturally themed for vocabulary, fact-illustrating for knowledge)
- `wowFactor` framing (mind-blowing restatement shown on correct answer)

**Haiku does NOT replace human verification.** Every generated fact enters the pipeline with `verifiedAt: null` and must be reviewed before production. See §27 Content Accuracy.

### Quality Over Volume

Raw source data volumes far exceed what makes good quiz content. Per-domain generation caps prevent flooding the database with obscure facts nobody finds interesting:

- Total target: ~78,000 knowledge facts + ~50,000 vocabulary entries
- Space: 5K facts (notable objects, missions, astronauts — not all 6,128 exoplanets)
- Animals: 10K facts (recognizable species with common names — not 839K taxonomic entries)
- Art: 10K facts (famous works and artists — not 470K anonymous museum records)
- Each generated fact must score funScore ≥ 4 (on 1-10 scale) or be auto-rejected

### Language Data Gaps

Spanish, French, German, Dutch, Czech, and Korean lack commercially safe bilingual dictionaries (most are CC-BY-SA). The workaround: use Leipzig Corpora frequency lists (CC-BY 4.0) + Haiku-generated translations to create original CC0 bilingual data. Korean is the worst gap and may require commissioned data. See `docs/roadmap/phases/AR-18-VOCABULARY-EXPANSION.md` for full analysis.

### Wikipedia as Verification Layer

Wikipedia is CC-BY-SA, which creates ShareAlike ambiguity for derivative works. Therefore:
- Wikipedia is used for **fact-checking**, NOT as a content source
- `sourceName` points to the actual data source (Wikidata, NASA, OpenStax, etc.)
- Facts are generated from CC0/CC-BY structured data, then accuracy is cross-referenced against Wikipedia
- This sidesteps ShareAlike entirely while maintaining verification rigor

### Anki Community Decks as Pedagogical Word Lists

For language vocabulary, popular Anki shared decks provide superior word curation compared to raw frequency lists. Decks with tens of thousands of downloads represent years of community refinement on which words matter most for learners.

**Extraction rules (STRICT — legal compliance):**
- Extract ONLY target-language words from .apkg files
- Discard ALL English translations, examples, mnemonics, and metadata
- Haiku generates 100% fresh translations, level assignments, and example sentences
- Output is original CC0 data — no copyrightable expression is copied
- Reference decks stored in `data/reference/anki-decks/` and gitignored

**Languages using Anki extraction pipeline:** Korean, Spanish, French, German, Dutch, Czech
**Languages NOT needing Anki extraction:** Japanese (JMdict), Mandarin (complete-hsk-vocabulary MIT repo)

This specifically solves the Korean vocabulary gap identified in the content source research.

### Manual Fact Ingestion & Semantic Dedup

**Status: Built.** Implemented in `scripts/content-pipeline/manual-ingest/`. Provides a complete pipeline for manually curated facts (JSON/JSONL) with validation, semantic deduplication, and safe merge workflow.

**Source-mix stage (built):** `scripts/content-pipeline/manual-ingest/source-mix.mjs` blends each domain's Wikidata pull with domain-specific API datasets (NASA, GBIF, PubChem, Met, ArtIC, World Bank) into `data/raw/mixed/<domain>.json` before generation.

**Pipeline flow:**
```
Input JSON/JSONL
    → Schema validation + normalization (3-attempt retry per record)
    → Stage A: exact key dedup (normalized statement::answer)
    → Stage A: trigram/Jaccard candidate pair generation
    → Stage B: multi-signal composite scoring (trigram + keyword + Levenshtein + answer + statement)
    → Stage B: TF-IDF cosine similarity (corpus-aware, enabled by default)
    → Decision: auto-duplicate (≥0.92) / needs-review (0.70–0.91) / distinct (<0.70)
    → Review queue (interactive browser UI or JSON report)
    → Merge preview → explicit finalize step
```

**Key features:**
- **Two-stage dedup:** Cheap trigram blocking generates candidate pairs; multi-signal composite scoring with TF-IDF ranks them. Zero external dependencies.
- **Answer-match boost:** When two facts share nearly identical answers (≥90% similar) AND questions share ≥30% overlap, the score is boosted by 0.15–0.40 — captures the "same answer = likely same question" signal critical for quiz content.
- **CJK-aware:** Automatic detection of Japanese, Korean, Chinese text. Uses character bigrams (not trigrams) and character-level token extraction for non-Latin scripts.
- **Persistent dedup index:** Caches exact keys + trigram inverted index to `data/generated/qa-reports/dedup-index.json` for faster repeated runs.
- **Interactive review UI:** Local HTTP server (`localhost:3456`) with dark-themed browser interface. Side-by-side fact comparison, per-feature score breakdown, accept/reject/undo with persistent decisions.
- **QA pipeline integration:** Runs automatically as part of `npm run content:qa` with conservative thresholds (0.95 auto, 0.75 review).
- **Strict post-ingestion gate:** `npm run content:qa` now runs gameplay safety + post-ingestion pass/fail checks before migration. Promotion (`content:promote`) refuses to run unless `post-ingestion-gate.json` passes.
- **Data safety:** Never overwrites existing files. Creates timestamped backups before merge. Failed records are flagged (never silently dropped). Every accepted record preserves sourceRecordId/sourceName/sourceUrl.

**Reports emitted** (in `data/generated/qa-reports/`):
- `source-mix-report.json` — per-domain source composition from mixed inputs
- `manual-ingest-validation-report.json` — schema validation results
- `manual-ingest-dedup-report.json` — dedup decisions with full feature evidence
- `manual-ingest-flagged-report.json` — records that failed ≥3 validation attempts
- `manual-ingest-merge-preview.json` — what merge would produce
- `gameplay-safety-report.json` — run-pool safety checks (duplicate risk, type/difficulty/source coverage)
- `post-ingestion-gate.json` — strict gate summary across validation, dedup, coverage, and gameplay checks

**Commands:**
```bash
npm run content:manual:validate -- --input <file> --domain <name>
npm run content:manual:dedup -- --input <file> --domain <name> --dry-run
npm run content:manual:full -- --input <file> --domain <name> --target <file>
npm run content:manual:review          # interactive browser UI
npm run content:manual:build-index     # build persistent dedup index
npm run content:source-mix             # build mixed-source domain inputs
npm run content:qa:gameplay -- --strict
npm run content:qa:gate -- --strict
```

---

## 29. Competitive Moat

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

## 30. Technical Notes

**Stack:** Svelte 5 + Phaser 3 + TypeScript + Capacitor. Portrait. Mobile-first.

**Deps:** `ts-fsrs`, `@capacitor/haptics`, `@capacitor/preferences`

**Phaser performance:** 60fps target. ~15 game objects in combat. 50 particle cap (correct answer burst = 30 particles, 300ms lifespan). Phaser tweens only (GPU-accelerated, no CSS). Sprite pool for card fan (5 pre-created, reposition don't create/destroy).

**State persistence:** Save after every encounter via `@capacitor/preferences`. 24h survival. Run state JSON <50KB. FSRS data for 500 facts ≈ 25KB.

**Kill metric:** >2x voluntary fact-review volume per minute vs raw flashcard drilling.

**Retention targets:** D1: 40-45%, D7: 18-22%, D30: 8-12%.

---

## 31. App Store Review Prompt Timing

Native App Store / Play Store review prompts are triggered at emotionally positive peaks to maximize conversion. Implemented in `src/services/reviewPromptService.ts`.

**Trigger Conditions (any ONE fires the prompt):**
1. **First Boss Kill** — After defeating any boss and retreating (positive victory moment)
2. **First Tier 2 Promotion** — When any fact reaches Tier 2a, 2b, or 3 for the first time (knowledge milestone)
3. **7-Day Streak** — When the player reaches a 7-consecutive-day streak (habit formation peak)

**Rate Limiting:**
- Maximum 1 prompt per 90 days
- Never during an active run or after a death/defeat
- Minimum 3 completed runs before any prompt
- Maximum 3 prompts total per rolling year (Apple guideline compliance)
- Each trigger fires at most once (e.g., second boss kill won't re-trigger)

**Technical:** Uses Capacitor's `registerPlugin('StoreReview')` for native prompts. Falls back to no-op on web. State persisted in localStorage.

---

## 32. Push Notifications (Mobile Retention)

**Status: Built.** Implemented in `src/services/notificationService.ts`. Settings UI in `SettingsPanel.svelte`. Integration in `gameFlowController.ts` (run completion) and `main.ts` (app open).

**4 Notification Types (priority order):**

| # | Type | Trigger | Schedule | Example Message |
|---|------|---------|----------|-----------------|
| 1 | Streak Risk | Streak >= 2 days, no run today | 6 PM local (6 hrs before midnight) | "Your {N}-day streak is at risk! Jump back into the dungeon." |
| 2 | Milestone Proximity | Within 2 facts of domain mastery | 4 hours after last session | "You're 2 facts from mastering {domain}!" |
| 3 | Facts Due | FSRS has 10+ facts due for review | 9 AM local (next day if past 9 AM) | "{N} facts are ready for review. Keep your knowledge sharp!" |
| 4 | Win-Back | No session in 3+ days | Day 3, 7, 14 after last session at 10 AM | "Your deck misses you. {N} facts are overdue for review." |

**Scheduling Rules:**
- **Max 1 notification per day** — tracked via `lastNotificationDate` in localStorage
- **Quiet hours: 10 PM – 8 AM local** — notifications falling in quiet hours are pushed to 8 AM
- **Priority**: streak > milestone > facts due > win-back (only the highest fires)
- **Reschedule on every app open** — cancel all pending, recalculate, reschedule
- **Reschedule on run completion** — same cancel-recalculate cycle

**Permission & Platform:**
- Permission requested after first completed run (not during onboarding)
- Uses Capacitor `LocalNotifications` plugin via dynamic import with `@vite-ignore`
- Web fallback: silent no-op (all functions are safe to call on web)
- Win-back stops after Day 14 (no further notifications for inactive players)

**Settings UI (in Settings > Notifications):**
- Master toggle: "Push Notifications" (on/off, cancels all when off)
- Sub-toggles (visible only when master is on): Streak Reminders, Review Reminders, Milestone Alerts, Win-back Messages
- All enabled by default; state persisted in localStorage key `recall-rogue-notifications`

---

## 33. Ascension Mode

**Status: Implemented.**

**Unlocks:** After first successful run completion (reach floor 9+ and retreat, or clear floor 24).

20 Ascension levels, each adds a permanent modifier. All previous levels stack:

| Level | Modifier | Effect |
|-------|----------|--------|
| 1 | Tougher Enemies | All enemies +10% HP |
| 2 | Aggressive Foes | All enemies +10% damage |
| 3 | Fewer Shields | Shield cards 20% less effective |
| 4 | Shorter Fuse | Timer -1s base on all questions |
| 5 | Thin Deck | Start with 12 cards instead of 15 |
| 6 | Iron Will | No flee from encounters |
| 7 | Harsh Grading | Close-distractor answers more common |
| 8 | Elite Surge | Mini-bosses gain boss-tier attacks |
| 9 | Endurance | Runs must reach floor 12+ to retreat with rewards |
| 10 | Fading Light | Encounter 2 per floor has -2s timer |
| 11 | Relic Tax | Boss relic choices reduced to 2 |
| 12 | Deep Knowledge | All Tier 1 cards are 4-option MCQ (no easy 3-option) |
| 13 | Glass Cannon | Player max HP reduced to 70 |
| 14 | Combo Breaker | Combo resets on turn end (not just on wrong answer) |
| 15 | Boss Rush | Bosses gain +25% HP |
| 16 | No Echo | Echo mechanic disabled (wrong answers don't return) |
| 17 | Scholar's Burden | Wrong answers deal 5 self-damage (all modes) |
| 18 | Minimalist | Start with 10 cards |
| 19 | True Test | All questions are fill-blank or production format |
| 20 | Heart of the Archive | Floor 24 boss gains a secret second phase |

**Design philosophy:** Each level targets a different player skill. Early levels (1-5) are stat adjustments anyone can handle. Mid levels (6-12) restrict strategies. Late levels (13-20) fundamentally alter gameplay. Level 20 is a prestige challenge — only the most dedicated players will see the Curator's true form.

**Interaction with difficulty modes:** Ascension modifiers stack ON TOP of difficulty mode settings. Story Mode + Ascension 5 still has no timer but starts with 12 cards. Expert Mode + Ascension 17 means wrong answers deal 5 self-damage AND 3 self-damage from fizzle.

---

## 34. Future Todo (Post-Launch)

- **Reintroduce Knowledge Tree UI (exploration mode):**
  Bring back a dedicated tree-view progression screen that visualizes category/subcategory mastery across all 11 domains, with zoom levels (forest -> branch -> leaf), overdue-state visual cues, and tap-through fact detail. This is currently not part of the primary run loop and should return only after launch-critical stability/content pipeline work is complete.

- **Extended Language Content (Grammar, Characters, Script Systems):**
  Beyond vocabulary, each language could support additional study dimensions:
  - **Japanese**: Kanji deck (~2,200 characters by JLPT level) and Grammar deck (~800 grammar points by JLPT level) — tracked as AR-49 and AR-50.
  - **Chinese**: Hanzi character deck (parallel to kanji), HSK grammar patterns.
  - **Korean**: Hangul character deck (for absolute beginners), TOPIK grammar patterns.
  - **European languages (ES/FR/DE/NL/CS)**: Grammar decks per CEFR level (verb conjugation, sentence patterns, case systems for German/Czech).
  These are post-launch content expansions. The infrastructure (per-level subcategories, subdeck filtering, `inferLanguageSubdeck()`) is already in place — only the content generation pipeline work remains.

- **Mastery Skins (Animated Card Backs):**
  Every card that reaches "Learned" state (Tier 2a+) unlocks a unique animated card back — a short looping animation generated with WAN2.1 (video diffusion model). This replaces the static pixel art cardback with a living, breathing scene. If the player's FSRS retrievability drops below the learned threshold (i.e., the fact decays back to Tier 1 due to missed reviews), the animated skin is lost and reverts to the static card back. Re-learning the fact re-unlocks the animation. This creates a powerful visual incentive loop: players SEE their knowledge literally come alive, and neglecting review causes their collection to visually decay. The transience makes mastery feel earned, not permanent — matching how real memory works.

---

## 35. Automated Playtesting Framework

AI-driven playtesting system that simulates diverse player types, analyzes gameplay logs, and produces a ranked issue leaderboard — all without manual play.

### Three-Tier Architecture

| Tier | Agent | Role |
|------|-------|------|
| **Play** | Haiku (cheap) | Runs headless combat simulations following player profiles. Records structured JSON logs. Does NOT analyze. |
| **Analyze** | Sonnet | Reads playthrough logs, detects balance/UX/progression issues using detection rules, writes issue reports. |
| **Triage** | Opus | Deduplicates issues across playthroughs, scores by severity × frequency × profile breadth, maintains ranked leaderboard. |

### Player Profiles

Six configurable JSON profiles in `tests/playtest/profiles/`:

| Profile | Accuracy | Speed | Strategy | Purpose |
|---------|----------|-------|----------|---------|
| `beginner` | 50% flat | slow | random | Tests canary assist, early difficulty |
| `average` | 70% improving | normal | basic | Typical player experience |
| `expert` | 90% flat | fast | optimal | Tests high-combo balance, speed bonus |
| `speed-runner` | 90% + 90% speed bonus | fast | optimal | Tests speed bonus snowball effect |
| `struggling` | 40% declining | slow | random | Stress-tests canary + echo mechanics |
| `impatient` | 70% volatile | normal | random, 25% skip | Tests skip/engagement patterns |

Each profile controls: accuracy curve (flat/improving/declining/volatile), reading speed (speed bonus probability), strategic skill level (random → optimal card selection), engagement (skip probability, aggression), and session behavior (max floors, cash-out floor).

Profiles support deterministic overrides: predetermined answer sequences, enemy sequences, RNG seeds, start floor, and start HP for reproducible testing.

### Headless Combat Simulation

The `HeadlessCombatSimulator` (`tests/playtest/core/headless-combat.ts`) imports the real game engine services directly under Vitest + happy-dom — no browser, no Phaser, no rendering:

- `turnManager.ts` — encounter loop, card play, enemy turns
- `deckManager.ts` — deck/hand management
- `enemyManager.ts` — enemy creation, HP scaling, intent rolling
- `cardEffectResolver.ts` — damage/shield/heal calculation
- `playerCombatState.ts` — player HP/shield/status tracking

Uses `patchMathRandom(seed)` for fully deterministic, reproducible runs.

### Card Selection AI

Four strategy levels (`tests/playtest/core/combat-strategies.ts`):

- **Random**: Pick any card, small skip chance
- **Basic**: Prioritize attacks, heal when HP < 50%
- **Intermediate**: Read enemy intent — shield before attacks, debuff before multi-attacks, buff before own attacks
- **Optimal**: Full decision tree — combo management, buff stacking, shield timing, vulnerability exploitation

### Playthrough Log Format

Structured JSON logs in `data/playtests/logs/` with:
- **Per-action entries**: card type, mechanic, answer correctness, speed bonus, damage dealt/received, combo state
- **State snapshots**: player HP/shield, enemy HP, hand size, AP after every action
- **Per-encounter summaries**: turns to resolve, accuracy, max combo, damage dealt/taken
- **Run summary**: result, final floor, total encounters, overall accuracy, max combo, perfect turns

### Issue Detection Rules

The Sonnet analyzer checks for 17 issue categories across 5 areas:

- **Balance**: damage spikes (>50% HP in one hit), too easy (3+ fights at >90% HP), combo unreachable (>60% accuracy but max combo <3)
- **Progression**: difficulty spikes (>2× turns vs previous floor), dead ends (0 damage dealt)
- **UX**: dead turns (no meaningful choices), unfun moments (HP 70%→20% in one fight)
- **Canary**: not triggering (3+ wrong answers, still neutral), over-compensating (assist at >70% accuracy)
- **Mechanics**: unused card types, broken effects (0 value when non-zero expected)

### Issue Leaderboard

Scored and ranked in `data/playtests/leaderboard.json`:

```
Score = severity_weight × frequency × breadth_factor
```

- Severity weights: critical=10, high=5, medium=3, low=1, cosmetic=0.5
- Breadth factor: 1.0 (1 profile), 1.25 (2 profiles), 1.5 (3+ profiles)
- Deduplication by `{category}_{floor_bucket}` (early/mid-early/mid/late/endgame)

View with: `node tests/playtest/view-leaderboard.mjs`

### Skills

| Skill | Purpose |
|-------|---------|
| `/playtest-suite` | Run full pipeline: simulate → analyze → triage → display results |
| `/playtest-results` | View existing leaderboard, logs, or reports |
| `/playtest --profile expert --seed 42` | Run a single simulation |
| `/playtest-analyze --latest` | Analyze the most recent log |
| `/playtest-triage` | Deduplicate and rank all reports |

### Key Files

```
tests/playtest/
  core/
    headless-combat.ts    — HeadlessCombatSimulator class
    combat-strategies.ts  — Card selection AI (4 levels)
    seeded-rng.ts         — Deterministic PRNG
    types.ts              — All TypeScript types
  profiles/               — 6 player profile JSONs
  runners/
    run-headless.test.ts  — Vitest entry point
  analysis/
    sonnet-analyzer-prompt.md  — Detection checklist
    opus-triage-prompt.md      — Triage guide
    issue-categories.ts        — Categories + scoring
  view-leaderboard.mjs    — CLI leaderboard viewer
data/playtests/
  logs/                   — Playthrough JSON logs
  reports/                — Issue report JSONs
  leaderboard.json        — Ranked issue leaderboard
```

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
| Segment | Group of 6 floors ending in boss + retreat-or-delve checkpoint |
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
| Retrievability | FSRS: current recall probability (0-1). Below 0.7 = due for review. |
| Mastered | Fact that passed Mastery Trial. Awards 1 Mastery Coin. |
| Relic | Permanent passive buff collected during runs. 50 total (25 free + 25 unlockable). No limit on active relics per run. |
| Mastery Coin | Meta-currency earned by mastering facts (1 per Tier 3). Spent to unlock relics in the Relic Archive. |
| Relic Archive | Hub screen (via Anvil) for browsing, unlocking, and configuring relics. Replaces old Relic Sanctum. |
| Echo | Ghost card from wrong answer. 85% reappearance chance. Reduced power. |
| Mastery Trial | Final exam: 4s timer, 5 close distractors. Pass = Tier 3. |
| Mechanic | Specific behavior within a card type (Strike, Multi-Hit, Thorns, etc.). Assigned per-run. |
| Bounty Quest | Optional per-run bonus objective with rewards. |
| Lore Discovery | Narrative milestone at 10/25/50/100 mastered facts. |
| Canary | Invisible adaptive difficulty system. Adjusts game, never educational rigor. |
| Accelerated FSRS | Calibration system during runs 1-3. Boosted gains on correct fast responses and high accuracy runs accelerate tier promotion and cold-start calibration. |
| Archetype Bias | Run-start deck strategy preference (Balanced/Aggressive/Defensive/Control/Hybrid). Soft weighting on card type rewards. |
| Haiku Generation | Content pipeline using Claude Haiku API to transform structured data (Wikidata, NASA, etc.) into Fact schema JSON with questions, distractors, and metadata. |
| Content Source Registry | Documented inventory of all approved data sources with license verification. See docs/CONTENT_STRATEGY.md. |
| Mastery Skin | Animated card back (WAN2.1 video) unlocked when a fact reaches Tier 2a+. Reverts to static art if FSRS retrievability decays below learned threshold. |
| Ascension Mode | Post-launch difficulty system. 20 stacking levels of increasing challenge. Unlocks after first successful run. |
| Campfire Pause | In-run pause screen showing run stats with resume/hub options. Saves run state. |
| Special Event | Post-boss reward event (Relic Choice, Card Transform, Deck Thin, Knowledge Spring, Mystery). |
| Push Notification | Local mobile notification for retention (streak risk, milestone, review due, win-back). Max 1/day. |
| Playtest Profile | JSON config defining simulated player behavior: accuracy curve, reading speed, strategy level, engagement pattern. In tests/playtest/profiles/. |
| Headless Playtest | Combat simulation using real game engine under Vitest + happy-dom. No browser/Phaser required. Driven by HeadlessCombatSimulator. |
| Issue Leaderboard | Ranked list of game design issues found by automated playtesting. Scored by severity × frequency × profile breadth. In data/playtests/leaderboard.json. |
| Study Preset | Named configuration selecting domains + subcategories for run pool building. Up to 10 per player. Managed in Deck Builder (Library tab). |
| Deck Builder | UI tab within the Library screen for creating and editing study presets. |
| Study Mode Selector | Hub dropdown near dungeon gate for choosing run topic: All Topics, saved presets, languages, or Build New Deck. |
| Mastery Scaling | Anti-cheat system that reduces rewards and shortens timers when a deck's mastery % is high, preventing easy-fact farming. |
| DeckMode | Type union representing the selected study mode: general (all topics), preset (saved configuration), or language. |
| Pool Size Warning | Pre-run alert when the selected study mode yields < 40 facts or < 25% unmastered facts. Disables rewards and leaderboard. |
