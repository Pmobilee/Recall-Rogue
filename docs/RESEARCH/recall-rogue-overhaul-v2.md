# Recall Rogue — Overhaul Design Document (v2 — Consolidated)

> **One-line summary:** Card roguelite where knowledge IS power — Quick Play cards for base effect, Charge them with quiz answers for massive multipliers, chain related facts for exponential damage. The more you know, the stronger you become.

---

## 1. Core Philosophy (Revised)

### The New Golden Rule

**If you remove the quiz mechanic, the game still functions — but at dramatically reduced power.** You CAN beat easy content without Charging. You CANNOT beat deep floors or bosses without Charging consistently. The optimization path and the learning path converge at high play.

This is intrinsic integration through INCENTIVE, not through GATE. The old model (quiz on every card play) made learning a toll. The new model makes learning a power multiplier.

### Three Systems Only (Unchanged)

| # | System | Purpose |
|---|--------|---------|
| 1 | Card Combat with Charge | Turn-based; Quick Play for base, Charge for quiz-powered burst |
| 2 | Deck Building with Chains | Select and evolve fact-cards; chain related facts for multipliers |
| 3 | Run Progression | 3-act dungeon descent with escalating quiz pressure |

---

## 2. The Charge System (Core Innovation)

### Two Ways to Play Every Card

**Quick Play (tap popped card):** Card plays instantly at base power. No quiz. Fast, snappy, 200ms animation. The default combat action.

**Charged Play (fling upward past threshold):** Costs **+1 AP** on top of the card's base cost. Quiz triggers. Correct = card plays at **3.0x base power**. Wrong = card plays at **0.7x base power**. This is the risk/reward core.

### Why This Works

- **Quick Play is always safe and efficient.** 3 Quick Strikes = 24 damage for 3 AP = 8 damage/AP.
- **Charging is powerful but expensive.** 1 Charged Strike = 24 damage for 2 AP = 12 damage/AP (if correct). But you only played 1 card instead of 3, leaving you more vulnerable and with fewer chain opportunities.
- **Wrong Charged answers hurt but don't brick.** 0.7x × 8 = 5.6 damage AND you spent 2 AP. Worse than Quick Play in every way. Players learn to only Charge facts they're confident about.
- **The +1 AP cost prevents "always Charge everything."** With 3 AP, you can Quick Play 3 cards OR Charge 1 + Quick 1. Meaningful tradeoff every turn.

### Charge Scaling with Mastery Tier

| Tier | Display | Quick Play | Charged (Correct) | Charged (Wrong) | Charge AP Cost |
|------|---------|------------|-------------------|-----------------|----------------|
| 1 | Learning | 1.0x | 2.5x | 0.6x | +1 AP |
| 2a | Proven | 1.0x | 3.0x | 0.7x | +1 AP |
| 2b | Proven+ | 1.0x | 3.5x | 0.7x | +1 AP |
| 3 | Mastered | 1.2x (always) | Auto-Charged, no quiz | N/A | +0 AP (free) |

**Tier 3 Mastered cards permanently play at 1.2x with no quiz and no AP surcharge.** This is the ultimate learning payoff — mastered facts are both stronger AND more efficient. Players literally feel their knowledge becoming power.

### Charge Gesture (Touch UX)

| Action | Gesture | Result |
|--------|---------|--------|
| Inspect card | Tap card in hand | Card pops up, shows full stats |
| Quick Play | Tap popped card | Instant play at 1.0x, no quiz |
| Charge Play | Drag/fling card upward | Progressive charge, quiz on release |
| Cancel | Release below threshold | Card returns to hand |

**Fling-up progression:**
- **0-40px drag:** Card follows finger. Info overlay appears (existing behavior).
- **40-80px drag:** Golden charge glow begins building. "CHARGE" text fades in. Card scales to 1.15x.
- **80px+ drag:** Green "ready to charge" glow pulses. Release here = quiz triggers.
- **Release below 40px:** Card returns to hand. No action taken.

**Mouse (desktop):** Same drag-upward mechanic with pointer events.

**Why not hold-to-charge:** Conflicts with existing tap-to-inspect. Accidental charges would feel terrible. The fling is deliberate, satisfying ("pull back the slingshot"), and impossible to trigger accidentally.

### When Quizzes Happen (All Curated Moments)

| Context | Trigger | Quiz Count | Stakes |
|---------|---------|------------|--------|
| Charged card play | Player flings card up (+1 AP) | 1 per charge | 3.0x correct / 0.7x wrong |
| Knowledge Surge turn | Every 3rd turn, charge = free (+0 AP) | 2-4 per surge | Same multipliers, no AP cost |
| Boss Quiz Phase | At 50% and/or 33% boss HP | 5-8 per phase | Direct boss damage / player buffs |
| Rest Site: Study | Player chooses Study action | 3-5 | Each correct upgrades a deck card |
| Shop: Haggle | Before each purchase | 1 | Correct = 30% discount |
| Elite encounters | Elite special ability | Varies | Enemy-specific pressure |
| Mystery room: Challenge | Optional gauntlet | 5-10 | Bonus rewards for performance |

**Estimated quizzes per 25-min run:** 45-70 (vs 150+ in old every-card system). Each one deliberate, high-stakes, full-attention.

---

## 3. Knowledge Chain System

### How It Works

Facts have existing `categoryL2` values (e.g., `asian_cuisine`, `mammals`, `planets_moons`, `japanese_n5`). When you play cards consecutively within the same turn that share a `categoryL2`, they form a chain. Each card in the chain gets a multiplier.

**No new tagging required.** The ~50 existing categoryL2 values across all domains are the chain groups.

### Chain Multipliers

| Chain Length | Multiplier | Visual Feedback |
|-------------|-----------|-----------------|
| 1 (no chain) | 1.0x | Normal play |
| 2-chain | 1.3x | Subtle glow, thin line connecting cards |
| 3-chain | 1.7x | Bright glow, particle trail, chain sound |
| 4-chain | 2.2x | Screen edge pulse, chain lightning VFX |
| 5-chain | 3.0x | Full celebration, screen shake, "KNOWLEDGE CHAIN!" text |

