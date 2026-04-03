# Recall Rogue — Card Design Deep Research Brief

> **Purpose:** This document provides a complete picture of our card combat system, every existing card mechanic, synergy map, relic interactions, status effects, and design constraints. Use it to research and design X new cards that are creative, balanced, synergistic, and fresh.

---

## 1. GAME CONCEPT — What Makes This Different

Recall Rogue is a **card roguelite where every card is a knowledge fact**. Players answer quiz questions to power up their cards. This creates a unique dual-axis system that no other card game has:

- **Quick Play:** Tap a card to play it instantly at base power. No quiz. Costs 1 AP.
- **Charge Play:** Drag a card upward to trigger a quiz question. Costs 2 AP (1 base + 1 surcharge). Answer correctly = 3x power. Answer wrong = 0.7x power + combo break + 85% chance of spawning an Echo (ghost card).

**The core tradeoff:** With 3 AP per turn, you can Quick Play 3 cards OR Charge 1 + Quick 1. Charge is a gamble — massive power if you know the answer, wasted AP if you don't.

**Knowledge Chains:** Cards are assigned to one of 6 chain types (color-coded: Obsidian, Crimson, Azure, Amber, Violet, Jade). Playing consecutive cards of the same chain type builds a chain with escalating multipliers: 1.0x, 1.3x, 1.7x, 2.2x, 3.0x. This is multiplicative with Charge multipliers.

**Mastery System:** Cards level up (0-5) during a run. Correct Charge = +1 level, wrong Charge = -1 level (once per encounter per card). Level 5 cards auto-play without a quiz. Mastery resets each run.

**Echo Mechanic:** Wrong Charge answers have 85% chance to spawn an "Echo" — a ghost version of the card that can ONLY be played via Charge. Get it right = full power + massive FSRS learning bonus. Get it wrong = 0.5x power.

---

## 2. CARD TYPES (6 Categories)

Every card has a `cardType` that determines its combat role. Cards also have a `mechanicId` that determines their specific behavior within that type.

| Card Type | Role | Base Effect | Count in Current Pool |
|-----------|------|-------------|----------------------|
| **Attack** | Deal damage to enemy | 9 base damage | 6 mechanics |
| **Shield** | Gain block/armor | 6 base block | 7 mechanics |
| **Buff** | Enhance future plays | Varies | 4 mechanics |
| **Debuff** | Weaken enemy | Varies | 4 mechanics |
| **Utility** | Draw cards, cleanse, transform | Varies | 5 mechanics |
| **Wild** | Adaptive/copy effects | Varies | 3 mechanics |

**Total: 29 unique card mechanics** (24 Phase 1 live + 5 Phase 2 gated).

---

## 3. EVERY EXISTING CARD MECHANIC — Full Spec

### 3.1 Attack Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `strike` | Strike | 1 | 8 dmg | 24 dmg | 6 dmg | Basic attack | strike |
| `multi_hit` | Multi-Hit | 2 | 4x3 hits | 12x3 hits | 3x3 hits | Hits 3 times (secondaryValue=3) | multi |
| `heavy_strike` | Heavy Strike | 3 | 20 dmg | 60 dmg | 14 dmg | High cost, high reward. Max 3 per pool. | strike, heavy |
| `piercing` | Piercing | 1 | 6 dmg | 18 dmg | 4 dmg | Ignores enemy block | pierce |
| `reckless` | Reckless | 1 | 12 dmg | 36 dmg | 8 dmg | Self-damage of 3 HP | risk |
| `execute` | Execute | 1 | 6 dmg | 18 dmg | 4 dmg | +8 bonus damage when enemy below 30% HP | finisher |
| `lifetap` | Lifetap | 2 | 8 dmg | 24 dmg | 6 dmg | Heals 20% of damage dealt | lifetap |

### 3.2 Shield Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `block` | Block | 1 | 6 block | 18 block | 4 block | Basic shield | block |
| `thorns` | Thorns | 1 | 6 block | 18 block | 4 block | Also reflects 3 damage when hit | retaliate |
| `emergency` | Emergency | 1 | 4 block | 12 block | 3 block | DOUBLES if HP below 30% | emergency |
| `fortify` | Fortify | 2 | 7 block | 21 block | 5 block | Block persists into next turn | persistent_block |
| `brace` | Brace | 1 | 0 | 0 | 0 | Block equal to enemy's telegraphed attack value | brace |
| `overheal` | Overheal | 2 | 10 block | 30 block | 7 block | DOUBLES if HP below 50% | overheal |
| `parry` | Parry | 1 | 3 block | 9 block | 2 block | **Phase 2:** Also draws 1 card if enemy attacks | parry |

