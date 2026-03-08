# Terra Miner — Card Roguelite Design Specification

## For: Coding Agent Implementation
## Version: 1.0 — March 2026

---

## Executive Summary

Terra Miner is a mobile card roguelite where every card is a fact. Players answer questions to activate cards in turn-based combat encounters, build knowledge-powered decks, and descend deeper into procedurally generated mine floors. The game disguises spaced repetition learning (SM-2 algorithm) as addictive roguelite gameplay. Learning IS the core mechanic — not a wrapper around it, not an interruption to it.

**One-breath pitch:** "A card roguelite where every card is a fact — answer to attack, build your knowledge deck, and the more you learn, the deeper you go."

**Target audience:** All ages. Fact pools are age-gated and difficulty-scaled. A 10-year-old and a medical student use the same game engine with different content.

**Platform:** Mobile-first (iOS/Android) via Capacitor. Portrait mode. One-handed play.

**Tech stack:** Svelte 5 + Phaser 3 + TypeScript + Capacitor.

**Existing infrastructure to reuse (~90% of 595-file codebase):**
- Quiz engine with 3-pool system (Pool A: review-due, Pool B: discovery, Pool C: contextual)
- SM-2 spaced repetition algorithm and scheduling logic
- 522-fact database (expandable to 20,000+ facts, 5,000+ vocabulary per language)
- Artifact/loot system (rarity tiers, opening ceremonies)
- Balance constants and progression math
- Svelte UI layer and service architecture
- All TypeScript types, utilities, and shared infrastructure

**What gets replaced (~10% of codebase):**
- Grid mining renderer and fog of war
- Block-breaking mechanics
- Mine generator
- Dome hub UI

---

## Part 1: Core Design Philosophy

### The Golden Rule — Learning IS Gameplay

Every design decision must pass this test: **if you remove the educational content, does the game cease to function?**

- YES (correct): Without facts on cards, there are no cards. No cards, no combat. No combat, no game. Facts are structurally required. This is "intrinsic integration."
- NO (wrong): If you could replace facts with random button presses and the game still works, the learning is decorative. This is "chocolate-covered broccoli."

Reference: Habgood & Ainsworth (2011) demonstrated that intrinsic integration produced significantly more learning AND 7x longer voluntary play time than extrinsic quiz-overlay designs. A 2022 ACM follow-up (n=210) confirmed the mechanism is attentional — players process what the game task demands, so when learning IS the task, attention locks onto educational material automatically.

### The Anti-Prodigy Principle

Prodigy Math Game (150M+ users, ~$50M/yr revenue) uses quizzes as a toll gate to RPG combat. Result: observed children spend ~3 minutes on math per 20 minutes of play. 888 questions needed to raise a standardized test score by one point. Children optimize around the learning — shopping for pets, customizing avatars, doing anything except math.

Terra Miner inverts this. There is nothing to do EXCEPT engage with facts. Every card play, every deck-building choice, every reward selection involves a fact. The optimization path and the learning path are identical.

### Three Systems Only

The previous audit identified 17+ systems as catastrophic scope creep. Terra Miner ships with exactly three:

1. **Card Combat** — Turn-based encounters where playing cards requires answering facts
2. **Deck Building** — Selecting and evolving fact-cards between encounters
3. **Run Progression** — Floor-based descent with cash-out-or-continue risk/reward

Everything else (crafting, farming, companions, fossils, dome hub, prestige, etc.) is cut. These can be Year 2 features if the core loop retains players for 7+ days.

---

## Part 2: Core Game Loop — Card Combat

### Turn Structure

Each encounter follows this loop:

```
PLAYER TURN:
1. Draw hand of 5 fact-cards from draw pile
2. For each card, player can:
   a. TAP card → question appears
   b. ANSWER correctly → card effect activates (damage/shield/heal/buff)
   c. ANSWER incorrectly → card fizzles (discarded without effect)
   d. SKIP card → card discarded, no penalty, no effect
3. After all cards played/skipped, player turn ends

ENEMY TURN:
4. Enemy executes telegraphed attack pattern (visible to player before their turn)
5. Damage applied to player HP (minus any shields from correct answers)
6. Next turn begins (return to step 1)
```

### Card Anatomy

Each card has two faces:

**Front (visible in hand):**
- Card name (thematic, not the raw fact — e.g., "Crystalline Strike" not "What is the hardest mineral?")
- Card type icon (Attack / Shield / Heal / Utility)
- Effect value (e.g., "Deal 12 damage" / "Block 8" / "Heal 6")
- Difficulty indicator (1-3 stars, derived from SM-2 ease factor)
- Subject domain color (see Category System below)

**Back (revealed on tap):**
- The fact question
- Answer interface (multiple choice for Tier 1, expanded pool for Tier 2, free recall for Tier 3)
- Timer bar (floor-dependent, see Speed Scaling)

### Card Types Map to Subject Domains

This is critical for making deck building strategic. Subject domains are not decorative categories — they determine card function:

| Domain | Card Type | Effect | Strategic Role |
|--------|-----------|--------|----------------|
| Science & Nature | Attack | Deal damage | Primary damage source |
| History & Culture | Shield | Block incoming damage | Defensive plays |
| Geography & World | Utility | Draw extra cards, peek at enemy intent, manipulate deck | Tactical flexibility |
| Language & Vocabulary | Heal | Restore HP | Sustain for longer runs |
| Math & Logic | Buff | Increase next card's effect by X% | Combo enabler |
| Arts & Literature | Debuff | Reduce enemy attack, apply status effects | Control |
| Medicine & Health | Regeneration | Heal over multiple turns | Long-term sustain |
| Technology & Computing | Wild | Copies the effect of the previously played card | Versatility |