**Chain multiplier stacks with Charge multiplier.** Examples:

| Scenario | Calculation | Total |
|----------|-------------|-------|
| 3-chain Quick Play Strikes | 8 × 1.7 = 13.6 per card | 40.8 total |
| 3-chain, middle card Charged (correct) | 8, 24×1.7, 8×1.7 = 8 + 40.8 + 13.6 | 62.4 total |
| 3-chain all Charged on Surge turn | 24 × 1.7 each = 40.8 per card | 122.4 total |

That 122 damage Surge chain is the "holy shit" peak. Happens rarely. Players will chase it.

### Chain Examples by Content Type

**Mixed knowledge deck (Geography + History):**
- "Mount Fuji is Japan's highest peak" — categoryL2: `asia_oceania`
- "Tokyo was formerly called Edo" — categoryL2: `asia_oceania`
- "The Meiji Restoration began in 1868" — categoryL2: `asia_oceania`
→ 3-chain on `asia_oceania`

**Single domain — Japanese N5 vocabulary:**
- 食べる (taberu, to eat) — categoryL2: `japanese_n5`
- 飲む (nomu, to drink) — categoryL2: `japanese_n5`
- おいしい (oishii, delicious) — categoryL2: `japanese_n5`
→ 3-chain on `japanese_n5`

**For vocabulary with semantic bins:** Vocabulary facts can have a secondary chain group from their semantic bin (food, family, verbs, etc.). Two Japanese words both tagged `food` chain even if one is N5 and one is N4. This is a field copy from existing semantic bin data, not new generation.

### Chain Visual Indicators

**Frame edge tint:** Each categoryL2 maps to one of ~12 distinct colors. Cards show a subtle 2-3px colored tint on their left frame edge (the part visible in the fan overlap). Same color = chains together.

**Placement:** Top-left area of the card frame, visible even when cards overlap in the fan. The existing AP gemstone badge stays; the chain color appears as a tint on the card's outer frame border.

**When two+ cards in hand share a categoryL2:** Their tinted edges gently pulse in sync. Subtle enough to not distract, visible enough to notice.

**During chain play:** A thin glowing line briefly connects played cards as they resolve. Purely animation, not persistent UI.

### Facts Still Randomly Assign Per Encounter

Card mechanics (Strike, Block, etc.) pair with random facts each hand draw. A Strike might be `asian_cuisine` (green tint) in one encounter and `planets_moons` (blue tint) in the next. This means:
- Every hand is a fresh chain puzzle
- Players must READ their hand each turn
- Educational breadth is preserved
- No "my Strike always chains with my Block" memorization

---

## 4. Knowledge Surge (Every 3rd Turn)

### Rhythm: Normal → Normal → SURGE → Normal → Normal → SURGE

On Surge turns, **Charging costs +0 AP** instead of +1. This is the burst window where Charging everything is viable and encouraged.

### Surge Announcement (0.5s, non-interruptive)

| Phase | Duration | Effect |
|-------|----------|--------|
| Flash | 0.15s | Screen edges pulse warm golden/amber once |
| Label | 0.3s | AP counter briefly shows "SURGE" text replacing the number |
| Sound | 0.3s | Low satisfying bass thrum (power-up hum, not explosion) |
| Persist | Full turn | Cards glow golden (vs normal green). AP area shows lightning bolt icon. Subtle gold particle overlay on background. |

### During Surge Turn

- All cards have persistent golden shimmer edge (indicating "free Charge available")
- Fling-up Charge gesture threshold reduced slightly (easier to trigger, encouraging Charging)
- AP counter shows lightning bolt icon instead of number
- Background: subtle golden particle overlay (existing ambient particle system, tinted gold)
- Charge cost displays as "0" instead of "+1" on card info overlay

### Surge End

- Golden glow fades smoothly (0.3s transition)
- Normal card colors return
- Brief dim pulse signals return to normal

### Design Intent

Surge creates RHYTHM. Players learn to:
1. **Normal turns:** Quick Play efficiently, build block, manage AP
2. **Pre-Surge turn:** Set up buffs (Empower, Expose) in preparation
3. **Surge turn:** BURST — Charge 2-3 cards, build chains, deal massive damage
4. **Post-Surge:** Recover, defend, prepare for next Surge

This is similar to the Watcher's Calm/Wrath stance cycling in STS, but tied to a fixed rhythm rather than player-controlled stance switching.

---

## 5. Run Structure (3 Acts, ~25 Minutes)

### Overview

| Act | Name | Floors | Map Nodes | Key Features |
|-----|------|--------|-----------|-------------- |
| 1 | The Shallows | 1-4 | 7-8 per path | Deck building, learn combat |
| 2 | The Depths | 5-8 | 7-8 per path | Synergy testing, first elite |
| 3 | The Archive | 9-12 | 7-8 per path | Build payoff, final boss |

### Act 1: The Shallows (Floors 1-4)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (weak) | 3-4 | Card rewards, deck building |
| Mystery Room | 0-1 | Random events, bonus content |
| Shop | 0-1 | Early purchases, card removal |
| Mini-Boss | 1 | Act gate, first relic choice (1 of 3) |

**Enemy pool:** Simple, telegraphed. Cave Bat (fast, low HP), Crystal Golem (slow, charges). Teaches basic Quick Play rhythm and introduces Charge as optional power boost.

**Philosophy:** Players who path toward combat (risky) build faster. Mystery rooms are safe but slower. Aggressive play rewarded from minute one.

### Act 2: The Depths (Floors 5-8)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (medium) | 3-4 | Synergy testing, harder enemies |
| Elite | 1 | Quiz-focused encounter, guaranteed relic |
| Rest Site | 1 | Heal OR Study (quiz to upgrade cards) |
| Shop/Mystery | 0-1 | Deck refinement |
| Boss | 1 | Act gate with Quiz Phase at 50% HP |