### 3.3 Buff Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `empower` | Empower | 1 | +50% | +75% | +35% | Next card deals X% more damage | buff |
| `quicken` | Quicken | 0 | +1 AP | +1 AP | +1 AP | Gain +1 AP this turn. Charge bonus: also draw 1 card. Max 2 per pool. | ap_gain |
| `focus` | Focus | 1 | -1 AP cost | -1 AP cost | -1 AP cost | Next card costs 1 less AP. Charge bonus: reduces 2 cards instead of 1. | focus |
| `double_strike` | Double Strike | 2 | Next ATK hits 2x | Next ATK hits 2x | Next ATK hits 2x | Next attack hits twice at full power. Charge bonus: also pierces. | double_strike |

### 3.4 Debuff Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `weaken` | Weaken | 1 | 2 stacks | 6 stacks | 1 stack | Apply weakness (-25% damage per stack) | weakness |
| `expose` | Expose | 1 | 1 stack | 3 stacks | 1 stack | Apply vulnerable (take +50% damage) | vulnerable |
| `hex` | Hex | 1 | 3 poison/3 turns | 8 poison/3 turns | 2 poison/3 turns | Poison deals damage per tick | poison |
| `slow` | Slow | 2 | Skip 1 action | Skip 1 action | Skip 1 action | Skips enemy's next defend/buff. Charge bonus: also applies 1 weakness. | slow |

### 3.5 Utility Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `cleanse` | Cleanse | 1 | Remove debuffs + draw 1 | Same | Same | Purges all player debuffs | cleanse |
| `scout` | Scout | 1 | Draw 2 | Draw 3 | Draw 1 | Card draw | draw |
| `recycle` | Recycle | 1 | Draw 3 | Draw 4 | Draw 2 | Card draw. Charge bonus: draw from discard pile instead of draw pile. | cycle |
| `foresight` | Foresight | 0 | Draw 2 | Draw 3 | Draw 1 | Free card draw. Charge bonus: reveals enemy's next intent. | foresight |
| `transmute` | Transmute | 1 | Transform 1 | Transform 1 | Transform 1 | **Phase 2:** Transforms weakest hand card to different type | transmute |
| `immunity` | Immunity | 1 | Absorb 8 dmg | Absorb 8 dmg | Absorb 8 dmg | **Phase 2:** Absorbs next damage instance up to 8 | immunity |

### 3.6 Wild Cards

| ID | Name | AP | Quick Value | Charge Correct | Charge Wrong | Special | Tags |
|----|------|----|-------------|----------------|--------------|---------|------|
| `mirror` | Mirror | 1 | Copy prev card | Copy prev card | Copy prev card | Copies previous card's full effect | copy |
| `adapt` | Adapt | 1 | Auto-choose | Auto-choose | Auto-choose | Becomes ATK, DEF, or Cleanse based on enemy intent | adapt |
| `overclock` | Overclock | 2 | 2x next card | 2x next card | 2x next card | **Phase 2:** Next card effect doubled | overclock |

---

## 4. PLAY MODES & VALUE SCALING

Every card has three value tracks:

| Play Mode | Multiplier | When Used |
|-----------|-----------|-----------|
| **Quick Play** | 1.0x base | Player taps card, no quiz |
| **Charge Correct** | ~3.0x base | Player answers quiz correctly |
| **Charge Wrong** | ~0.7x base | Player answers quiz incorrectly |

Additional multipliers stack multiplicatively:

| Multiplier Source | Values |
|-------------------|--------|
| **Combo (consecutive correct)** | 1.0x, 1.15x, 1.30x, 1.50x, 1.75x, 2.00x |
| **Knowledge Chain** | 1.0x, 1.0x, 1.3x, 1.7x, 2.2x, 3.0x |
| **Speed Bonus** | 1.5x (answer in first 25% of timer) |
| **Mastery Level** | Flat bonuses: +2/+4/+6/+8/+10 per level |
| **Tier Multiplier** | ~~T1=1.0x, T2a=1.3x, T2b=1.6x~~ **REMOVED** — all active tiers = 1.0x (no-op). T3=passive. Tiers affect quiz difficulty only, not damage. |
| **Vulnerable** | +50% damage taken by target |
| **Strength/Weakness** | +/-25% per stack |

