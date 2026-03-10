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
  6. Enemy executes telegraphed attack (intent visible before player turn)
  7. Damage applied minus player's block
  8. Block resets to 0 (unless Fortress passive active)
  9. Next turn begins
```

### Fact-Card Shuffling (Per-Draw Randomization)

Card slots (type + mechanic + base effect) and facts (the questions to answer) are paired RANDOMLY each time a hand is drawn. The deck tracks card slots and facts as separate pools.

**Why:** Without shuffling, a known fact permanently bonded to a powerful mechanic (e.g., Heavy Strike 14 dmg) becomes a guaranteed nuke. Shuffling ensures every hand is unpredictable — you can't rely on always knowing the answer to your best card.

**How it works:**
1. At run start, `buildRunPool()` creates card SLOTS (type + mechanic) and a separate fact pool
2. Each `drawHand()` call draws N card slots from the draw pile
3. N facts are drawn from the fact pool (excluding cooldown facts)
4. Slots and facts are paired randomly
5. Tier multiplier (1.0x/1.3x/1.6x) follows the FACT, not the slot — mastered facts are still more powerful regardless of which card type they land on

**First-draw funScore bias:** On the very first encounter of a run (floor 1, encounter 1), fact assignment is weighted so facts with funScore >= 7 are 2x more likely to appear in the opening hand. This creates a strong first impression with the most engaging content. Subsequent draws use uniform random assignment.

**Applies to:** All cards (knowledge AND vocabulary).

### Encounter Cooldown

Facts answered in an encounter enter a 3-encounter cooldown. They cannot appear in the next 3 encounters, preventing the same fact from being used to one-shot consecutive enemies.

**Edge case:** If cooldown would exhaust the fact pool (available facts < hand size), cooldown reduces to 1 encounter. If available < 3, cooldown is disabled for that draw.

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

**Expert Mode (Scholar) override:** -2s from base per tier. Tier 2 cards require free recall (no multiple choice).

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

### Fact Domains (16 Total)

**Original domains (content exists):**
- General Knowledge — broad trivia, cross-domain surprising facts
- Natural Sciences — biology, chemistry, physics, earth science
- Geography — countries, capitals, landmarks, demographics
  - **Flags of the World** — Geography sub-domain: 200+ sovereign state flags as pixel art quiz cards
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

| Tier | Internal | Display Name | FSRS Trigger | Question Format | Power | Visual |
|------|----------|-------------|-------------|----------------|-------|--------|
| 1 | 1 | Learning | Stability <5d | 3-option MCQ, generous timer | 1.0x | Standard frame (bronze) |
| 2a | 2a | Proven | Stability 5-15d, 3+ correct | 4-option MCQ OR reverse format | 1.3x | Silver tint |
| 2b | 2b | Proven | Stability 15-30d, 5+ correct | 5-option close distractors OR fill-blank | 1.6x | Silver + glow |
| 3 | 3 | Mastered | Pass Mastery Trial | Not asked — passive relic | Permanent | Gold frame, relic tray |

**Display Simplification:** Players see only 3 tiers: **Learning** (bronze), **Proven** (silver), and **Mastered** (gold). Internal tiers 2a/2b are both displayed as "Proven" — the sub-tier distinction is invisible to players. This reduces cognitive load while preserving the FSRS-driven difficulty escalation under the hood. Functions `getTierDisplayName()` and `getDisplayTier()` in `tierDerivation.ts` handle this mapping.

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
3. **Content expansion:** 10K+ facts per domain at launch across 10 knowledge domains + 6 language packs. Years of content depth.
4. **Mastery Challenge events:** Rare Mystery room. Mastered fact, 3s timer, 5 distractors. Fail → Tier 2b, relic dormant
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

| Segment | Floors | Encounters/Floor | Bosses | Death Penalty |
|---------|--------|-----------------|--------|---------------|
| Shallow Depths | 1-6 | 3 (2 regular + 1 mini-boss) + events | Floor 3: "The Excavator", Floor 6: "Magma Core" | Die = keep 80% |
| Deep Caverns | 7-12 | 3 (2 regular + 1 mini-boss) + events | Floor 9: "The Archivist", Floor 12: "Crystal Warden" | Die = keep 65% |
| The Abyss | 13-18 | 3 (2 regular + 1 mini-boss) + events | Floor 15: "Shadow Hydra", Floor 18: "Void Weaver" | Die = keep 50% |
| The Archive | 19-24 | 3 (2 regular + 1 mini-boss) + events | Floor 21: "Knowledge Golem", Floor 24: "The Curator" (final) | Die = keep 35% |
| Endless | 25+ | Scaling | Boss every 3 floors (cycles through bosses) | Die = keep 35% |

Each floor has 3 encounters: encounters 1-2 are regular combat (common enemies), encounter 3 is always a mini-boss (or full boss on boss floors: 3, 6, 9, 12, 15, 18, 21, 24).

### Retreat-or-Delve Psychology

Kahneman & Tversky's prospect theory: loss aversion at ~2x. At 20% risk (Segment 1), most players push. At 65% risk (Segment 4), only confident players continue. Escalating risk matches escalating reward. Never exceed 65% loss — total wipeout causes quit behavior on mobile.

### Encounter Loop (Per Floor)

Each floor has 3 encounters with the following flow:
1. **Encounter 1** (regular enemy) → card reward → **room selection** (3 doors)
2. **Encounter 2** (regular enemy from chosen room) → card reward → **auto-start encounter 3** (no room selection)
3. **Encounter 3** (mini-boss on normal floors, full boss on boss floors) → card reward → floor transition
   - On boss floors: card reward → **special event** → **retreat-or-delve** checkpoint
   - On normal floors: advance to next floor → room selection for floor N+1

Room selection only appears between encounters 1→2 and between floors. Encounter 3 is always the floor's climactic fight.

### Room Selection

After encounters 1 and between floors, choose from 3 doors:

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

### Deck Building Strategy

**Starter Deck Size:** Runs begin with a lean deck of ~15 cards (down from 20). This creates meaningful choice around each reward and prevents the hand from becoming too bloated.

**Deck Evolution:** Players grow their deck after each encounter victory by choosing a card TYPE to add. Additionally, players can visit Shop rooms to:
- **Buy cards** with gold currency (add specific cards to deck)
- **Sell/remove cards** (thin the deck, gain currency)

This gives players three levers for deck building:
1. **Type selection after encounters** — Strategic reward choices
2. **Card purchasing at shops** — Intentional insertions
3. **Card removal/selling at shops** — Pruning weak cards

Combined, these create STS-style deck building agency: "I'm thinning junk and doubling down on my shield strategy" is a legitimate play pattern.

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
3. "Select" button appears at bottom
4. On select → chosen reward flies to deck/inventory, others fade to shadow
5. Each icon has subtle idle animation (bob, shimmer, glow pulse)

**Art assets required:** ~30 icon sprites (multiple variants per reward type), 4-5 altar surface backgrounds, cloth/mat overlay, spotlight effect.

### Encounter Termination

1. Enemy HP ≤ 0 → Victory + card reward (type selection screen)
2. Player HP ≤ 0 → Defeat, run ends with retreat penalties
3. Turn 15+ → Enemy +3 dmg/turn (soft enrage)

### Save/Resume System

Players can quit mid-run and resume later. Only ONE active run save at a time. Save state is stored in `localStorage` under key `recall-rogue-active-run`.

**Auto-save triggers:**
- After every encounter victory (before card reward)
- After card reward selection
- After room selection (before encounter starts)
- When player enters campfire/pause screen
- When app goes to background

**Resume flow:**
- On app startup, if an active run save exists, the Hub shows a "Run in progress" banner with Resume/Abandon buttons
- Resume restores full run state (floor, HP, deck, pool, relics, screen position)
- Abandon clears the save; FSRS progress is kept but run rewards are lost

**Save cleared on:** run end (victory, defeat, retreat, abandon)

### Campfire Pause Screen

A cozy pause screen accessible via a pause button (top-right corner) during combat and room selection.

**Displays:** Floor number, HP, deck size, relic count, accuracy percentage.

**Actions:**
- **Resume Run** — returns to the previous screen
- **Return to Hub** — saves run state and goes to hub (player can resume later)

### Special Events (Post-Boss)

After defeating a boss, the player receives a card reward and then faces a special event before the retreat-or-delve checkpoint.

| Event | Effect |
|-------|--------|
| Relic Forge | Choose 1 of 3 relic upgrades |
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
| Cave Bat | 19 | 6 (main), 9 (heavy) | Every turn. Teaches speed. |
| Crystal Golem | 38 | 9 every 2 turns, 13 (heavy) | Blocks on off-turns. Sustained damage. |
| Toxic Spore | 15 | 5 + poison | Low HP, DOT. Teaches healing. |
| Shadow Mimic | 24 | 7, copies last card | Punishes repetition. |

### Elites

| Enemy | HP | Special |
|-------|-----|---------|
| Ore Wyrm | 58 | Phase 2 doubles attack |
| Fossil Guardian | 45 | Immune to history domain |

### Mini-Bosses (Encounter 3 on non-boss floors)

| Enemy | HP | Damage | Behavior |
|-------|-----|--------|----------|
| Crystal Guardian | 35 | 8 | Golem variant, gains block per turn |
| Venomfang | 30 | 7 | Spider, applies poison on attack |
| Stone Sentinel | 40 | 9 | Tanky — low attack, high HP |
| Ember Drake | 32 | 10 | Glass cannon — high damage, low HP |
| Shade Stalker | 28 | 8 | Copies player's last played card type |
| Bone Collector | 36 | 7 | Heals 5 HP when player answers wrong |

### Bosses (Every 3rd floor)

| Boss | Floor | HP | Pattern |
|------|-------|-----|---------|
| The Excavator | 3 | 61 | 12 damage, escalating |
| Magma Core | 6 | 68 | 8 + poison, phase 2 eruption at 40% HP |
| The Archivist | 9 | 85 | 7 + shuffles hand, phase 2 at 50% HP |
| Crystal Warden | 12 | 90 | 12 damage, status immunity, counter + heal |
| Shadow Hydra | 15 | 110 | 14 damage, phase 2 at 50% HP doubles attacks |
| Void Weaver | 18 | 125 | 13 damage, hand disruption, debuffs |
| Knowledge Golem | 21 | 140 | 15 damage, +5 bonus on wrong answers |
| The Curator | 24 | 160 | 16 damage, all mechanics, phase 2 at 40% HP (final boss) |

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

| Internal ID | Display Name | Timer | Wrong Penalty | Enemy Dmg | Reward Multiplier |
|-------------|-------------|-------|--------------|-----------|-------------------|
| explorer | Story Mode | None | 50% effect | -30% | 1.00x |
| standard | Timed Mode | Dynamic (floor + question length) | Fizzle (costs 1 AP) | Normal | 1.00x |
| scholar | Expert Mode | -2s per tier, Tier 2 = free recall | Fizzle + 3 self-dmg | +20% | 1.20x |

**Story Mode forced for new players:** Run 1 automatically uses Story Mode (controlled by `STORY_MODE_FORCED_RUNS` in `balance.ts`). This ensures new players experience the game without timer pressure during their introduction. Difficulty selection in Settings is locked during this period. After 1 completed run, all modes unlock.

**Reward multipliers** are applied at run end via `DIFFICULTY_REWARD_MULTIPLIER` in `balance.ts`. Story Mode and Timed Mode earn standard rewards; Expert Mode earns a 20% bonus.

### Slow Reader Option

Adds flat +3 seconds to all timers. Timer bar color changes from red to amber (less stressful). Preserves urgency without panic. NOT Story Mode (which removes timers entirely). Can be changed in Settings anytime. (Previously asked during onboarding; now set exclusively in the Settings panel.)

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
3-10s:  First encounter (Story Mode forced for Run 1). Hand of 5. Tooltip: "Tap a card to examine it"
10-14s: Card rises with info overlay. Tooltip: "Tap again or swipe up to cast"
14-20s: Question panel appears above hand. Correct → juice stack. Wrong → gentle fizzle.
20-35s: Remaining AP. End Turn tooltip.
35-60s: Second encounter. Minimal tooltips.
~2-3m:  Run ends. "Create account to save progress?" (skippable).
Run 2:  Domain selection unlocks ("What are you curious about? Pick 2 to specialize in.").
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

1. **Correct + Fast Response (Runs 1-3 only):** Answer a question correctly AND within 50% of the allotted timer → count as 2 consecutive correct answers instead of 1. This doubled stability gain accelerates promotion to Tier 2a (5d+ stability).

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

### First-Person Dungeon Perspective

Combat and room exploration use a first-person viewpoint — the player character is not visible in dungeon scenes.

**Combat framing:**
- Upper ~55% of screen: first-person view of the room with the enemy/boss looming large, facing the player directly
- Lower ~45%: card hand and interaction area (unchanged)
- Enemies rendered at 2-3x current sprite scale, centered and menacing
- Boss encounters use even larger sprites with a dramatic zoom-in on room entry

**Room transitions:**
- Entering a new room triggers a fade-in from black (~400ms) for pacing and atmosphere
- Door/room selection presented as a first-person hallway with 2-3 visible doorways to choose from

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

---

## 21. Canary System (Invisible Adaptive Difficulty)

3+ wrong/floor: -2s timer, easier facts, -15% enemy dmg, hint more prominent. 5+ correct streak: tighter speed bonus, harder facts, elite variants.

Invisible. Never announced. Never reduces educational rigor (answer count, format unchanged). Only game difficulty flexes. Research: Hunicke (2005) — invisible DDA preserves flow state.

---

## 22. Language Learning Integration (Post-Launch)

**Status:** Language domains are hidden from the domain picker at launch (`ENABLE_LANGUAGE_DOMAINS = false` in `balance.ts`). Language content (Japanese N3-N5, etc.) exists in the facts database but is not selectable until the feature flag is enabled post-launch. This allows focus on knowledge domains for initial launch quality.

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

### Camp Hub & Cosmetic Progression

The between-runs hub is a camp scene near the dungeon entrance. Gold earned from runs is spent on purely visual upgrades.

**Camp elements** (each is a sprite slot at a fixed screen position):

| Element | Upgrade Tiers | Example Progression |
|---|---|---|
| Tent | 5 | Bedroll → canvas tent → leather tent → decorated tent → ornate pavilion |
| Seating | 4 | Log → wooden bench → cushioned bench → carved throne |
| Campfire | 4 | Small fire → stone pit → brazier → magical flame |
| Character | cosmetic | Outfit/armor visual variants |
| Pet | unlockable | Cat, owl, fox, dragon whelp (one active at camp) |
| Decorations | collectible | Boss trophies, banners, garden, bookshelves |

**Menu navigation** is integrated into the camp scene: tap the tent (inventory), campfire (start run), signpost (settings), character (profile).

**Technical model:** `campState = { tent: 3, seating: 2, fire: 1, pet: 'owl', decorations: ['boss_slime_trophy'] }` — each key maps to a sprite variant rendered at a fixed position. Upgrades are purely visual sprite swaps. State persists in player save data.

**Gold sink design:** Camp upgrades are the primary gold sink. Pricing scales exponentially per tier. No gameplay advantage — purely cosmetic progression that rewards consistent play.

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

**Share button** generates a Wordle-style card image: "I explored Depth 6 of Recall Rogue, answered 42 facts with 81% accuracy, and mastered 2 new concepts. How deep can you go?" Communicates achievement without spoiling content. Organic viral loop.

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

### Stratified Difficulty Sampling

Within each domain allocation, facts are sampled by difficulty to ensure a balanced challenge curve:

| Difficulty | Target % | Range |
|-----------|----------|-------|
| Easy (1-2) | 30% | 25-35% |
| Medium (3) | 45% | 40-50% |
| Hard (4-5) | 25% | 20-30% |

These are soft targets — if a domain lacks facts at a given difficulty, shortfalls backfill from medium first, then any remaining bucket. This prevents runs from being all-easy or all-hard regardless of domain content distribution.

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

### Scale

122 current → 10K+ per domain → 5K+ per language pack. All human-verified. All sourced.

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

## 33. Ascension Mode (Post-Launch Design)

**Status: Post-Launch — Implementation TBD (future AR phase).**

**Unlocks:** After first successful run completion (reach floor 9+ and retreat, or clear floor 24).

20 Ascension levels, each adds a permanent modifier. All previous levels stack:

| Level | Modifier | Effect |
|-------|----------|--------|
| 1 | Tougher Enemies | All enemies +10% HP |
| 2 | Aggressive Foes | All enemies +10% damage |
| 3 | Fewer Heals | Heal cards 25% less effective |
| 4 | Shorter Fuse | Timer -1s base on all questions |
| 5 | Thin Deck | Start with 12 cards instead of 15 |
| 6 | Iron Will | No flee from encounters |
| 7 | Harsh Grading | Close-distractor answers more common |
| 8 | Elite Surge | Mini-bosses gain boss-tier attacks |
| 9 | Combo Breaker | Combo resets on turn end (not just on wrong answer) |
| 10 | Endurance | Runs must reach floor 12+ to retreat with rewards |
| 11 | Fading Light | Encounter 2 per floor has -2s timer |
| 12 | Relic Tax | Max 8 relics instead of 12 |
| 13 | Deep Knowledge | All Tier 1 cards are 4-option MCQ (no easy 3-option) |
| 14 | Glass Cannon | Player max HP reduced to 70 |
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

- **Mastery Skins (Animated Card Backs):**
  Every card that reaches "Learned" state (Tier 2a+) unlocks a unique animated card back — a short looping animation generated with WAN2.1 (video diffusion model). This replaces the static pixel art cardback with a living, breathing scene. If the player's FSRS retrievability drops below the learned threshold (i.e., the fact decays back to Tier 1 due to missed reviews), the animated skin is lost and reverts to the static card back. Re-learning the fact re-unlocks the animation. This creates a powerful visual incentive loop: players SEE their knowledge literally come alive, and neglecting review causes their collection to visually decay. The transience makes mastery feel earned, not permanent — matching how real memory works.

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
| Retrievability | FSRS: current recall probability (0-1). Below 0.7 = due for review / relic dormancy. |
| Mastered | Fact that passed Mastery Trial. Becomes passive relic. |
| Passive Relic | Tier 3 card: permanent buff, no hand slot, can go dormant. |
| Echo | Ghost card from wrong answer. 70% reappearance chance. Reduced power. |
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
| Special Event | Post-boss reward event (Relic Forge, Card Transform, Deck Thin, Knowledge Spring, Mystery). |
| Push Notification | Local mobile notification for retention (streak risk, milestone, review due, win-back). Max 1/day. |