**Elite encounters force Charging** via enemy special abilities (The Examiner gains Strength if you don't Charge). This is where quiz skill becomes non-optional.

**Boss Quiz Phase:** At 50% HP, combat pauses. 5 rapid questions. Each correct = boss loses 10% remaining HP + player gains buff. Each wrong = boss gains +3 Strength. Then combat resumes.

### Act 3: The Archive (Floors 9-12)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (hard) | 3-4 | Build-or-die encounters |
| Elite | 1 | Final relic opportunity |
| Rest Site | 1 | Last heal/upgrade chance |
| Shop | 0-1 | Final purchases |
| Final Boss | 1 | Extended fight with 2 Quiz Phases |

**Final Boss (The Curator):** Quiz phases at 66% and 33% HP. The 33% phase is RAPID FIRE — 8 questions, 4-second timers, each correct = 5 direct damage, each wrong = boss heals 5 HP. The climactic test of everything learned.

### Total Run Metrics

| Metric | Value |
|--------|-------|
| Total rooms per path | ~16-18 |
| Combat encounters | ~12 |
| Boss/mini-boss fights | 2-3 |
| Shops | 1-2 |
| Rest sites | 1-2 |
| Estimated run time | 25-30 minutes |
| Quizzes per run | 45-70 |

---

## 6. Starting Deck

### 10 Cards, Deliberately Boring

| Card | Count | AP | Effect |
|------|-------|----|--------|
| Strike | 5 | 1 | 8 damage |
| Block | 4 | 1 | 6 shield |
| Surge | 1 | 0 | Draw 2 cards |

### Design Rationale

- **10 cards = cycle every 2 turns** (draw 5 per turn). Each card reward is a 10% deck change — immediately impactful.
- **Mostly basic cards.** All interesting mechanics (Multi-Hit, Thorns, Empower, Execute, Hex, etc.) come from rewards. Starter deck is functional but unexciting, creating hunger for better cards.
- **3 AP per turn, draw 5.** First few fights are winnable but tight. Charging a Strike costs 2 AP, leaving only 1 AP for another play. Resource tension from turn 1.
- **One Surge (0 AP, draw 2):** The single interesting starter card. Shows players that utility cards exist. Charging Surge costs 1 AP (the +1 surcharge) for draw 3 — introduces the Charge value proposition naturally.

---

## 7. Card Mechanics (25 Phase 1 Mechanics)

### Quick Play vs Charged Values

| Card | Type | AP | Quick Play (1.0x) | Charged Correct (3.0x) | Charged Wrong (0.7x) | Notes |
|------|------|----|-------------------|----------------------|---------------------|-------|
| **Strike** | Attack | 1 | 8 dmg | 24 dmg | 5.6 dmg | Bread and butter |
| **Multi-Hit** | Attack | 2 | 4×3 (12) | 12×3 (36) | 2.8×3 (8.4) | Devastating when Charged |
| **Heavy Strike** | Attack | 3 | 20 dmg | 60 dmg | 14 dmg | The nuke. Charge costs 4 AP total. |
| **Piercing** | Attack | 1 | 6 dmg (ignores block) | 18 dmg | 4.2 dmg | Anti-tank |
| **Reckless** | Attack | 1 | 12 dmg, 3 self | 36 dmg, 3 self | 8.4 dmg, 3 self | Self-damage stays flat |
| **Execute** | Attack | 1 | 6 (+8 if <30%) | 18 (+24 if <30%) | 4.2 (+5.6 if <30%) | Finisher. 42 dmg Charged vs low HP |
| **Lifetap** | Attack | 2 | 8 dmg, heal 20% | 24 dmg, heal 20% | 5.6 dmg, heal 20% | Sustain attack |
| **Block** | Shield | 1 | 6 block | 18 block | 4.2 block | Standard defense |
| **Thorns** | Shield | 1 | 6 block, 3 reflect | 18 block, 9 reflect | 4.2 block, 2.1 reflect | Reflect scales with Charge |
| **Emergency** | Shield | 1 | 4 (8 if <30% HP) | 12 (24 if <30%) | 2.8 (5.6 if <30%) | Desperation shield |
| **Fortify** | Shield | 2 | 7 persistent block | 21 persistent | 4.9 persistent | Carries between turns |
| **Brace** | Shield | 1 | Block = enemy intent | 3× enemy intent | 0.7× enemy intent | Perfect read |
| **Overheal** | Shield | 2 | 10 (2× if <50% HP) | 30 (2× if <50%) | 7 (2× if <50%) | Emergency mega-shield |
| **Quicken** | Buff | 0 | +1 AP this turn | +1 AP + draw 1 card | +1 AP (no draw) | Charge cost: 1 AP total |
| **Empower** | Buff | 1 | Next card +50% | Next card +75% | Next card +35% | Setup for burst |
| **Focus** | Buff | 1 | Next card -1 AP | Next 2 cards -1 AP | Next card -1 AP | Charged = 2 discounts |
| **Double Strike** | Buff | 2 | Next attack hits 2× | Next attack 2× + Pierce | Next attack hits 1× | Charged adds Pierce |
| **Weaken** | Debuff | 1 | -25% enemy dmg, 2t | -40% dmg, 3t | -20% dmg, 1t | Defensive debuff |
| **Expose** | Debuff | 1 | +50% dmg taken, 1t | +75% taken, 2t | +35% taken, 1t | Offensive setup |
| **Hex** | Debuff | 1 | 3 poison, 3t (9 total) | 8 poison, 3t (24 total) | 2 poison, 3t (6 total) | Poison scales hard |
| **Slow** | Debuff | 2 | Skip enemy action | Skip + Weaken 1t | Skip (normal) | Charged = double value |
| **Scout** | Utility | 1 | Draw 2 cards | Draw 3 cards | Draw 1 card | Hand cycling |
| **Foresight** | Utility | 0 | Draw 2 cards | Draw 3 + see next intent | Draw 1 card | Free info. Charge costs 1 AP. |
| **Recycle** | Utility | 1 | Draw 3 cards | Draw 4 + 1 from discard | Draw 2 cards | Premium cycling |
| **Mirror** | Wild | 1 | Copy last card effect | Copy at 1.3× power | Copy at 0.7× power | Mirrors the chain too |
| **Adapt** | Wild | 1 | Auto best effect | Auto at 1.5× power | Auto at 0.7× power | Smart play |

### Key Balance Principles

1. **Every card has a reason to Charge AND a reason to Quick Play.** Quick Play is AP-efficient. Charging is power-efficient. Different situations favor each.
2. **Buff/debuff Charging is about bonus effects, not just numbers.** Charged Focus gives 2 discounts. Charged Double Strike adds Piercing. These feel qualitatively different, not just "bigger number."
3. **Wrong answers always give SOMETHING** (0.7x). Never a total waste. But always worse than Quick Play (1.0x). Clear punishment without run-ending frustration.
4. **0-AP cards cost 1 AP to Charge.** Quicken and Foresight become "free quiz cards" — the quiz IS the AP cost. This preserves the old design's spirit for these specific cards.

---

## 8. Complete Relic System

### Design Rules

- **5 active relic slots** per run. Expandable to 6 via Scholar's Gambit (rare, cursed).
- **42 total relics.** ~60% build-around, ~40% stat-stick.
- **Relics acquired from:** Mini-boss (choice 1 of 3), elite kills (guaranteed drop), boss kills (choice 1 of 3 with better rarity), 10% chance from regular combat.
- **Rarity weights (regular):** Common 50%, Uncommon 30%, Rare 15%, Legendary 5%.
- **Rarity weights (boss):** Common 20%, Uncommon 35%, Rare 30%, Legendary 15%.
- **Pity timer:** If no Uncommon+ relic offered in 4 consecutive drops, next drop is guaranteed Uncommon+.
- **When at 5/5 slots:** New relic acquisition shows all 5 current + the new one. Player must sell one to make room (or pass). Selling refunds partial gold value.

### Build Archetypes

| Archetype | Fantasy | Core Relics | Playstyle |
|-----------|---------|------------|-----------|
| Chain Master | Long chains, exponential damage | Chain Reactor, Resonance Crystal, Prismatic Shard | Plan chains, seek tag matches |
| Speed Scholar | Fast answers, massive bonuses | Quicksilver Quill, Adrenaline Shard, Time Warp | Charge everything fast, get bonus multipliers |
| Glass Cannon | High risk, one-shot kills | Volatile Core, Reckless Resolve, Crit Lens | Low HP = high damage, risk everything |
| Iron Fortress | Unkillable, attrition wins | Aegis Stone, Thorn Crown, Regeneration Orb | Stack block, enemy kills itself |
| Poison Alchemist | DoT stacking, indirect damage | Plague Flask, Festering Wound, Toxic Bloom | Apply poison, then burst |
| Burst Master | Save AP, one massive turn | Capacitor, Overflow Gem, Double Down | Defend → Defend → NUKE |
| Knowledge Engine | Quiz mastery = combat mastery | Scholar's Crown, Memory Nexus, Insight Prism | Charge everything, learn everything |

### Complete Relic Catalogue

#### Chain Relics (Build-Around)

**Chain Reactor** — Rare
Knowledge Chains of 3+ deal 4 splash damage per chain link.
*Transforms chains from bonus damage to AoE. Makes chain-building obsessive.*
*Synergy: Tag Magnet + Swift Boots + any multi-hit cards*

**Resonance Crystal** — Uncommon
Each chain link beyond 2 draws +1 card at end of turn.
*Long chains refill your hand, enabling longer chains next turn. Snowball engine.*
*Synergy: Chain Reactor, Swift Boots*

**Tag Magnet** — Uncommon
When drawing cards, +30% chance to draw cards sharing a categoryL2 with your last played card.
*Makes chains more consistent. Reduces "I see the chain but can't draw into it."*
*Synergy: Chain Reactor, Resonance Crystal*

**Echo Chamber** — Rare
Completing a 3+ chain replays the first card in the chain at 50% power (no quiz, no AP cost).
*Free bonus action from chaining. The ghost replay feels amazing.*
*Synergy: If first card was Charged, the echo keeps the multiplier*

#### Speed Relics (Build-Around)

**Quicksilver Quill** — Rare
Charged quizzes answered in under 2 seconds get an additional 1.5× multiplier.
*Rewards genuine mastery. 3.0x × 1.5x = 4.5x for fast correct answers.*
*Synergy: Adrenaline Shard, Time Warp*

**Adrenaline Shard** — Uncommon
Correct Charged answers in under 3 seconds refund 1 AP (once per turn).
*Fast answerers effectively get 4 AP per turn.*
*Synergy: Quicksilver Quill*

**Time Warp** — Rare
On Knowledge Surge turns, quiz timer is halved but Charge multiplier increases to 4.0x.
*High-risk, high-reward Surge turns. For confident players.*
*Synergy: Quicksilver Quill, Momentum Gem*

#### Glass Cannon Relics (Build-Around)

**Volatile Core** — Uncommon (Cursed)
All attacks deal +40% damage. Wrong Charged answers deal 5 damage to you AND the enemy.
*Even failures deal enemy damage. Pure aggression.*
*Synergy: Reckless Resolve, Blood Pact*

**Reckless Resolve** — Uncommon
Below 40% HP: all attacks +50% damage. Above 80% HP: attacks -15% damage.
*Forces edge-of-death play. Pairs with self-damage cards.*
*Synergy: Volatile Core, Blood Pact, Reckless card*

**Crit Lens** — Rare
Charged correct answers have 25% chance to DOUBLE the final damage (after all multipliers).
*The occasional CRITICAL hit. Heart-stopping moments.*
*Synergy: Heavy Strike, Double Down, Empower*

#### Defense Relics (Build-Around)

**Aegis Stone** — Uncommon
Block from shield cards carries between turns (max 25). At 25 block, gain Thorns 3.
*Completely changes shield card evaluation. Persistent defense.*
*Synergy: Thorn Crown, Fortify, Bastion's Will*

**Regeneration Orb** — Uncommon
Heal 3 HP at end of each turn where you played 2+ shield cards.
*Rewards committed defensive play. Shield decks become viable.*
*Synergy: Aegis Stone, Iron Fortress build*

**Thorn Crown** — Rare
When you have 15+ block at start of turn, reflect 5 damage per enemy attack.
*Passive damage from defense stacking. Win without attacking.*
*Synergy: Aegis Stone, Fortify cards, Bastion's Will*

**Bastion's Will** — Rare
Charged shield cards gain an additional +50% block value.
*Makes Charging defensive cards worthwhile. Opens "Charged defense" strategy.*
*Synergy: Aegis Stone, Thorn Crown, Brace*

#### Poison Relics (Build-Around)

**Plague Flask** — Uncommon
All poison ticks deal +2 extra damage. Poison lasts 1 extra turn.
*Hex goes from 9 total to 20 total damage. Massive scaling.*
*Synergy: Festering Wound, Toxic Bloom*

**Festering Wound** — Rare
When enemy has 5+ poison stacks, all attacks deal +30% damage.
*Poison becomes burst setup. Apply stacks → Charged heavy attacks.*
*Synergy: Plague Flask, Hex card, Venom-related cards*

**Toxic Bloom** — Uncommon
When enemy dies from poison, spread 3 poison to all other enemies (future multi-enemy encounters).
*Reserved for future encounters with adds/spawns.*
*Synergy: Chain Reactor for splash + poison spread*

#### Burst Relics (Build-Around)

**Capacitor** — Rare
Unused AP at end of turn stores as Charge (max 3). Next turn, gain stored Charge as bonus AP.
*Enables "save up" turns. Defend 2 turns → burst with 5+ AP on turn 3.*
*Synergy: Overflow Gem, Double Down*

**Overflow Gem** — Uncommon
When you spend 4+ AP in a single turn, the last card played gets +75% effect.
*Rewards big turns. Combos with AP generation.*
*Synergy: Capacitor, Blood Price, Quicken*

**Double Down** — Rare
Once per encounter: Charge same card twice. Answer 2 questions. Both correct: 5× power. One correct: 1.5×. Both wrong: 0.3×.
*Ultimate high-stakes play. Two questions, massive reward.*
*Synergy: Heavy Strike (5× on 20 = 100 dmg), Crit Lens (potential 200)*

#### Knowledge Relics (Build-Around)

**Scholar's Crown** — Rare
Tier 2+ facts Charged get +30% power. Tier 3 auto-Charged cards get +50%.
*Direct power reward for learning. Most-studied facts = strongest weapons.*
*Synergy: Everything. The "good at quizzes = good at game" relic.*

**Memory Nexus** — Uncommon
When you correctly Charge 3 cards in one encounter (cumulative), draw 2 extra next turn.
*Sustained accuracy = card advantage. Cumulative, not per-turn.*
*Synergy: Resonance Crystal, chain builds*

**Insight Prism** — Uncommon
Wrong Charged answers reveal correct answer AND next appearance of that fact auto-succeeds.
*Turns failures into future guaranteed wins. Incredible for learning.*
*Synergy: Makes wrong answers feel productive*

**Domain Mastery Sigil** — Rare
If deck has 6+ facts from same domain, all same-domain cards get +20% base (even Quick Play).
*Rewards domain commitment. Japanese-only deck gets a passive boost.*
*Synergy: Chain Reactor (same domain = easy chains + power boost)*

#### Economy Relics (Utility)

**Gold Magnet** — Common
+30% gold from all sources.
*Enables shop-heavy strategies.*

**Merchant's Favor** — Common
Shops offer 1 additional card and 1 additional relic choice.
*Better selection = more build-defining purchases.*

**Lucky Coin** — Common
Start each encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1).
*Small variance. Feels lucky.*