**Maximum theoretical damage on a single card:**
Heavy Strike (60 base) x 2.0 combo x 3.0 chain x 1.5 speed x Vulnerable x Empower x Double Strike = absurd numbers. This is intentional and exciting.

---

## 5. AP ECONOMY

| Resource | Value |
|----------|-------|
| **Starting AP** | 3 per turn |
| **Max AP** | 5 per turn (with buffs) |
| **Quick Play cost** | 1 AP (always) |
| **Charge Play cost** | 2 AP (1 base + 1 surcharge) |
| **Quicken** | +1 AP this turn (0 AP to play) |
| **Focus** | Next card -1 AP cost |
| **Blood Price relic** | +1 AP per turn (cursed) |
| **Chain Momentum** | Correct Charge waives +1 surcharge on NEXT Charge that turn |

The AP system creates a critical tension: you have enough AP to do 3 small things or 1 big thing + 1 small thing. Cards that manipulate AP (Quicken, Focus, Capacitor relic) are inherently powerful because they break this constraint.

---

## 6. STATUS EFFECTS

| Effect | Stacking | Per-Tick | Duration | Modifier |
|--------|----------|----------|----------|----------|
| **Poison** | Additive value | Deals value as damage | Turns remaining | — |
| **Regen** | Additive value | Heals value | Turns remaining | — |
| **Strength** | Additive value | — | Turns remaining | +25% damage per stack |
| **Weakness** | Additive value | — | Turns remaining | -25% damage per stack |
| **Vulnerable** | Boolean check | — | Turns remaining | +50% damage taken |
| **Immunity** | — | Absorbs next poison tick | Turns remaining | — |

**Design space note:** Only 6 status effects exist. There's significant room for new ones (burn, freeze, bleed, stun, taunt, etc.) but each new status adds UI complexity. New cards that interact with existing statuses are lower-risk than cards requiring new statuses.

---

## 7. SYNERGY MAP — What Works With What

This is the existing explicit synergy network. The deep research agent should use this as the foundation and identify GAPS.

### 7.1 Attack Synergies
- **Empower** synergizes with: ALL attack cards (Strike, Heavy Strike, Multi-Hit, Reckless, Piercing, Execute, Lifetap)
- **Double Strike** synergizes with: ALL attack cards + Empower
- **Expose (Vulnerable)** synergizes with: ALL attack cards
- **Multi-Hit** benefits disproportionately from flat damage bonuses (each hit gets the bonus)

### 7.2 Defense Synergies
- **Block/Fortify/Thorns/Brace** form a defensive cluster
- **Emergency/Overheal** synergize with low-HP states (crossover with glass cannon builds)
- **Brace** synergizes with **Scout/Foresight** (knowing enemy intent makes Brace optimal)

### 7.3 Chain Synergies
- **Tag Magnet** (relic): +30% chance to draw same-chain cards
- **Resonance Crystal** (relic): Chain links beyond 2 draw extra cards
- **Chain Reactor** (relic): Chains of 2+ deal 6 splash per link
- **Echo Chamber** (relic): 2+ chain replays first card at 60%
- **Prismatic Shard** (legendary relic): All chain multipliers +0.5x

### 7.4 Knowledge/Quiz Synergies
- **Combo system**: Consecutive correct answers build multipliers
- **Memory Nexus** (relic): 3 correct Charges in encounter = draw 2 extra
- **Scholar's Crown** (relic): Tier-scaled Charge bonuses
- **Insight Prism** (relic): Wrong answers reveal correct + auto-succeed next time
- **Mirror of Knowledge** (legendary relic): Replay charged card at 1.5x

### 7.5 Identified Synergy Gaps (Opportunities for New Cards)
1. **No attack card synergizes with shields** — an attack that scales with current block?
2. **No card rewards having a full hand** — draw-heavy strategies have no payoff card
3. **No card punishes enemy for buffing** — counter-play to enemy buff/defend intents
4. **No discard-matters mechanic** — cards that get stronger based on discard pile size
5. **No exhaust-matters mechanic** — cards that benefit from permanently removed cards
6. **No multi-enemy considerations** — all combat is 1v1 (but multi-enemy is planned Phase 2)
7. **No cards that interact with the timer/speed** — speed bonus exists but no card enhances it
8. **Poison has limited support** — only Hex creates poison, Plague Flask/Festering Wound relics support it
9. **No "stance" or "mode" cards** — long-term state changes that alter playstyle for several turns
10. **Wild cards are underdeveloped** — only Mirror, Adapt, and Overclock exist