**Why this matters for learning:** A player who wants to survive longer runs NEEDS cards from multiple domains. "I need more shields" translates directly to "I should add History facts to my deck." The game incentivizes broad learning through mechanical necessity, not nagging.

### The Run-Start Category Selection System

At the beginning of each run, before entering the mine/tower:

```
SCREEN: "Prepare Your Expedition"

Step 1: SELECT PRIMARY DOMAIN (required)
  "Choose your specialty — these facts power your strongest cards"
  [Show 3-4 domain options based on player's unlocked content]
  Player picks ONE. This domain provides 40% of cards in the run.

Step 2: SELECT SECONDARY DOMAIN (required)
  "Choose your support — these facts fill out your deck"
  [Show remaining domains, excluding primary]
  Player picks ONE. This domain provides 30% of cards.

Step 3: REMAINING 30% — AUTO-FILLED
  The SM-2 scheduler fills the remaining 30% with facts DUE FOR REVIEW
  from ANY domain the player has previously engaged with.
  This is the invisible spaced repetition — the player doesn't choose these.
  They appear as "Wild Cards" or "Ancient Knowledge" thematically.
```

**Critical rule: Players NEVER see facts from domains they haven't opted into.** If a player has never selected Geography, Geography facts never appear. This respects the "people who don't want to learn geography don't have to" requirement.

**Exception:** The 30% SM-2 review pool only draws from domains the player has PREVIOUSLY selected in past runs. First-time players only see facts from their two chosen domains.

### Speed Scaling by Floor

Even mastered facts should challenge under time pressure on deeper floors:

| Floor | Timer | Effect |
|-------|-------|--------|
| 1-3 | 12 seconds | Generous, learning-friendly |
| 4-6 | 9 seconds | Moderate pressure |
| 7-9 | 7 seconds | Meaningful time constraint |
| 10-12 | 5 seconds | Speed recall required |
| 13+ (Endless) | 4 seconds | Expert-level pressure |

**Speed bonus:** Answering within the first 25% of the timer grants a 50% damage/effect bonus. This incentivizes fast, confident recall without punishing slower learners (they still get the base effect).

### Enemy Design

Enemies are thematic to the mining/underground setting and telegraph their attacks:

**Common enemies (1-2 per encounter):**
- Cave Bats — Low HP, fast attacks (2 damage/turn). Teach "answer quickly"
- Crystal Golems — High HP, slow attacks (hit every 2nd turn for 8). Teach "sustained damage"
- Toxic Spores — Low HP, poison (2 damage/turn for 3 turns). Teach "prioritize healing cards"
- Shadow Mimics — Copy the player's last card effect against them. Teach "vary your plays"

**Elite enemies (optional encounter, higher rewards):**
- Ore Wyrm — Multi-phase: phase 1 normal, phase 2 doubles attack
- Fossil Guardian — Immune to one domain type (forces diverse deck building)

**Bosses (end of each 3-floor segment):**
- Floor 3 Boss: "The Excavator" — predictable pattern, teaches boss mechanics
- Floor 6 Boss: "Magma Core" — escalating damage, tests sustained play
- Floor 9 Boss: "The Archivist" — shuffles your hand mid-combat, tests adaptability