**Scavenger's Eye** — Common
See 4 card choices after combat instead of 3.
*Better card selection = tighter decks.*

#### Stat Stick Relics (Always Useful)

**Whetstone** — Common
All attack cards +2 base damage.
*Universal. Always useful.*

**Iron Shield** — Common
Start each turn with 3 block.
*Passive defense floor.*

**Vitality Ring** — Common
+12 max HP.
*Error room. Good for new players.*

**Herbal Pouch** — Common
Heal 4 HP after each combat encounter.
*Between-fight sustain.*

**Swift Boots** — Common
Draw 6 cards per turn instead of 5.
*More options, more chain opportunities. Universally good.*

**Combo Ring** — Common
First Charged correct answer each turn grants +2 damage to all attacks that turn.
*Small, consistent Charge incentive.*

**Steel Skin** — Common
Take 1 less damage from all sources (min 1).
*Anti-chip. Simple.*

**Last Breath** — Uncommon
Once per encounter: survive lethal at 1 HP, gain 8 block.
*Safety net. Prevents frustrating one-turn deaths.*

#### Special / Cursed Relics

**Blood Price** — Uncommon (Cursed)
+1 AP per turn. Lose 2 HP per turn.
*4 AP is transformative. HP drain creates urgency.*
*Synergy: Regeneration Orb, Blood Pact*