---

## 8. RELIC SYSTEM (Context for Card-Relic Synergies)

42 relics exist across 12 categories. New cards should consider how they interact with existing relics.

### 8.1 Relic Categories & Key Examples

| Category | Key Relics | New Card Opportunities |
|----------|-----------|----------------------|
| **Offensive** | Whetstone (+2 ATK), Combo Ring (+1 dmg on first Charge/turn) | Cards that trigger "on attack" effects multiple times |
| **Defensive** | Iron Shield (+2 block/turn), Aegis Stone (block carries, Thorns at 15), Thorn Crown (reflect at 15+ block), Bastion's Will (+75% Charged shield) | Cards that build/spend block as a resource |
| **Sustain** | Vitality Ring (+20 HP), Herbal Pouch (+8 HP post-combat), Last Breath (survive lethal), Phoenix Feather (resurrect once/run) | Cards that reward staying at low HP or recovering |
| **Chain** | Tag Magnet (+30% same-chain draw), Resonance Crystal (+1 draw per chain link >2), Chain Reactor (6 splash/link), Echo Chamber (replay first chain card at 60%), Prismatic Shard (all chains +0.5x) | Cards that START chains or EXTEND them |
| **Speed** | Adrenaline Shard (fast answer = AP refund), Quicksilver Quill (<2s = 1.5x), Time Warp (Surge: timer halved, 5.0x multiplier) | Cards that reward fast answers or punish slow ones |
| **Knowledge** | Memory Nexus (3 correct = draw bonus), Scholar's Crown (tier-scaled bonus), Insight Prism (wrong reveals correct), Domain Mastery Sigil (4+ same domain = +30%), Mirror of Knowledge (replay at 1.5x) | Cards that care about Tier, domain count, or mastery level |
| **Glass Cannon** | Volatile Core (+50% ATK, wrong Charge self-damages), Reckless Resolve (below 40% HP = +50% ATK), Crit Lens (25% crit chance) | High-risk high-reward cards |
| **Burst** | Overflow Gem (4+ AP spent = +75% to last card), Capacitor (store unused AP), Double Down (double-quiz for 5x) | Cards that reward saving up or big turns |
| **Poison** | Plague Flask (+2 poison tick, +1 duration), Festering Wound (3+ poison = +40% ATK), Toxic Bloom (Phase 2: poison death spreads) | More poison application cards, poison conversion |
| **Economy** | Gold Magnet (+30% gold), Merchant's Favor (+1 shop choice), Scavenger's Eye (+1 reward option) | Cards that generate gold or improve rewards |
| **Cursed** | Blood Price (+1 AP, -2 HP/turn), Scholar's Gambit (+1 slot, wrong hurts) | Cards with downsides that enable powerful strategies |
| **Echo** | Echo Lens (Echoes deal full power even on wrong) | Cards that interact with the Echo system |

---

## 9. ENEMY SYSTEM (Context for Counter-Play Design)

### 9.1 Enemy Intent Types
Enemies telegraph their next action each turn:
- **attack** — Deal X damage
- **defend** — Gain block
- **buff** — Gain strength or other self-buff
- **debuff** — Apply weakness/vulnerable/poison to player
- **heal** — Recover HP
- **multi_attack** — Hit X times for Y damage each
- **charge** — Powerful attack that bypasses damage cap

### 9.2 Enemy Categories
| Category | HP Range | Behavior |
|----------|----------|----------|
| Common | Low-Mid | Simple intent patterns |
| Elite | Mid-High | 2-3 intent types, some specials |
| Mini-Boss | High | Complex patterns, quiz phases possible |
| Boss | Very High | Multiple quiz phases, unique mechanics |

### 9.3 Boss Quiz Phases
Bosses pause combat at HP thresholds and force a quiz phase (3-6 rapid-fire questions). Correct answers drain boss HP or grant buffs. Wrong answers heal the boss or give it strength. This creates a natural "knowledge check" moment.

### 9.4 Enemy Regions (4 Segments x 6 Floors Each = 24 Total)
1. **Shallow Depths** (Floors 1-6) — Easy enemies, 12s quiz timer
2. **Deep Caverns** (Floors 7-12) — Moderate, 9s timer
3. **The Abyss** (Floors 13-18) — Hard, 7s timer
4. **The Archive** (Floors 19-24) — Brutal, 5s timer
5. **Endless** (Floor 25+) — Scaling, 4s timer