**Art style note:** Enemies can be relatively simple — static 2D pixel art illustrations (like Slay the Spire's enemy art). No animation required beyond hit flash and death effects. This keeps solo-dev art scope manageable.

---

## Part 3: The Mastery Paradox — Three-Tier Card Evolution

**The problem:** Roguelites get harder as you go deeper. Education gets easier as you learn more. If mastered facts remain in the active hand, veteran players sleepwalk through runs.

**The solution:** Cards evolve through three tiers, and mastered cards graduate OUT of the active hand into passive power.

### Tier 1 — Learning Cards (New Facts)

- **Trigger:** Fact has been answered 0-2 times correctly
- **Question format:** 3-option multiple choice
- **Card power:** Base effect value (e.g., 8 damage)
- **Visual:** Standard card frame, no special decoration

### Tier 2 — Recall Cards (Familiar Facts)

- **Trigger:** Fact has been answered correctly 3-5 times, SM-2 interval > 3 days
- **Question format:** Expanded from 3 to 5 answer options, OR question format changes (forward → reverse, definition → term, etc.)
- **Card power:** 1.5x base effect (e.g., 12 damage)
- **Visual:** Silver border, subtle glow effect

### Tier 3 — Mastered Cards (Graduated to Passive)

- **Trigger:** SM-2 interval > 21 days (approximately 5+ consecutive correct answers across multiple sessions)
- **Question format:** No longer asked during combat
- **Card power:** Becomes a PASSIVE RELIC ABILITY — permanently active, no hand slot used
- **Behavior:** Mastered cards are removed from the active draw pile and placed in a "Mastered Knowledge" tray (visible but separate). Each provides a small permanent buff:
  - Mastered Attack fact → +1 damage to all attack cards
  - Mastered Shield fact → +1 block to all shield cards
  - Mastered Heal fact → +1 HP regeneration per turn
  - Mastered Utility fact → +5% chance to draw an extra card each turn
- **Visual:** Gold border, displayed in a separate UI area (like Slay the Spire relics)

### Why This Solves the Paradox

As players master facts:
1. Mastered cards leave the hand → hand refills with newer, harder facts
2. Passive buffs accumulate → player feels measurably stronger (reward for learning)
3. Active hand always contains UNMASTERED facts → challenge persists
4. Deeper floors introduce harder timer pressure → even Tier 2 facts become challenging
5. New domain content continuously enters the pool → the game never runs out of challenges

**The player literally cannot make the game trivially easy.** The better they learn, the more their active cards rotate to unknowns. The power growth from mastered-card passives keeps the "getting stronger" feeling without removing the challenge.

---

## Part 4: Preventing Exploitation — The Short-Term Memory Problem

**The problem:** After seeing a fact once in a run, players remember it for the rest of that run. If the pool is small, every subsequent appearance is a free win.

### Solution 1: Large Unique-Per-Run Pools

Each run draws from a pool of **80-120 unique facts** based on selected domains plus SM-2 review queue. With 5-card hands across ~10 encounters (9 normal + 1 boss), players see approximately 50-60 facts per run. This means ~40% of the pool never appears, preventing full memorization of the run's content.

### Solution 2: No-Repeat-Until-Cycled

**Slay the Spire draw pile model:** Once a fact-card is played (correctly or incorrectly) or skipped, it goes to the discard pile. The discard pile only shuffles back into the draw pile when the draw pile is empty. This means a fact appears AT MOST twice per run for most players (once in first cycle, once in reshuffle). Never back-to-back.

### Solution 3: Question Format Rotation

The same underlying fact should present differently on each appearance:

```
Fact: "Gold has atomic number 79"

Appearance 1: "The atomic number of gold is ___?" [79 / 47 / 26]
Appearance 2: "Which element has atomic number 79?" [Gold / Silver / Iron]
Appearance 3: "Au (gold) is located in what row of the periodic table?" [6 / 4 / 5]
Appearance 4: "True or false: Gold's atomic number is 79" [True / False]
```

**Implementation:** Each fact in the database needs 2-4 question variants stored as alternate templates. The system selects a variant the player hasn't seen recently (track last-used variant index per fact).

### Solution 4: Speed Scaling (Detailed Above)

Even if a player recognizes a fact from earlier in the run, floor 10+'s 5-second timer makes recall a genuine challenge. Knowing the answer and producing it under pressure are different cognitive tasks.

### Solution 5: Difficulty-Proportional Power

Harder facts (lower SM-2 ease factor) generate MORE powerful card effects:

| SM-2 Ease Factor | Difficulty Label | Effect Multiplier |
|-------------------|-----------------|-------------------|
| 2.5+ | Easy | 0.8x base |
| 2.0 - 2.49 | Medium | 1.0x base |
| 1.5 - 1.99 | Hard | 1.3x base |
| 1.0 - 1.49 | Very Hard | 1.6x base |

This means the optimal strategy is to SEEK OUT your weakest facts because those cards hit hardest. A player who only picks easy domains will have a weaker deck than one who challenges themselves.

---

## Part 5: Run Structure and Progression

### Floor Layout

Each run is a vertical descent into the mine. Floors are grouped into segments:

```
SEGMENT 1: Floors 1-3 (Tutorial/Easy)
  - 3 encounters per floor, 1 random event per floor
  - Boss at end of Floor 3
  → CASH-OUT CHECKPOINT: Bank rewards or continue

SEGMENT 2: Floors 4-6 (Medium)
  - 3 encounters per floor, 1-2 random events
  - Boss at end of Floor 6
  → CASH-OUT CHECKPOINT: Bank rewards or continue

SEGMENT 3: Floors 7-9 (Hard)
  - 3 encounters per floor, 2 random events
  - Boss at end of Floor 9
  → CASH-OUT CHECKPOINT: Bank rewards or continue

ENDLESS: Floor 10+ (Expert)
  - Scaling difficulty, no cap
  - Mini-boss every 3 floors
  - Rewards scale exponentially
  → CASH-OUT available after any floor
```

### Room Types (Slay the Spire Map Model)

Between encounters on each floor, players choose their path from 2-3 options:

- **Combat Room** (most common) — Standard enemy encounter, card rewards after victory
- **Treasure Room** — Free artifact or card reward, no combat
- **Mystery Room** — Random event (positive, negative, or choice-based)
- **Rest Room** — Heal 30% HP OR upgrade one card (increase its effect by 25%)
- **Shop Room** — Spend earned currency to buy specific cards, remove unwanted cards, or buy single-use items

### Cash-Out-or-Continue Risk/Reward

At each segment checkpoint:

```
SCREEN: "Surface or Descend?"

SURFACE (SAFE):
  - Keep 100% of all rewards earned this run
  - Cards, currency, artifacts banked permanently
  - Run ends

DESCEND (RISK):
  - Access to rarer facts, stronger card rewards, unique artifacts
  - IF YOU DIE: Keep a depth-scaled percentage of rewards:
    - Die in Segment 2: Keep 80%
    - Die in Segment 3: Keep 65%
    - Die in Endless: Keep 50%
  - Minimum floor: always keep at least 50% of rewards
```

**The psychology (from previous research):** Kahneman & Tversky's prospect theory shows loss aversion at ~2x. At 20% risk (Segment 2), most players will push. At 50% risk (Endless), only confident players continue. The escalating risk matches escalating reward, creating genuine tension. Never exceed 50% loss — total wipeout causes quit behavior in mobile players.

### Session Length Control

| Run Type | Floors | Estimated Time | Facts Reviewed |
|----------|--------|---------------|----------------|
| Quick Run | 3 floors (Segment 1 only) | 4-5 minutes | 15-25 facts |
| Standard Run | 6 floors (Segments 1-2) | 8-10 minutes | 30-50 facts |
| Deep Run | 9 floors (Segments 1-3) | 12-15 minutes | 50-75 facts |
| Endless | 10+ floors | 15+ minutes | 75+ facts |

Players select run type before starting. Quick Runs are the default for mobile sessions. Deep and Endless are unlocked after completing Standard.

---

## Part 6: Meta-Progression — Between Runs

### Permanent Progression Systems

**1. Knowledge Library**
- All facts the player has encountered are cataloged
- Organized by domain, with mastery status visible
- Functions as a review tool AND a collection to complete
- "Lore entries" expand when facts are mastered (brief contextual information)

**2. Mastered Knowledge Passives**
- Tier 3 mastered cards become permanent passive abilities (detailed in Part 3)
- These persist across all future runs
- Provide the "getting stronger over time" feeling that roguelites need

**3. Card Frame Cosmetics**
- Earned through milestones (master 50 facts, complete Floor 9, etc.)
- Purely visual — custom borders, particle effects on correct answers
- Monetizable (see Monetization section)

**4. Domain Unlocking**
- Players start with 2-3 domains available
- New domains unlock by mastering a threshold of existing facts (e.g., master 25 facts → unlock a new domain)
- Language packs are separate premium content (see Monetization)

### What There Is NOT

- No dome hub / overworld
- No farming, crafting, or companions
- No separate "study session" mode — ALL review happens inside runs
- No prestige / rebirth system at launch
- No energy/stamina gating — unlimited runs, always

---

## Part 7: The Fact Database Architecture

### Scale Planning

The system must support:
- 522 general knowledge facts at launch (existing)
- Expansion to 20,000+ facts across domains
- 5,000+ vocabulary cards per language pack
- Community-submitted facts (post-launch)

### Fact Schema

```typescript
interface Fact {
  id: string;                    // Unique identifier
  domain: FactDomain;           // Science, History, Geography, etc.
  subdomain?: string;           // "Chemistry", "Ancient Rome", "East Asia"
  
  // Age gating
  ageRating: 'all' | '10+' | '13+' | '16+' | '18+';
  
  // Difficulty
  baseDifficulty: 1 | 2 | 3 | 4 | 5;  // Inherent fact difficulty
  
  // Question variants (minimum 2, target 4)
  variants: QuestionVariant[];
  
  // Card mapping
  cardType: CardType;           // Attack, Shield, Heal, Utility, etc.
  baseEffectValue: number;      // Base damage/block/heal before modifiers
  
  // Metadata
  source?: string;              // Attribution for fact accuracy
  tags: string[];               // For filtering, searching
  createdAt: Date;
  verifiedAt?: Date;            // Human verification timestamp
}

interface QuestionVariant {
  questionText: string;
  correctAnswer: string;
  wrongAnswers: string[];       // Minimum 2, maximum 5
  format: 'multiple_choice' | 'true_false' | 'fill_blank' | 'reverse' | 'audio';
}

// For language learning specifically
interface VocabularyFact extends Fact {
  targetLanguage: string;       // 'ja', 'es', 'fr', etc.
  nativeWord: string;
  targetWord: string;
  reading?: string;             // For languages with non-Latin scripts (e.g., furigana)
  audioUrl?: string;            // Pronunciation audio
  exampleSentence?: string;
  partOfSpeech?: string;
  jlptLevel?: string;           // For Japanese: N5, N4, N3, etc.
  cefrLevel?: string;           // For European languages: A1, A2, B1, etc.
}
```

### Age Gating Implementation

```typescript
// Player profile stores age bracket (set during onboarding)
interface PlayerProfile {
  ageBracket: 'child' | 'teen' | 'adult';  // child=<13, teen=13-17, adult=18+
  // ...
}

// Fact filtering
function getEligibleFacts(profile: PlayerProfile): Fact[] {
  const allowedRatings = {
    child: ['all'],
    teen: ['all', '10+', '13+'],
    adult: ['all', '10+', '13+', '16+', '18+']
  };
  return allFacts.filter(f => allowedRatings[profile.ageBracket].includes(f.ageRating));
}
```

**Content examples by age rating:**
- `all`: "What planet is closest to the sun?" / "What is the capital of France?"
- `10+`: "What year did World War II end?" / Basic anatomy
- `13+`: "What is the pH of stomach acid?" / Historical wars with context
- `16+`: Advanced chemistry, economics, political science
- `18+`: Medical terminology, pharmacology, advanced topics

### SM-2 Integration with Card System

```typescript
interface PlayerFactState {
  factId: string;
  
  // SM-2 fields
  easeFactor: number;           // Default 2.5, minimum 1.3
  interval: number;             // Days until next review
  repetitions: number;          // Consecutive correct answers
  nextReviewDate: Date;
  lastReviewDate: Date;
  
  // Card tier (derived from SM-2 state)
  tier: 1 | 2 | 3;
  
  // Variant tracking
  lastVariantIndex: number;     // Prevent same question format twice in a row
  
  // Stats
  totalAttempts: number;
  totalCorrect: number;
  averageResponseTimeMs: number;
}

// Tier derivation
function getCardTier(state: PlayerFactState): 1 | 2 | 3 {
  if (state.interval >= 21 && state.repetitions >= 5) return 3;  // Mastered → passive
  if (state.interval >= 3 && state.repetitions >= 3) return 2;   // Recall
  return 1;                                                        // Learning
}
```

### Domain Partitioning for Performance

At 20,000+ facts, a single SM-2 queue becomes a performance concern on mobile. Partition:

```typescript
// Each domain maintains its own SM-2 scheduler
interface DomainScheduler {
  domain: FactDomain;
  facts: PlayerFactState[];
  
  // Get facts due for review in this domain
  getDueForReview(limit: number): PlayerFactState[];
  
  // Get new facts not yet encountered
  getNewFacts(limit: number): Fact[];
}

// Run initialization draws from selected domains
function buildRunPool(
  primaryDomain: FactDomain,    // 40% of pool
  secondaryDomain: FactDomain,  // 30% of pool
  allDomains: DomainScheduler[] // 30% from SM-2 review across all engaged domains
): Fact[] {
  const pool: Fact[] = [];
  
  // Primary: 48 facts (40% of 120)
  pool.push(...getPrimaryFacts(primaryDomain, 48));
  
  // Secondary: 36 facts (30% of 120)
  pool.push(...getSecondaryFacts(secondaryDomain, 36));
  
  // SM-2 Review: 36 facts (30% of 120) — only from previously engaged domains
  pool.push(...getReviewFacts(allDomains, 36));
  
  return shuffle(pool);  // Randomize order
}
```

---

## Part 8: Difficulty System

### Three Difficulty Layers (Independent, Stacking)

**Layer 1: Fact Difficulty (Inherent)**
Each fact has a base difficulty rating (1-5 stars) set during content creation:

| Rating | Description | Example |
|--------|-------------|---------|
| 1 star | Common knowledge | "What color is the sky?" |
| 2 stars | General education | "What is the capital of Japan?" |
| 3 stars | Informed knowledge | "What is the atomic number of gold?" |
| 4 stars | Specialist knowledge | "What enzyme breaks down starch?" |
| 5 stars | Expert knowledge | "What is the Krebs cycle's net ATP yield?" |

**Layer 2: Adaptive Difficulty (SM-2 Driven)**
The SM-2 ease factor personalizes difficulty per player per fact. A fact that's easy for one player (ease 2.8) is hard for another (ease 1.4). Card effect power scales inversely with ease factor (harder facts = stronger cards).

**Layer 3: Floor Difficulty (Progression)**
Timer pressure, enemy HP/damage, and number of encounters increase per floor. This is game difficulty, not knowledge difficulty.

### Difficulty Settings (Player-Selectable)

```
SCREEN: "Choose Difficulty" (in Settings, changeable anytime)

EXPLORER MODE:
  - No timer on answers
  - Wrong answers cost 50% of card effect (not total fizzle)
  - Enemy damage reduced by 30%
  - Best for: Young children, casual learners, accessibility
  - XP/rewards: 70% of normal

STANDARD MODE:
  - Timer active per floor scaling
  - Wrong answers = card fizzle (no effect)
  - Normal enemy stats
  - Best for: Most players
  - XP/rewards: 100%

SCHOLAR MODE:
  - Aggressive timer (2 seconds faster per tier)
  - Wrong answers = card fizzle + take 3 damage
  - Enemy damage increased by 20%
  - Tier 2 cards require free recall (no multiple choice)
  - Best for: Competitive learners, Anki power users
  - XP/rewards: 150%
```

---

## Part 9: Onboarding — First 60 Seconds

**Research basis:** Mobile users decide to keep an app within 7-30 seconds. Every successful mobile game puts core action first. Duolingo delays signup until AFTER the first lesson. Vampire Survivors has players killing enemies in 3 seconds.

### The First Run (No Signup Required)

```
SECOND 0-3:
  App opens directly to a stylized mine entrance.
  Large pulsing button: "ENTER THE MINE"
  Player taps. Immediate transition.

SECOND 3-8:
  First encounter starts. Player sees hand of 5 cards.
  Highlight on first card. Tooltip: "Tap a card to play it"
  Player taps.

SECOND 8-15:
  Question appears. 3 answers. Tooltip: "Answer correctly to activate the card!"
  Player answers. Correct → satisfying hit animation, damage numbers, screen shake.
  Wrong → gentle fizzle effect, "Almost!" text, card grays out.

SECOND 15-30:
  Player plays remaining cards. First enemy defeated.
  Reward: choose 1 of 3 new cards. Brief tooltip: "Add knowledge to your deck"

SECOND 30-60:
  Second encounter. No more tooltips. Player is playing.
  GAIA AI voice (1-2 lines max): "Good instincts, miner. Keep descending."
  
AFTER FIRST RUN (2-3 minutes):
  Run ends (player surfaces or dies at Floor 3 boss).
  "Create account to save progress?" (optional, can skip)
  
AFTER SECOND RUN:
  Domain selection unlocks. "Choose what you want to learn."
  This is where interest selection happens — AFTER the player is invested.
```

### Calibration for Knowledgeable Players

After the first run, offer an optional "Deep Scan" — a rapid-fire 20-question placement test across domains. Facts answered correctly are immediately placed at Tier 2 (skipping the easy learning phase). This prevents trivia enthusiasts from being bored by facts they already know.

---

## Part 10: The Wrong Answer Experience

### The Anti-Shame Design

Getting facts wrong must feel like a **learning opportunity, not a punishment.** This is critical for retention, especially with younger players.

**When a player answers incorrectly:**

1. Card fizzles with a SOFT visual (gray-out, gentle dissolve — NOT a harsh red X)
2. The correct answer is briefly displayed (2 seconds) with a subtle highlight
3. The fact is flagged in SM-2 as incorrect (ease factor decreases, interval resets)
4. NO additional damage beyond the card not activating — the enemy's normal turn attack is the only consequence
5. A "Miner's Journal" entry is created: "You'll remember next time: [correct answer]"

**What NEVER happens on wrong answer:**
- No screen shake or red flash directed at the player
- No "WRONG!" text
- No extra damage or penalty beyond the fizzle
- No loss of previously earned rewards
- No shame-inducing sound effects

### Hint System

Players can spend a resource ("Miner's Instinct," earned 1 per encounter) to:
- Remove one wrong answer from multiple choice (3 options → 2)
- Add 5 seconds to the timer for that question
- Reveal the first letter of the correct answer (for free recall)

This gives struggling players agency without removing the challenge.

---

## Part 11: Language Learning Integration

### How Vocabulary Cards Differ

Language facts require different interaction patterns than trivia:

```
TRIVIA CARD EXAMPLE:
  Front: "Tectonic Slam — Deal 10 damage"
  Question: "What causes earthquakes?"
  Answers: [Tectonic plates / Solar flares / Ocean currents]

VOCABULARY CARD EXAMPLE (Japanese N5):
  Front: "食べる Strike — Deal 8 damage"
  Question: Shows "食べる" with audio pronunciation button
  Answers: [to eat / to drink / to see]
  
  OR (Tier 2 reverse format):
  Question: "How do you say 'to eat' in Japanese?"
  Answers: [食べる / 飲む / 見る]
```

### Language-Specific UI Requirements

- **Audio playback button** on all vocabulary cards (text-to-speech or recorded audio)
- **Script display** for non-Latin languages (kanji with furigana option for Japanese)
- **Sentence context** shown after answering (brief example sentence using the word)
- **Production cards** at Tier 2+: Instead of recognition (select from options), require the player to type/draw the target word

### Language Pack Structure

```typescript
interface LanguagePack {
  language: string;             // 'Japanese', 'Spanish', etc.
  levels: LanguageLevel[];      // JLPT N5-N1, CEFR A1-C2, etc.
  totalVocabulary: number;      // e.g., 5000 for Japanese
}

interface LanguageLevel {
  name: string;                 // "JLPT N5", "CEFR A1"
  description: string;          // "Beginner — 800 essential words"
  vocabularyCount: number;
  facts: VocabularyFact[];
  unlockCriteria: {
    previousLevelMastery: number;  // e.g., master 80% of previous level
  };
}
```

---

## Part 12: Monetization

### Strategy: Free Core, Premium Expansion

**Research basis:** Vampire Survivors proved $5 premium works ($57M+ revenue). Duolingo proved freemium subscription works ($1B+ revenue). Rewarded ads have 76% player preference. Clash Royale proved reducing friction increases spending (removing time gates → 10x revenue increase).

### Free Tier (Always Available)

- Full card roguelite gameplay, unlimited runs
- 522 general knowledge facts across 3-4 starter domains
- All difficulty modes
- All core features
- Rewarded ads for bonus currency (opt-in only, never forced)

### One-Time Purchases

- **Ad Removal:** $4.99 — permanently removes all ads
- **Domain Packs:** $2.99 each — unlock specialized domains (Medicine, Advanced Chemistry, Computer Science, etc.)
- **Language Packs:** $4.99 each — full vocabulary set for one language (Japanese, Spanish, French, etc.)

### Terra Pass (Subscription): $4.99/month

- All domain packs included
- All language packs included
- Exclusive card cosmetics (monthly rotating frames)
- Progress analytics dashboard (mastery stats, learning velocity, domain breakdown)
- Family sharing (up to 5 profiles)
- Priority access to new content

### Cosmetic Store

- Card frames and back designs
- Encounter victory animations
- Mine theme skins (lava mine, ice mine, crystal mine)
- Character avatar customization
- **NEVER pay-to-win** — no purchasable card power, no buyable fact skips

### App Store Category

List as **Education (primary), Games (secondary).** The Education category has dramatically less competition for chart visibility while accessing a higher-growth market.

---

## Part 13: Edge Cases and Known Issues

### Issue 1: Card Homogeneity — "Every Turn Feels the Same"

**Risk:** If every card is "answer fact → deal damage," gameplay becomes monotonous.

**Solution:** Card type diversity (see Part 2 domain-to-type mapping) ensures hands contain mixed effects. Strategic decisions emerge: "Do I play my Science attack card for damage, or my History shield card to survive the boss's next hit?" The fact CONTENT varies, but the strategic DECISIONS vary too.

### Issue 2: Knowledgeable Player Boredom in Early Game

**Risk:** A trivia enthusiast who knows 80% of starter facts finds early runs tedious.

**Solution:** The Calibration Deep Scan (see Onboarding) places known facts at Tier 2 immediately. Combined with difficulty-proportional power (easy facts = weaker cards), knowledgeable players are incentivized to seek harder domains where their cards hit harder.

### Issue 3: The "I Already Mastered Everything" Endgame

**Risk:** After 6 months, a dedicated player has mastered thousands of facts. What's left?

**Solutions stacking:**
1. New content drops (domain packs, language packs) continuously add facts
2. Endless mode with leaderboards provides competitive endgame
3. Community fact packs (user-generated content, moderated)
4. "Scholar Challenges" — weekly curated runs with specific domain constraints and leaderboards
5. Tier 3 mastered facts can "decay" if not reviewed for 90+ days (SM-2 natural interval regression), re-entering the active pool as Tier 2

### Issue 4: Multiplayer/Competitive Balance

**Risk:** In any future PvP mode, players with more mastered facts have strictly stronger decks.

**Solution:** PvP modes (if added post-launch) normalize card power and compete on speed/accuracy only. Alternatively, matchmaking by total mastery level creates fair brackets. This is a post-launch concern — do not build for it now.

### Issue 5: Content Accuracy at Scale

**Risk:** At 20,000+ facts, errors undermine trust in the learning system.

**Solution:**
- All facts require a `verifiedAt` timestamp before entering the live database
- Community-submitted facts enter a "Provisional" state (marked visually) until verified
- Implement a "Report Error" button on every card (tap-and-hold → "This fact seems wrong")
- AI-generated facts ALWAYS flagged for human review before going live

### Issue 6: The Study Session Ghost

**Risk:** The previous design had a separate "Study Session" mode. Players might expect one.

**Solution:** There is NO separate study session in this design. All review happens inside runs. The SM-2 scheduler determines which facts appear during gameplay. If a fact is due for review, it surfaces as a card in the player's next run. This eliminates the "homework" feeling entirely. The run IS the study session.

If players want to deliberately review specific facts, the Knowledge Library provides a Lore-reading experience (browse mastered facts, read context) — but it does NOT function as a flashcard drill. The game is the drill.

### Issue 7: Streak System (Duolingo's #1 Retention Tool)

**Implementation:** Track consecutive days with at least 1 completed run. Display streak prominently on home screen. Streak milestone rewards: 7 days → card frame, 30 days → rare artifact, 100 days → exclusive cosmetic, 365 days → legendary cosmetic. Streak freeze available (1 per week, earnable or purchasable) to prevent devastating loss.

### Issue 8: Session Persistence

**Risk:** Mobile players get interrupted mid-run (phone call, app switch, etc.).

**Solution:** Save game state after every encounter. If the app is closed mid-run, resume exactly where the player left off. Never lose progress. Runs should survive app closure for at least 24 hours.

---

## Part 14: Technical Architecture Notes

### What Transfers from Existing Codebase

| System | Transfer Status | Notes |
|--------|----------------|-------|
| Quiz Engine (3-pool) | 100% reuse | Pool A = SM-2 review, Pool B = new facts, Pool C = domain-contextual |
| SM-2 Algorithm | 100% reuse | Add tier derivation logic on top |
| Fact Database (522 facts) | 100% reuse | Extend schema with card type mapping |
| Artifact/Loot System | 90% reuse | Artifacts become run rewards, not mine pickups |
| Balance Constants | 80% reuse | Retune for card effect values |
| Svelte UI Layer | 70% reuse | New card rendering components needed |
| TypeScript Types | 90% reuse | Extend with card-specific types |
| Service Architecture | 100% reuse | API patterns, state management, persistence |

### What Needs Building

| System | Estimated Scope | Priority |
|--------|----------------|----------|
| Card rendering (hand, play, fizzle animations) | Medium | P0 — Core |
| Turn-based encounter engine | Medium | P0 — Core |
| Enemy system (HP, attack patterns, telegraphing) | Medium | P0 — Core |
| Floor/room navigation (map screen) | Small-Medium | P0 — Core |
| Card reward/shop screen between encounters | Small | P0 — Core |
| Deck management UI | Small | P0 — Core |
| Run-start domain selection | Small | P0 — Core |
| Mastery tier system (Tier 1→2→3 evolution) | Small | P1 — First Update |
| Cash-out-or-continue screen | Small | P1 — First Update |
| Knowledge Library / collection view | Medium | P1 — First Update |
| Streak system | Small | P1 — First Update |
| Endless mode | Small | P2 — Post-Launch |
| Cosmetic store | Medium | P2 — Post-Launch |
| Language pack support | Medium | P2 — Post-Launch |
| Leaderboards | Medium | P3 — Growth Phase |

### Prototype Milestone (Target: 3-5 Days)

The minimum testable prototype includes:
- Hand of 5 cards with tap-to-select, answer-to-play
- 3 encounters on 1 floor + 1 boss fight
- 50 facts from existing database mapped to card types
- Basic enemy with telegraphed attacks
- 1 card reward screen between encounters
- No meta-progression, no map, no cosmetics, no shop

**Kill metric:** Does the prototype produce >2x the voluntary fact-review volume per minute compared to raw flashcard drilling? If yes, proceed. If no, evaluate whether the issue is mechanical (fixable) or fundamental (pivot to refined mining fallback).

**Retention targets for soft launch:**
- Day 1: 40-45% (card roguelite novelty + educational curiosity)
- Day 7: 18-22% (proves core loop engagement)
- Day 30: 8-12% (proves long-term retention)

---

## Part 15: The Competitive Moat

No commercial game currently combines spaced repetition with card roguelite mechanics. This is confirmed by academic literature: a peer-reviewed IEEE paper specifically notes SM-2 integration with learning games "has yet to be implemented at scale." A 2023 SciTePress analysis found roguelites are "well-adapted" for declarative knowledge training due to procedural generation, replayability, and adaptive difficulty.

**Terra Miner's defensible advantages:**
1. First mover in "educational card roguelite" category
2. SM-2 integration creates a data flywheel (player performance improves both scheduling and content selection)
3. Cross-disciplinary expertise barrier (pedagogy + game design + learning science + card game balance)
4. Content depth across domains (expandable to 20,000+ facts + language packs)
5. Community content pipeline creates network effects

**Reference games proving the market:**
- Slay the Spire: 2-person team, $200M+ revenue, proved card roguelite format
- Balatro: Solo developer, 5M+ copies, proved solo-dev card roguelite viability
- Duolingo: Proved gamified spaced repetition reaches 500M+ users
- DragonBox: Proved intrinsic integration achieves 93% mastery rates
- Prodigy Math: Proved educational games can generate $50M+/year (but with inferior integration)

---

## Appendix A: Glossary for Coding Agent

| Term | Definition |
|------|-----------|
| Fact | A single piece of knowledge with question variants and card mapping |
| Card | A playable game entity powered by a Fact — has a type, effect value, and tier |
| Tier | Card evolution stage (1=Learning, 2=Recall, 3=Mastered/Passive) |
| Domain | A subject area category (Science, History, Geography, Language, etc.) |
| Run | A single playthrough session — enter mine, descend floors, surface or die |
| Floor | One level of the mine containing 3 encounters and optional events |
| Segment | A group of 3 floors ending in a boss + cash-out checkpoint |
| Encounter | A single combat event: player plays cards vs. one enemy |
| Hand | The 5 cards drawn from the draw pile for the current turn |
| Draw Pile | The shuffled deck of fact-cards for the current run |
| Discard Pile | Played/skipped cards; reshuffled into draw pile when draw pile empties |
| Fizzle | When a card is answered incorrectly — no effect, card discarded |
| Cash-Out | The choice to end a run and bank rewards at a checkpoint |
| SM-2 | The SuperMemo 2 spaced repetition algorithm scheduling fact reviews |
| Ease Factor | SM-2 value (1.3-2.5+) representing how easy a fact is for the player |
| Interval | SM-2 value — days until a fact should be reviewed again |
| Mastered | A fact with SM-2 interval > 21 days and 5+ consecutive correct answers |
| Passive | A Tier 3 mastered card that provides permanent buffs without hand slots |
| Calibration | Optional rapid-fire test placing known facts at higher tiers |
| Deep Scan | The calibration test during onboarding |

## Appendix B: File Structure Suggestion

```
src/
├── lib/
│   ├── game/
│   │   ├── card/
│   │   │   ├── Card.ts              // Card entity
│   │   │   ├── CardRenderer.svelte  // Card visual component
│   │   │   ├── Hand.ts              // Hand management
│   │   │   └── DeckManager.ts       // Draw pile, discard, shuffle
│   │   ├── combat/
│   │   │   ├── Encounter.ts         // Turn loop, enemy AI
│   │   │   ├── Enemy.ts             // Enemy types, attack patterns
│   │   │   └── CombatScene.ts       // Phaser scene for encounters
│   │   ├── run/
│   │   │   ├── RunManager.ts        // Floor progression, room selection
│   │   │   ├── FloorMap.svelte      // Room choice UI
│   │   │   └── CashOut.svelte       // Surface or descend screen
│   │   └── meta/
│   │       ├── MasteryManager.ts    // Tier evolution, passive tracking
│   │       ├── KnowledgeLibrary.svelte  // Fact collection view
│   │       └── StreakTracker.ts     // Daily streak logic
│   ├── quiz/                        // EXISTING — reuse entirely
│   │   ├── QuizEngine.ts
│   │   ├── SM2Scheduler.ts
│   │   └── FactDatabase.ts
│   ├── domain/
│   │   ├── DomainSelector.svelte    // Run-start domain pick
│   │   ├── DomainScheduler.ts       // Per-domain SM-2 queues
│   │   └── RunPoolBuilder.ts        // Build 120-fact pool for run
│   ├── artifacts/                   // EXISTING — adapt for run rewards
│   └── ui/                          // EXISTING — extend
├── data/
│   ├── facts/                       // Fact JSON files by domain
│   ├── enemies/                     // Enemy stat definitions
│   └── balancing/                   // Effect values, scaling curves
└── types/                           // EXISTING — extend with card types
```

---

*End of specification. This document should provide everything needed to begin implementation. Start with the prototype milestone (Part 14) — 5 cards, 3 encounters, 1 boss, 50 facts. Validate the core loop before building any meta-progression.*