**Phoenix Feather** — Rare
Once per run: on death, resurrect at 30% HP. All cards auto-Charge free for 2 turns.
*Second chance + revenge burst. "I died but came back STRONGER."*

**Scholar's Gambit** — Rare (Cursed)
5 relic slots → 6. But wrong Charged answers deal 3 damage to you.
*More relics, higher quiz penalty. For confident players.*

**Prismatic Shard** — Legendary (1 per run max)
All chain multipliers +0.5x. 5-chains grant +1 AP.
*THE chain capstone. 5-chain = 3.5x + free AP.*
*Synergy: Every chain relic. The "I won the lottery" relic.*

**Mirror of Knowledge** — Legendary
Once per encounter: after correct Charge, replay card at 1.5× (no quiz, no AP).
*Most powerful relic. Charged Heavy Strike → free replay = 60 + 30 = 90 damage from one answer.*

---

## 9. Enemy Design (Quiz-Integrated)

### Design Philosophy

Single enemies only (no multi-enemy encounters at launch). Variety comes from enemy BEHAVIOR, not enemy COUNT. Each enemy archetype creates different pressure on the Charge system.

### Enemy Roster

#### Act 1 Enemies (The Shallows)

**Cave Bat** — Common
HP: 19 | Damage: 8-11
Standard enemy. Telegraphed attacks. Teaches basic Quick Play combat.
*No special mechanics. Pure intro.*