### 9.5 Enrage System
Enemies enrage after turn 6-9 (depending on segment), gaining escalating damage bonuses. This prevents infinite stalling and creates time pressure.

---

## 10. DECK BUILDING CONSTRAINTS

| Parameter | Value |
|-----------|-------|
| **Starter Deck** | 10 cards: 5 Strike, 4 Block, 1 Foresight |
| **Min Deck Size** | 5 (can't remove below this) |
| **Hand Size** | 5 cards per turn (6 with Swift Boots relic) |
| **Card Rewards** | 3 choices after combat (4 with Scavenger's Eye) |
| **Shop Cards** | 3 available per shop visit |
| **Rest Site** | Study option: +1 mastery to chosen card (no removal) |
| **Card Removal** | Shop service: 50g base + 25g per subsequent removal |
| **Upgraded Cards** | 10-40% chance by floor to see pre-upgraded rewards |

### 10.1 Card Tier System (SM-2 Derived)
| Tier | Power Mult | Quiz Format | Description |
|------|-----------|-------------|-------------|
| T1 | 1.0x | 3 options, forward only | New/learning cards |
| T2a | 1.3x | 4 options, reverse allowed | Active review |
| T2b | 1.6x | 5 options, fill-blank, close distractors | Advanced review |
| T3 | Passive | No quiz (auto-play) | Mastered — becomes passive buff |

### 10.2 Knowledge Domain Tags
Cards inherit domains from their source facts. 12 canonical domains:
- general_knowledge, natural_sciences, space_astronomy, geography, geography_drill, history, mythology_folklore, animals_wildlife, human_body_health, food_cuisine, art_architecture, language

Domains matter for: Domain Mastery Sigil relic, boss quiz phase targeting, and chain type assignment.

---

## 11. WHAT MAKES A GREAT CARD IN THIS GAME

### 11.1 Design Principles

1. **Knowledge interaction is king.** The best cards should reward or interact with the Charge/Quick Play decision. Cards that are equally good regardless of quiz performance are less interesting.

2. **AP tension matters.** Cards that cost 0 AP (like Quicken, Foresight) are inherently powerful. New 0-cost cards need careful balance. Cards that cost 3 AP need to be dramatically impactful.

3. **Chain synergy is underdeveloped.** The chain system is a unique differentiator. Cards that build, extend, reward, or interact with chains tap into underused design space.

4. **Risk-reward creates excitement.** Cards like Reckless (high damage + self-harm) and relics like Volatile Core create memorable decision moments. More cards with meaningful downsides would enrich the game.

5. **Combo enablers are valued.** Anything that helps string together more correct answers (card draw, AP generation, chain extension) enables the game's "flow state" and should be explored.

6. **Phase 2 should add complexity, not confusion.** New mechanics should layer onto existing ones, not replace them. A card that interacts with poison AND chains is better than one requiring a new status system.

7. **Mobile-first.** All cards need to be readable on a phone screen. Complex multi-step effects need clear, concise descriptions. If you can't explain it in under 15 words, simplify it.

### 11.2 Balance Guardrails

- **Quick Play values** should never exceed ~60% of Charge Correct values (preserving the Charge incentive)
- **0 AP cards** should be rare and their effects modest (Quicken and Foresight already exist at 0 AP)
- **Multi-Hit** cards with flat bonuses scale dangerously — each hit gets the full bonus
- **Exhaust (permanent removal)** is extremely powerful as a downside — use sparingly
- **Cards shouldn't obsolete existing cards** — Heavy Strike shouldn't make Strike pointless
- **Consider the starter deck** — new cards compete with Strike/Block/Foresight for slots
- **Max 0-3 of any mechanic per pool** — pool caps prevent degenerate strategies

### 11.3 Red Lines (Do NOT Design)

- No cards that skip quizzes entirely (undermines the core loop)
- No cards that feel mandatory (every card should be optional for a viable build)
- No cards that make Quick Play strictly better than Charge (Charge must always be rewarded)
- No cards with 4+ lines of rules text (mobile readability)
- No cards that require tracking state across multiple encounters (too complex)
- No cards that directly damage the player without offering compensating power (pure downside = feel-bad)

---

## 12. RESEARCH DIRECTIVES FOR THE DEEP RESEARCH AGENT

### 12.1 Games to Study

Research these games' card designs for inspiration, identifying mechanics that could translate to the knowledge-quiz system:

**Card Roguelites:**
- **Slay the Spire** — The gold standard. Study: stance system (Wrath/Calm), exhaust synergies, power cards vs attacks, Defect orb channeling, card-relic synergy depth
- **Monster Train** — Study: multi-floor combat, champion leveling, spell/monster distinction, Pyre defense
- **Inscryption** — Study: sacrifice mechanics, sigil system, card transformation, meta-progression
- **Balatro** — Study: poker hand scoring, joker synergies, how simple rules create deep strategy, the "edition" system
- **Nowhere Prophet** — Study: follower vs action cards, resource management in a roguelite
- **Ring of Pain** — Study: equipment-as-deck, positional mechanics
- **Vault of the Void** — Study: void card mechanic, purge synergies
- **Tainted Grail** — Study: two-deck system, card combos across types
- **Griftlands** — Study: negotiation as separate card game, reputation affecting card pool
- **Roguebook** — Study: dual-hero synergies, hex-grid exploration

**Traditional Card Games with Relevant Mechanics:**
- **Magic: The Gathering** — Study: mana curve theory, keyword soup, tribal synergies, "kicker" costs (extra cost for extra effect), instant vs sorcery timing
- **Hearthstone** — Study: Discover mechanic, Battlecry/Deathrattle triggers, Combo keyword (reward for playing multiple cards)
- **Legends of Runeterra** — Study: spell speed system, Landmarks (persistent effects), Allegiance (deck-building reward)
- **Marvel Snap** — Study: Location-based effects, On Reveal vs Ongoing, how 12-card decks create tight synergies
- **Dominion** — Study: deck-thinning as strategy, village/smithy engine building, action economy
- **Star Realms** — Study: faction synergies, scrapping for benefit, trade row management
- **Keyforge** — Study: house system (play cards of one house per turn = chain-like constraint), ÆMBER economy

**Knowledge/Quiz Games with Card Elements:**
- **Trivial Pursuit** — Category-based knowledge with strategic timing
- **Wits & Wagers** — Confidence as a betting mechanic
- **Half Truth** — Partial knowledge rewarded
- **Smart10** — Timed category knowledge

### 12.2 Specific Mechanics to Research and Adapt

1. **Stance/Mode System (Slay the Spire Watcher)** — Could we have cards that shift between Aggressive/Defensive/Neutral stances? What if stance affected the Charge bonus?

2. **Orb/Channel System (Slay the Spire Defect)** — Cards that create persistent floating effects (orbs) that trigger each turn. Could knowledge domains be "channeled" for ongoing bonuses?

3. **Exhaust Synergies (Slay the Spire Ironclad)** — Cards that WANT to be removed from the deck for bonus effects. "Exhaust this card: deal 20 damage." Cards that trigger when other cards exhaust.

4. **Retain/Hold Mechanic** — Cards that stay in hand between turns instead of being discarded. Creates hand-management decisions.

5. **X-Cost Cards** — Cards that consume ALL remaining AP for a scaling effect. "Deal 10 damage per AP spent."

6. **Condition Cards** — Cards whose effect depends on game state. "If your combo is 3+, deal double damage." "If enemy is poisoned, this also applies Vulnerable."

7. **Transform/Upgrade in Hand** — Cards that change into better versions when conditions are met during combat. "After 2 correct Charges, this Strike becomes a Mega Strike."

8. **Innate/Starting Hand** — Cards guaranteed to be in your opening hand. Powerful for build consistency.

9. **Ethereal/Temporary** — Cards that exhaust at end of turn if not played. Creates urgency and decisions.

10. **Combo Keyword (Hearthstone)** — Cards that gain bonus effects if another card was played first this turn.

### 12.3 Knowledge-Specific Mechanics to Explore

These don't exist in other card games because no other card game has quizzes:

1. **Streak Cards** — Cards that power up based on current correct-answer streak within the encounter
2. **Domain Specialist** — Cards stronger when played from a dominant domain in your deck
3. **Confidence Bet** — Pre-commit to a power level BEFORE seeing the quiz question
4. **Time Pressure** — Cards that reduce the quiz timer but increase the reward
5. **Knowledge Resonance** — Cards stronger when you've answered the same fact correctly multiple times in the run
6. **Echo Synergy** — Cards that specifically interact with Echo cards in the discard/draw pile
7. **Chain Breaker** — Cards that intentionally break a chain for a massive burst effect
8. **Quiz Modifier** — Cards that change the quiz format (fewer options, hint revealed, etc.)
9. **Wrong-Answer Conversion** — Cards that gain power from wrong answers (anti-synergy with combo, but opens new archetype)
10. **Mastery Accelerator** — Cards that grant +1 mastery to adjacent cards when played

### 12.4 Build Archetype Targets

New cards should support and expand these player archetypes:

| Archetype | Current Support | Needs |
|-----------|----------------|-------|
| **Chain Master** | 5 chain relics, chain multiplier system | More cards that START/EXTEND chains, chain payoff cards |
| **Glass Cannon** | Reckless, Volatile Core, Reckless Resolve, Crit Lens | More risk/reward attack cards, "berserker" identity |
| **Poison Tactician** | Hex only + 3 relics | Needs 2-3 more poison-applying/synergizing cards |
| **Fortress** | Block, Fortify, Thorns, Brace, Aegis Stone, Thorn Crown, Bastion's Will | Block-as-resource, damage-from-block |
| **Speed Demon** | Adrenaline Shard, Quicksilver Quill, Time Warp | Cards that reward fast answers directly |
| **Scholar** | Scholar's Crown, Domain Mastery Sigil, Memory Nexus | Cards that reward diverse knowledge, tier progression |
| **Burst/Combo** | Overflow Gem, Capacitor, Double Down | Cards that store energy and release in big turns |
| **Control** | Weaken, Expose, Slow | Needs more enemy-manipulation cards |
| **Draw Engine** | Scout, Recycle, Foresight, Swift Boots | Cards that reward having many cards in hand |
| **Wild/Adaptive** | Mirror, Adapt | Only 3 wild cards — this type needs expansion |

---

## 13. DELIVERABLE FORMAT

For each new card, provide:

```
### Card Name
- **Type:** attack/shield/buff/debuff/utility/wild
- **AP Cost:** 0/1/2/3
- **Quick Play Value:** [effect at base]
- **Charge Correct Value:** [effect when quiz answered correctly]
- **Charge Wrong Value:** [effect when quiz answered incorrectly]
- **Charge Bonus Effect:** [optional: special bonus only on Charge Correct]
- **Secondary Value:** [if applicable]
- **Tags:** [for synergy matching]
- **Max Per Pool:** [0 = unlimited, or cap]
- **Launch Phase:** 1 (available now) or 2 (future)
- **Description (max 15 words):** [what appears on the card]
- **Design Intent:** [why this card exists, what archetype it serves, what decision it creates]
- **Synergizes With:** [existing cards and relics it combos with]
- **Inspired By:** [reference game/mechanic if applicable]
- **Balance Notes:** [potential degenerate interactions to watch]
```

---

## 14. EVALUATION CRITERIA

Rate each card design against:

1. **Uniqueness (1-5):** Does it do something no existing card does?
2. **Synergy Depth (1-5):** How many existing cards/relics does it interact with?
3. **Knowledge Integration (1-5):** How much does it reward/interact with the quiz system?
4. **Decision Quality (1-5):** Does it create meaningful choices (not auto-include or auto-skip)?
5. **Readability (1-5):** Can you understand it in under 5 seconds on a phone screen?
6. **Build Enablement (1-5):** Does it enable a new archetype or strengthen an underdeveloped one?
7. **Fun Factor (1-5):** Would a player get excited to see this in their reward choices?

Aim for average 4+ across all criteria. Cards scoring below 3 on any criterion should be reworked.

---

## 15. QUANTITY & MIX

Suggest **20-30 new card mechanics** distributed roughly as:
- 5-7 Attack variants
- 3-5 Shield variants
- 3-4 Buff variants
- 3-4 Debuff variants
- 3-5 Utility variants
- 3-5 Wild variants

Include at least:
- 3 cards that are 0 AP cost
- 3 cards that are 3 AP cost
- 5 cards with meaningful downsides
- 5 cards that directly interact with the Knowledge Chain system
- 3 cards that interact with the Echo/wrong-answer system
- 2 "build-around" cards that define an entire archetype when drafted

---

*This brief is the complete reference. The deep research agent should treat it as the source of truth and design cards that feel native to this system while pushing creative boundaries.*