**Crystal Golem** — Common
HP: 38 | Damage: 12 every 2 turns
Defends on off-turns (gains block). Can charge for 25 dmg spike.
*Teaches reading enemy intents. Charge turn = you should Charge too for burst.*

**Toxic Spore** — Common
HP: 15 | Damage: 8 + poison
Low HP, applies DoT. Teaches "kill fast or suffer."
*Charging for burst damage is the correct response.*

**Timer Wyrm** — Mini-Boss (Act 1 gate)
HP: 45 | Damage: 12, enrages after turn 4 (+5/turn)
Must kill fast. Charging for burst is essential.
*Teaches new players: Charging is necessary for tough enemies.*

#### Act 2 Enemies (The Depths)

**Shadow Mimic** — Common
HP: 30 | Damage: 8
When you answer wrong on a Charged card, Mimic copies that card's effect against you.
*Creates genuine tension: only Charge facts you're confident about.*

**The Examiner** — Elite
HP: 55 | Damage: 10
Gains +3 Strength every turn you don't Charge at least 1 card.
*Forces quiz engagement without feeling forced. You CHOOSE when.*

**Bone Collector** — Common
HP: 35 | Damage: 10
Heals 5 HP when you answer a Charged quiz incorrectly.
*Punishes guessing. Reward for only Charging known facts.*

**The Archivist** — Boss (Act 2)
HP: 80 | Damage: 12
Phase 1: Standard combat, medium damage.
**Quiz Phase at 50% HP:** 5 rapid questions. Correct = boss loses 10% HP + player gets buff. Wrong = boss gains +3 Strength.
Phase 2: Resume with accumulated buffs/debuffs.

#### Act 3 Enemies (The Archive)

**The Scholar** — Common
HP: 40 | Damage: 6
Heals 5 HP when you answer correctly on a Charge. Very weak otherwise.
*Dilemma: Charge for power (but heal the enemy) or Quick Play to chip?*

**The Nullifier** — Elite
HP: 70 | Damage: 14
Negates all chain bonuses. Chains still form visually but give 1.0× multiplier.
*Forces non-chain strategies. Tests build versatility.*

**The Librarian** — Elite
HP: 65 | Damage: 12
Immune to Quick Play damage. Only Charged attacks deal damage.
*All-in quiz skill test. You must answer correctly to win.*

**The Curator** — Final Boss (Act 3)
HP: 120 | Damage: 15
Phase 1: Heavy attacks, telegraphed. Standard combat.
**Quiz Phase 1 at 66%:** 5 questions from your weakest domain. Correct = 10% HP loss to boss.
Phase 2: Adds debuffs, harder patterns.
**Quiz Phase 2 at 33%:** RAPID FIRE — 8 questions, 4-second timers. Each correct = 5 direct damage. Each wrong = boss heals 5 HP.
Final Phase: If boss survives, enraged. 3 turns of combat.

### Boss Quiz Phase UX

1. Combat pauses. Screen dims slightly. Boss pulls back.
2. "QUIZ PHASE" text flashes. Dramatic sound cue.
3. Questions appear rapid-fire in center screen. Cards are hidden.
4. After all questions: results summary flash (X correct / Y total).
5. Boss reacts (damaged if many correct, empowered if many wrong).
6. Combat resumes with cards returning to hand.

---

## 10. Rest Site (Study Mechanic)

### Three Choices at Rest Sites

| Choice | Effect | Quiz Count |
|--------|--------|------------|
| **Rest** | Heal 30% max HP | 0 |
| **Study** | Answer up to 5 questions. Each correct upgrades a random deck card. | 3-5 |
| **Meditate** | Remove 1 card from your deck (deck thinning) | 0 |

### Study Flow

1. Player selects "Study"
2. 5 facts presented one at a time from the deck's fact pool
3. Each correct answer: a random card in the deck gains `isUpgraded: true` (boosted values, "+" suffix, blue glow border)
4. Wrong answers: no penalty, correct answer shown (learning moment)
5. After 5 questions (or player stops early): return to map

**Upgrade priorities:** Cards offered for upgrade are sorted by tier (Tier 2b > 2a > 1). Higher-tier facts get priority for upgrades, rewarding learning with better card improvements.

### Why Three Choices

- **Rest** is the safe play (always available, always useful)
- **Study** is the high-value play (potentially upgrade 3-5 cards, but requires quiz skill)
- **Meditate** is the strategic play (deck thinning for consistency)

This mirrors STS's Rest vs. Upgrade at campfires, but adds a third option AND ties upgrading to quiz performance.

---

## 11. Shop System

### Layout

Each shop displays:
- 3 cards from eligible pool (random mechanics, priced by rarity)
- 1-2 relics (priced by rarity)
- Card removal service (escalating cost)

### Haggling

Before each purchase, player can attempt to haggle: answer 1 question correctly for a 30% discount. Wrong = full price (no penalty beyond lost discount).

**Haggling is optional.** Player can always buy at full price without quizzing. This maintains the "quiz = optional power boost" philosophy even in shops.

### Pricing

**Card prices:**
| Rarity | Base Price | Haggled Price |
|--------|-----------|---------------|
| Common | 50g | 35g |
| Uncommon | 80g | 56g |
| Rare | 140g | 98g |

**Relic prices:**
| Rarity | Base Price | Haggled Price |
|--------|-----------|---------------|
| Common | 100g | 70g |
| Uncommon | 160g | 112g |
| Rare | 250g | 175g |

**Card removal:** Starts at 75g, +25g per removal. Haggling applies (75g → 53g first removal).

### Pity Timer (Card Rewards)

Borrowed from STS:
- `rarePityCounter` starts at -5% per act
- Each Common card in a reward: +1% to counter
- Counter modifies Rare card appearance chance
- Resets each act

Similar for relics: 4+ encounters without Uncommon+ relic offer → next drop guaranteed Uncommon+.

---

## 12. FSRS Integration (Revised for Selective Quizzing)

### Every Quiz Updates FSRS

All quiz moments — Charged plays, boss phases, Study, haggling, elite encounters — update FSRS state for the tested fact. The system still tracks:
- Difficulty (1-10)
- Stability (days)
- Retrievability (0-1)
- consecutiveCorrect
- nextReviewDate

### Tier Derivation (Unchanged)

```
Tier 1 (Learning):  stability < 2d
Tier 2a (Proven):   stability >= 2d, 2+ correct
Tier 2b (Proven+):  stability >= 5d, 3+ correct  
Tier 3 (Mastered):  stability >= 10d, 4+ correct, passed Mastery Trial
```

### Mastery Trial (Unchanged, Now More Dramatic)

When a Tier 2b fact qualifies for Mastery Trial:
- Golden card in hand
- 4-second timer (regardless of floor)
- 5 options with close distractors
- Hardest variant available
- Correct → Tier 3. The card permanently auto-Charges at 1.2x with no quiz and no AP surcharge. Celebration animation.
- Incorrect → stays Tier 2b, must requalify

### Quality Over Quantity

**Old system:** 150+ quizzes/run, many on autopilot. Attention split between card strategy and quiz answering.

**New system:** 45-70 quizzes/run, each a deliberate choice with real stakes. Full attention on each question because the player CHOSE this moment. Emotional encoding from combat stakes.

The research supports this: Bjork's "desirable difficulties" shows fewer, harder, more deliberate retrievals produce better long-term retention than more, easier, automated ones.

---

## 13. Echo Mechanic (Revised)

When a fact is answered wrong during a Charged play, 85% chance it reappears later as an Echo card.

**Echo cards can ONLY be played Charged** (they force a retry). The +1 AP cost still applies. But:
- Correct on Echo = golden flash, normal power, FSRS gets double credit
- Wrong on Echo = discarded, 0.5x effect, FSRS records second miss

**With Insight Prism relic:** Echo auto-succeeds (the relic already gave you the answer).

**Echo visual:** Translucent, dashed purple border, chromatic aberration. Clearly distinct from normal cards.

---

## 14. Synergy Examples (How Builds Come Together)

### "Chain Lightning" (Chain Master + AoE)

**Relics:** Chain Reactor + Resonance Crystal + Prismatic Shard
**Cards:** Attacks with overlapping categoryL2, Scout/Foresight for cycling
**Play pattern:** Build 4-5 chains. Each link deals splash + draws cards. Resonance refills hand. Prismatic Shard = 5-chain at 3.5x + bonus AP.
**Peak turn:** 5-chain Charged on Surge = 3.0x × 3.5x = 10.5x per card. 5 cards at 84 damage each + splash.

### "One-Punch Scholar" (Burst + Glass Cannon)

**Relics:** Double Down + Crit Lens + Capacitor
**Cards:** Heavy Strike, Empower, Focus
**Play pattern:** Save AP for 2 turns with Capacitor. Turn 3: Focus → Empower → Double Down Charged Heavy Strike. Both quiz answers correct: 20 × 5.0 × 1.75 (Empower) = 175 damage. Crit Lens 25% chance to double = 350.
**Peak turn:** 350 damage from one card and two correct answers.

### "Unkillable Fortress" (Defense + Attrition)

**Relics:** Aegis Stone + Thorn Crown + Bastion's Will
**Cards:** Block, Fortify, Brace, Thorns, Overheal
**Play pattern:** Stack 25+ block every turn. Aegis carries it. Thorn Crown reflects 5 per enemy attack. Bastion's Will makes Charged shields give +50% block. You literally don't need to attack.
**Peak turn:** Charged Brace on Surge vs 15-damage enemy = 15 × 3.0 × 1.5 (Bastion) = 67 block. From one card. Enemy kills itself on Thorns.

### "Speed Demon" (Knowledge Mastery)

**Relics:** Quicksilver Quill + Adrenaline Shard + Scholar's Crown
**Cards:** Low-AP cards, Quicken, Foresight
**Play pattern:** Answer every quiz in under 2 seconds. Quicksilver adds 1.5×. Scholar's Crown adds +30%. Adrenaline refunds 1 AP. A fast Tier 2 Charge: 3.0x × 1.5x × 1.3x = 5.85× power. Refunded AP = 4 plays/turn.
**Peak turn:** 4 cards played, all Charged fast, 5.85× each. Total: ~188 damage.

---

## 15. Visuals and UI

### Card Chain Indicator

- **Method:** Subtle 2-3px colored tint on left frame edge of each card
- **Colors:** ~12 distinct colors mapped from categoryL2 groups
- **Pulse:** When 2+ cards in hand share a categoryL2, their tinted edges pulse in sync
- **Play animation:** Thin glowing line briefly connects chained cards during resolution
- **Placement:** Visible in the top-left area even when cards overlap in the fan hand

### Knowledge Surge Visual

- **Announce (0.5s):** Golden screen-edge pulse, AP shows "SURGE", bass thrum sound
- **During turn:** Cards glow golden, gold particle overlay, AP shows lightning bolt
- **End:** Golden glow fades (0.3s), normal colors return, dim pulse

### Charge Play Animation

1. **Fling up (200ms):** Card lifts with golden glow building
2. **Quiz appears (150ms):** Panel slides in above hand. Timer starts.
3. **Correct answer (500ms):** GREEN flash. Card erupts with power particles. Screen shakes. Impact sound. Effect resolves at 3.0×.
4. **Wrong answer (300ms):** Brief red dim (not punishing). Correct answer shown 1.5s in blue. Card plays at 0.7× with muted effect.
5. **Quick Play contrast (200ms):** Tap → instant effect. Lightning fast.

The contrast between Quick Play speed and Charged Play drama makes Charging feel special.

### HP Bar

- Make HP bar slightly more prominent than current screenshot
- Clear color transitions: green (>60%) → yellow (30-60%) → red (<30%)
- Flash red on damage taken
- Show numerical HP value alongside bar

---

## 16. Implementation Priority

### Sprint 1 (Week 1-2): Core Loop Overhaul
- [ ] Quick Play: tap popped card = instant play, no quiz
- [ ] Charge Play: fling upward = quiz, +1 AP cost, 3.0×/0.7× results
- [ ] Remove quiz from default card play path
- [ ] Compress to 3-act structure (reduce map to 3 acts × 7-8 nodes)
- [ ] Starter deck: 10 cards (5 Strike, 4 Block, 1 Surge)
- [ ] Chain detection: consecutive same-categoryL2 cards get chain multiplier
- [ ] Chain visual: colored frame tint + pulse for matching cards

### Sprint 2 (Week 3-4): Surge + Boss + Feel
- [ ] Knowledge Surge turns (every 3rd turn, Charge = free)
- [ ] Surge visual (golden flash, card glow, particle overlay)
- [ ] Boss Quiz Phase (combat pauses at HP threshold, rapid questions)
- [ ] Charge animation polish (fling → quiz → burst/fizzle)
- [ ] Quick Play should feel FAST (200ms tap → effect)
- [ ] Sound design: Charge burst, chain completion, Surge announce, boss phase

### Sprint 3 (Week 5-6): Relics + Enemies
- [ ] 5-slot relic system with sell-to-make-room mechanic
- [ ] Implement 20 relics (prioritize build-arounds: Chain Reactor, Quicksilver Quill, Aegis Stone, Capacitor, Scholar's Crown, Double Down, Volatile Core, Blood Price)
- [ ] The Examiner elite (forces Charging)
- [ ] The Mimic common (punishes wrong Charges)
- [ ] The Archivist boss (quiz phase)
- [ ] Timer Wyrm mini-boss (enrage timer)
- [ ] Rest site: Rest / Study / Meditate choices
- [ ] Shop haggling mechanic

### Sprint 4 (Week 7-8): Polish + Playtest
- [ ] Full 42-relic catalogue
- [ ] All enemy types (Act 1-3)
- [ ] The Curator final boss with 2 quiz phases
- [ ] Pity timer for card rewards and relics
- [ ] Echo mechanic (wrong Charge → echo card later)
- [ ] Synergy testing (do Chain Lightning / One-Punch / Fortress builds work?)
- [ ] Balance: is Charging worth +1 AP at every floor depth?
- [ ] **GET 5-10 REAL HUMANS TO PLAY. Watch silently. Note where they get confused, bored, or quit.**

### Sprint 5 (Week 9-10): Content + Ship
- [ ] Verify categoryL2 coverage across all fact domains
- [ ] Add semantic bin as secondary chain group for vocabulary facts
- [ ] Daily Expedition mode
- [ ] Ascension levels (reuse existing floor content at higher difficulty)
- [ ] Push notifications
- [ ] App Store assets
- [ ] Ship to TestFlight / closed beta

---

## 17. What Makes This Game Its Own Thing

**Elevator pitch:** "A card roguelite where your real-world knowledge IS your power. Quick Play cards to fight, Charge them with quiz answers for 3× damage, chain related facts for exponential multipliers. The more you know, the stronger you become."

**Not describable in STS terms.** The Charge mechanic (optional quiz-for-power with AP cost), Knowledge Chains (categoryL2-based fact connections), and Knowledge Surge rhythm (every-3rd-turn burst window) are genuinely new.

**The core fantasy:** "I'm not just good at a game. I'm becoming smarter, and the game proves it every turn."

---

## Appendix: Key Numbers Reference

| Metric | Value |
|--------|-------|
| AP per turn | 3 (base) |
| Cards drawn per turn | 5 (base), 6 with Swift Boots |
| Starter deck size | 10 |
| Quick Play multiplier | 1.0× |
| Charge correct multiplier | 3.0× (Tier 2a), 2.5× (Tier 1), 3.5× (Tier 2b) |
| Charge wrong multiplier | 0.7× (Tier 2a/2b), 0.6× (Tier 1) |
| Charge AP surcharge | +1 AP (0 during Surge, 0 for Tier 3) |
| Tier 3 auto-Charge | 1.2× base, no quiz, no AP surcharge |
| Surge frequency | Every 3rd turn |
| Chain 2/3/4/5 multiplier | 1.3×/1.7×/2.2×/3.0× |
| Relic slots | 5 (6 with Scholar's Gambit) |
| Run length | ~25-30 minutes |
| Acts | 3 |
| Rooms per path | ~16-18 |
| Quizzes per run | 45-70 |
| Total relics | 42 |
| Total card mechanics | 25 (Phase 1) |
| Strike base damage | 8 |
| Block base value | 6 |
| Boss quiz phase questions | 5-8 per phase |
| Rest site Study questions | Up to 5 |
| Shop haggle | 1 question per purchase, 30% discount |
