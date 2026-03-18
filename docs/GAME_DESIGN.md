# Recall Rogue — Game Design (Single Source of Truth)

> **One-line summary:** Card roguelite where knowledge IS power — Quick Play cards for base effect, Charge them with quiz answers for massive multipliers, chain related facts for exponential damage. The more you know, the stronger you become.
>
> **Version:** v2 (overhaul complete). For legacy v1 design, see `docs/GAME_DESIGN_V1_ARCHIVE.md`.

---

## 1. Core Philosophy

### The New Golden Rule

**If you remove the quiz mechanic, the game still functions — but at dramatically reduced power.** You CAN beat easy content without Charging. You CANNOT beat deep floors or bosses without Charging consistently. The optimization path and the learning path converge at high play.

This is intrinsic integration through **INCENTIVE**, not through GATE. The old model (quiz on every card play) made learning a toll. The v2 model makes learning a power multiplier.

Research citation (D3 — Bjork's Desirable Difficulties): Every Charged card play is HIGH-QUALITY retrieval practice with emotional stakes. Bjork's framework shows that interleaving, spaced retrieval under pressure, and feedback timing produce stronger long-term retention than frequent, low-stakes quizzes. The quiz is not a gate — it is an amplifier for meaningful cognitive effort. 45–70 deliberate Charged questions per 25-min run outperform 150+ automated answers in v1 for actual learning (fewer, harder, more committed retrievals = better encoding).

### The Anti-Prodigy Principle (Preserved)

Prodigy Math Game (150M+ users) uses quizzes as a toll gate to RPG combat — children spend ~3 min on math per 20 min of play. Recall Rogue inverts this. Without quiz power, your cards are weak. The optimization path AND the learning path are identical. There is no route around engagement.

### Three Systems Only

| # | System | Purpose |
|---|--------|---------|
| 1 | Card Combat with Charge | Turn-based; Quick Play for base, Charge for quiz-powered burst |
| 2 | Deck Building with Chains | Select and evolve fact-cards; chain related facts for multipliers |
| 3 | Run Progression | 3-act dungeon descent with escalating quiz pressure |

Everything else (crafting, farming, companions, overworld hub, prestige, endless mode) is cut.

---

## 2. Card Combat

### Turn Structure

```
PLAYER TURN:
  1. Draw hand of 5 fact-cards from draw pile
  2. Player has 3 AP (Action Points) per turn
  3. For each card the player wants to play, choose:

     QUICK PLAY (tap popped card):
       - Card plays instantly at 1.0× base power
       - No quiz. 200ms animation. Fast, snappy.
       - Costs card's base AP only
       - Does NOT trigger Chains (Chain counter resets)

     CHARGE PLAY (drag card into upper screen zone above ~40% from top, or tap CHARGE button):
       - Costs card's base AP + 1 additional AP (the "Charge surcharge")
       - Quiz panel appears. Timer starts. No backing out.
       - CORRECT ANSWER → card plays at 2.5× / 3.0× / 3.5× (per tier). 500ms celebration.
       - WRONG ANSWER → card plays at 0.6× / 0.7× / 0.7× (per tier). 300ms muted resolve.
       - Card is never wasted — wrong answers still resolve (at 0.7× or lower).
       - Contributes to Knowledge Chain if same chainType (0-5) as previous Charge.

  4. End Turn when AP is spent or player chooses to stop.
     Remaining unplayed cards discarded.

ENEMY TURN:
  5. Enemy executes telegraphed action (intent visible before player turn)
  6. Player damage applied minus player's block
  7. Player block resets to 0 (unless Fortify persistent block)
  8. Next turn begins
```

### Quick Play vs Charge Play — The Core Tradeoff

| Scenario | AP Spent | Damage Dealt | Efficiency |
|----------|----------|--------------|------------|
| 3 Quick Strike plays | 3 AP | 8 + 8 + 8 = 24 | 8 dmg/AP |
| 1 Charged Strike (correct, Tier 2a) | 2 AP | 24 | 12 dmg/AP |
| 1 Charged Strike (wrong, Tier 2a) | 2 AP | 5.6 | 2.8 dmg/AP |
| 1 Charged Strike (correct) + 1 Quick Strike | 3 AP | 24 + 8 = 32 | 10.7 dmg/AP |

**Quick Play is AP-efficient. Charge is power-efficient but expensive.** The +1 AP surcharge prevents "always Charge everything" — with 3 AP, you can Quick Play 3 cards OR Charge 1 + Quick 1. Meaningful tradeoff every turn.

### Charge Gesture (Touch UX)

| Action | Gesture | Result |
|--------|---------|--------|
| Inspect card | Tap card in hand | Card pops up, shows full stats |
| Quick Play | Tap popped card | Instant play at 1.0×, no quiz |
| Quick Play (drag) | Drag card upward into lower zone (below ~40% screen height), release past 60px | Quick Play, no quiz |
| Charge Play | Drag card into upper zone (above ~40% screen height) OR tap CHARGE button | Quiz triggers on release |
| Cancel | Release card barely moved (< ~20px) | Card returns to hand |

**Screen-position zone system (AR-62):**
- The screen is divided at **40% from the top** (35% on small screens < 600px height) into two play zones.
- **Lower zone (below threshold):** Green glow. Drag past ~60px and release = Quick Play (no quiz, base effect at 1.0×).
- **Upper zone (above threshold):** Golden glow + "⚡ CHARGE +1 AP" indicator above card. Release = Charge Play (quiz). Card scales to 1.05× in this zone.
- Zone transition is **immediate and continuous** — visual feedback changes in real-time as card crosses the threshold.
- **Not enough AP for charge:** indicator turns red with "NOT ENOUGH AP"; releasing falls back to Quick Play.
- **Tier 3 cards:** Never show charge zone indicator (they auto-charge, no gesture needed).

**Desktop (mouse):** Same drag-upward mechanic with pointer events.

### Free First Charge (AR-59.23)

Paying +1 AP to Charge a fact you've never seen before is a blind guess. The **Free First Charge** solves this:

- **First Charge of any fact in a run:** AP surcharge = 0. Wrong answer = 1.0× (same as Quick Play — no penalty for trying a new fact).
- **Subsequent Charges of the same fact:** Normal +1 AP surcharge applies.
- **Visual indicator:** CHARGE button shows **"FREE"** (instead of "+1 AP") for not-yet-Charged facts.
- **Tier 3 auto-Charge does NOT consume the free Charge** — the player didn't consciously choose to Charge.

**Natural run arc:**
- Act 1: Most facts are new → CHARGE buttons show "FREE" → players explore freely.
- Act 2: Mix of "FREE" and "+1 AP" → selective Charging of known facts.
- Act 3: Mostly "+1 AP" → veteran players Charge with confidence.

Balance constants: `FIRST_CHARGE_FREE_AP_SURCHARGE = 0`, `FIRST_CHARGE_FREE_WRONG_MULTIPLIER = 1.0`

### Action Points (Turn Economy)

**3 AP per turn. Hard cap 5 AP (via relics/passives). Cards cost 0–3 AP. Skip is free.**

AP badge colors:
- Green: 0 AP (free)
- Blue: 1 AP (standard)
- Orange: 2 AP (heavy)
- Red: 3 AP (full turn)

### Fact-Card Binding (AR-70 — Implemented)

Card slots (type + mechanic + base effect) and facts (the questions to answer) are **bound persistently for the entire run**. At run start, `buildRunPool()` assigns each fact a `chainType` (0-5) via `index % 6` for even distribution, and binds facts to card slots.

**Why binding:** Without binding, chain types would re-randomize every draw, making chain-building impossible to plan. With binding, players learn which cards share chain types and can make strategic deck decisions (card removal, reward selection) around chain composition.

1. At run start, `buildRunPool()` creates card SLOTS and binds facts to them
2. Each `drawHand()` call draws N bound card-slots from the draw pile
3. The fact stays with its slot for the entire run
4. Tier multiplier is derived from the FSRS mastery tier of the bound fact

**Chain color** is derived from the card's `chainType` (0-5) — same chainType = same chain color = can chain together. Colors are defined in `src/data/chainTypes.ts` (Obsidian, Crimson, Azure, Amber, Violet, Jade).

### Encounter Cooldown & Anti-Repetition

All facts seen during an encounter enter a 3–5 encounter cooldown. Three deduplication layers:

1. **Same-hand dedup:** No two cards in the same 5-card hand share the same underlying fact (exact ID, base key, and root ID dedup).
2. **Encounter cooldown:** All facts that appeared in any hand during an encounter enter cooldown (3–5 encounters, random per fact). Root-sibling variants also blocked.
3. **Cross-run dedup:** Facts from the last 2 runs are deprioritized when building the next run's pool.

### The Commit-Before-Reveal Rule (CRITICAL)

The quiz question is hidden until the card is committed to Charge. Once committed, there is no cancel — must answer or auto-fizzle when timer expires.

Research: Roediger & Karpicke (2006) — retrieval practice = 87% retention vs 44% for restudying. Kornell et al. (2009) — even failed retrieval beats passive viewing.

**Stage 1 — In hand:** Cards fan in arc. Shows mechanic name, effect value, difficulty stars, AP cost badge, chain color tint. No question visible.

**Stage 2 — Selected (tap to rise):** Card rises 80px with info overlay. Can freely deselect. Strategic decision point — Charge or Quick Play?

**Stage 3 — Committed (tap CHARGE / fling up):** Quiz panel appears. Timer starts. No cancel.

### Dynamic Timer System

| Floor | Base Timer | Segment |
|-------|-----------|---------|
| 1–6 | 12s | The Shallows |
| 7–12 | 9s | The Depths |
| 13–18 | 7s | The Depths (late) |
| 19–24 | 5s | The Archive |
| 25+ | 4s | Endless |

**Question length modifier:** Add +1s per 12 words beyond 10 words in total text (question + all answer options).

**Slow Reader mode (Settings):** Flat +3s to all timers, amber timer bar instead of red.

### Card Anatomy & Frame System

Cards use hand-crafted PNG card frames per mechanic category, with the following additions in v2:

- **CHARGE button:** Displayed below the card in the popped state. Shows "FREE" (first Charge of fact) or "+1 AP" (subsequent Charges). Tap to initiate quiz. **Hover/press preview:** Hovering or touch-pressing the CHARGE button triggers a real-time charge value preview on the selected card — numeric values in the card's description update to show their charged equivalents in green (`#4ADE80`). Leaving the button reverts to normal display. Only active when the charge is affordable.
- **Chain color tint:** 2–3px colored tint on the left frame edge indicates `chainType` (0-5). Same color = can chain. Pulse in sync when 2+ cards in hand share a `chainType`.
- **Chain ember particles (AR-71.2):** Cards with a `chainType` display 5 small CSS particle dots rising from their top edge, colored in the chain color. The smoldering effect signals chain affinity at a glance. Pure CSS `@keyframes`, `pointer-events: none`.
- **AP cost badge:** Gemstone badge top-right, colored by AP cost.
- **RPG pixel font (AR-71.3):** Card description text (`.card-parchment-text`) uses `var(--font-pixel)` (Press Start 2P) in off-white `#F0E6D2` with a 4-direction black outline for legibility over card art. Card name text (`.card-front-name`) uses the same treatment. Font size reduced to ~65–75% of previous Georgia size to compensate for the wider pixel glyph width.

Card frame categories: Attack (golden slash), Defence (blue shield), Buff (golden radiate), Debuff (purple tendrils), Utility (prismatic), Wild (morphic).

### Charge Animation System (AR-59.16)

| Phase | Duration | Effect |
|-------|----------|--------|
| Quick Play | 200ms | Instant tap → effect. Lightning fast. |
| Charge fling | 200ms | Card lifts with golden glow building |
| Quiz appears | 150ms | Panel slides in above hand. Timer starts. |
| Correct answer | 500ms | GREEN flash. Card erupts with power particles. Screen shakes. Impact sound. Effect resolves at full multiplier. |
| Wrong answer | 300ms | Brief red dim (not punishing). Correct answer shown 1.5s in blue. Card resolves at 0.7× with muted effect. |

The contrast between Quick Play speed and Charged Play drama makes Charging feel special and deliberate.

### Combo Counter & Decay

The **combo counter** tracks consecutive knowledge victories and applies a damage multiplier from `COMBO_MULTIPLIERS`. The counter floors at `baseComboCount` (normally 0) and never goes negative.

| Event | Combo Change |
|-------|-------------|
| Charge — correct answer | +1 combo |
| Charge — wrong answer | −2 combo (decays, floor at base) |
| Quick Play | −1 combo (decays, floor at base) |

**Design intent:** Quick Play is safe but bleeds momentum. Wrong answers hurt more than Quick Play. Only consecutive correct Charges build the combo multiplier.

| Combo Count | Multiplier |
|-------------|-----------|
| 0 | 1.00× |
| 1 | 1.15× |
| 2 | 1.30× |
| 3 | 1.50× |
| 4 | 1.75× |
| 5+ | 2.00× |

**Combo heal:** At combo 6+, each correct Charge answer heals 1 HP (Quick Play does not trigger combo heal).

Balance constants: `COMBO_DECAY_QUICK_PLAY = 1`, `COMBO_DECAY_WRONG_ANSWER = 2`, `COMBO_HEAL_THRESHOLD = 6`, `COMBO_HEAL_AMOUNT = 1`

---

## 3. Knowledge Chain System (AR-59.3)

### How It Works

Cards have a `chainType` value (integer 0-5, corresponding to Obsidian, Crimson, Azure, Amber, Violet, Jade). When you Charge cards consecutively within the same turn that share a `chainType`, they form a chain. Each card in the chain gets a multiplier.

**Chain is built exclusively by Charge plays.** Quick Play resets the chain counter. Wrong Charge answers also break the chain.

**Six distinct chain types** (0-5) map to the 6-color palette defined in `src/data/chainTypes.ts`. Cards without a `chainType` field contribute no chain.

### Chain Multipliers

| Chain Length | Multiplier | Visual Feedback |
|-------------|-----------|-----------------|
| 1 (no chain) | 1.0× | Normal play |
| 2-chain | 1.3× | Subtle glow, thin line connecting cards |
| 3-chain | 1.7× | Bright glow, particle trail, chain sound |
| 4-chain | 2.2× | Screen edge pulse, chain lightning VFX |
| 5-chain | 3.0× | Full celebration, screen shake, "KNOWLEDGE CHAIN!" text |

**Chain multiplier stacks with Charge multiplier:**

| Scenario | Calculation | Total |
|----------|-------------|-------|
| 3-chain Quick Play Strikes | 8 × 1.7 each | 40.8 |
| 3-chain Charged (correct, Tier 2a) middle card | 8, 24×1.7, 8×1.7 | 62.4 |
| 3-chain all Charged on Surge turn (free Charge, Tier 2a) | 24 × 1.7 each | 122.4 |

The 122-damage Surge chain is the "holy shit" peak. Rare. Players will chase it.

### Chain Visual System (AR-59.17)

**Frame edge tint:** Each `chainType` (0-5) maps to one of 6 distinct colors (Obsidian, Crimson, Azure, Amber, Violet, Jade). Cards show a subtle 2–3px colored tint on their left frame edge (visible even when cards overlap in the fan).

**In-hand pulse:** When 2+ cards in hand share a `chainType`, their tinted edges pulse in sync.

**Chain ember particles (AR-71.2):** Any card with a `chainType` shows 5 small glowing dots rising from its top edge in the chain color — a "smoldering" effect that indicates chain affinity. Pure CSS animation, `pointer-events: none`.

**During chain play:** A thin glowing line briefly connects played cards as they resolve (animation only, not persistent UI).

**Chain counter:** Displayed above the hand, shows current chain length and chain type name.

### Chain Examples

**Geography deck (Japan focus):**
- "Mount Fuji is Japan's highest peak" — `asia_oceania`
- "Tokyo was formerly called Edo" — `asia_oceania`
- "The Meiji Restoration began in 1868" — `asia_oceania`
→ 3-chain on shared chainType at 1.7×

**Language deck (Japanese N5):**
- 食べる (to eat) — `japanese_n5`
- 飲む (to drink) — `japanese_n5`
- おいしい (delicious) — `japanese_n5`
→ 3-chain on `japanese_n5` at 1.7×

### Facts Randomly Assign Per Encounter

Card mechanics pair with random facts each hand draw. A Strike might be `asian_cuisine` (green tint) in one encounter and `planets_moons` (blue tint) in the next. This means:
- Every hand is a fresh chain puzzle
- Players must READ their hand each turn
- Educational breadth is preserved
- No "my Strike always chains with my Block" memorization

---

## 4. Knowledge Surge (AR-59.4)

### Rhythm: Normal → Normal → SURGE → Normal → Normal → SURGE

Surge turns occur every 3rd turn, starting on turn 2 (turns 2, 5, 8, 11...).

**On Surge turns:** Charging costs **+0 AP** instead of +1. This is the burst window where Charging everything is viable and encouraged. Chain multipliers and Charge multipliers both apply at full strength.

Constants: `SURGE_FIRST_TURN = 2`, `SURGE_INTERVAL = 3`

### Surge Announcement (0.5s, non-interruptive)

| Phase | Duration | Effect |
|-------|----------|--------|
| Flash | 0.15s | Screen edges pulse warm golden/amber once |
| Label | 0.3s | AP counter briefly shows "SURGE" text |
| Sound | 0.3s | Low satisfying bass thrum (power-up hum) |
| Persist | Full turn | Cards glow golden. AP area shows ⚡ lightning bolt icon. Subtle gold particle overlay. |

### During Surge Turn (AR-59.18 — Surge Visual System)

- All cards have persistent golden shimmer edge (indicating "free Charge available")
- CHARGE button displays "+0 AP" / shows free for all cards
- AP counter shows lightning bolt icon (⚡ AP)
- Background: subtle golden particle overlay (existing ambient particle system, tinted gold)
- Fling-up Charge gesture threshold reduced slightly (easier to trigger)

### Surge End

- Golden glow fades smoothly (0.3s transition)
- Normal card colors return
- Brief dim pulse signals return to normal

### Design Intent

Surge creates RHYTHM. Players learn to:
1. **Normal turns:** Quick Play efficiently, build block, manage AP
2. **Pre-Surge turn:** Set up buffs (Empower, Expose) in preparation
3. **Surge turn:** BURST — Charge 2–3 cards, build chains, deal massive damage
4. **Post-Surge:** Recover, defend, prepare for next Surge

---

## 4.5. Status Effects & Combat Buffs

### Debuffs (applied to enemy or player)

| Effect | Description |
|--------|-------------|
| **Weakness** | Reduces attack damage by 25% (2 turns base) |
| **Vulnerable** | Increases incoming damage by 50% (1 turn base) |
| **Poison** | Deals flat damage per turn (stacks additively) |
| **Slow** | Skips enemy's next defend/buff action |

### Buffs (applied to player)

| Effect | Description |
|--------|-------------|
| **Empower** | Next card deals +50% damage (Quick Play) / +75% (Charged Correct) |
| **Block** | Absorbs incoming damage. Resets to 0 each turn (unless Fortify) |
| **Strength** | Permanent flat damage bonus to all attacks (gained via relics or enemy debuffs) |

### Player Turn Buffs (from card mechanics, last 1 turn)

| Buff | Source | Effect |
|------|--------|--------|
| AP bonus | Quicken | +1 AP this turn |
| AP discount | Focus | Next card costs 1 less AP |
| Double strike | Double Strike | Next attack hits twice |
| Cost reduction | Empower | Next card +50/75% effect |

**Focus visual feedback (CardHand):** When Focus is active (`focusReady && focusCharges > 0`), the AP gem on each card shows the reduced cost and turns green (`#4ADE80`). The `focusDiscount` prop (1 or 0) is passed from `CardCombatOverlay` to `CardHand`. The gem color returns to off-white (`#F0E6D2`) when no discount is active. The `hasEnoughAp()` check and charge button affordability both account for the Focus discount, so cards costing 1 AP that become free (0 AP) are correctly highlighted as playable.

### Enemy-Specific Interactions (v2)

- **Examiner:** Gains +3 Strength every turn you don't Charge at least 1 card
- **Scholar:** Heals 5 HP when you answer correctly on a Charge
- **Shadow Mimic:** Copies card effect against you when you answer wrong on a Charged card
- **Bone Collector:** Heals 5 HP when you answer a Charged quiz incorrectly
- **Librarian:** Immune to Quick Play damage — only Charged attacks deal damage

### Stacking Rules

- Multiple Weakness applications extend duration, don't stack intensity
- Poison stacks additively (3 poison + 3 poison = 6 poison per turn, each instance decays independently)
- Block stacks additively within a turn
- Empower consumes on first card played (not on Charge activation)

---

## 5. Card Tiers and Mastery (FSRS-Powered)

### Tier Derivation

```typescript
function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  if (state.stability >= 10 && state.consecutiveCorrect >= 4 && state.passedMasteryTrial) return '3';
  if (state.stability >= 5  && state.consecutiveCorrect >= 3) return '2b';
  if (state.stability >= 2  && state.consecutiveCorrect >= 2) return '2a';
  return '1';
}
```

### Charge Scaling Table

| Tier | Display | Quick Play | Charged Correct | Charged Wrong | Charge AP Cost |
|------|---------|------------|-----------------|---------------|----------------|
| 1 | Learning | 1.0× | 2.5× | 0.6× | +1 AP |
| 2a | Proven | 1.0× | 3.0× | 0.7× | +1 AP |
| 2b | Proven+ | 1.0× | 3.5× | 0.7× | +1 AP |
| 3 | Mastered | 1.2× always | Auto-Charge, no quiz | N/A | +0 AP (free) |

**Tier 3 Mastered cards permanently play at 1.2× with no quiz and no AP surcharge.** Players literally feel their knowledge becoming power — mastered facts are both stronger AND more efficient.

### Question Format by Tier

| Tier | Options | Reverse Format | Fill-Blank | Close Distractors |
|------|---------|----------------|------------|-------------------|
| 1 | 3 | No | No | No |
| 2a | 4 | Yes | No | No |
| 2b | 5 | Yes | Yes | Yes |
| 3 | 0 (no quiz) | — | — | — |

### Mastery Trial

When a Tier 2b fact qualifies for Mastery Trial (stability ≥ 30, consecutiveCorrect ≥ 7):
- Golden card in hand, distinct glow
- 4-second timer (regardless of floor)
- 5 options with close distractors
- Hardest variant available
- **Correct → Tier 3.** Card permanently auto-Charges at 1.2× with no quiz and no AP surcharge. Celebration animation.
- **Incorrect → stays Tier 2b**, must requalify.

Constants: `MASTERY_TRIAL.TIMER_SECONDS = 4`, `MASTERY_TRIAL.ANSWER_OPTIONS = 5`, `MASTERY_TRIAL.REQUIRED_STABILITY = 30`, `MASTERY_TRIAL.REQUIRED_CONSECUTIVE_CORRECT = 7`

### Tier-Up Celebration Animations

| Tier Reached | Animation | Duration |
|-------------|-----------|---------|
| Tier 2a | Gold shimmer burst on card | 400ms |
| Tier 2b | Gold + particle trail | 600ms |
| Tier 3 | Full-screen golden burst, "MASTERED" text, fanfare | 1.5s |

### Pool Exhaustion Prevention

If cooldown would exhaust the fact pool (available facts < hand size), cooldown relaxes to 1 encounter. If still insufficient, cooldown is disabled for that draw.

---

## 5.5. Combat Visuals & Enemy Sprites

### Enemy Sprite Rendering

Enemies are rendered in the Phaser canvas with pixel-art sprites. First-person dungeon perspective — enemy centered in viewport, player hand at bottom. Enemies animate their intent telegraphs every turn.

### Enemy Rarity System

| Rarity | HP Multiplier | Damage Multiplier | Reward |
|--------|--------------|------------------|--------|
| Common | 1.0× | 1.0× | Standard |
| Elite | 1.5× | 1.3× | Guaranteed relic |
| Boss | 2.5× | 1.5× | Choice of 3 relics |

### Enemy Size Tiers

Small (Act 1 fodder), Medium (Act 2 standard), Large (bosses). Size affects sprite scale, not stats.

### Enemy Roster Summary

See §8 for complete enemy roster with quiz integration behaviors.

---

## 5.6. VFX Systems

### Combat Atmosphere System

- Particle overlay adapts to floor depth (darker, denser particles in deeper acts)
- Screen edge color shifts with player HP (neutral → amber → red as HP drops)
- Dungeon background art changes between acts (cave tiles → deep stone → archive library)

### Status Effect Visual System

| Status | Visual |
|--------|--------|
| Weakness | Purple tint on enemy, -% badge |
| Vulnerable | Orange tint, crack pattern |
| Poison | Green stacking number badge, drip animation |
| Block | Blue shield icon, number value |
| Strength | Red fist icon on enemy |

### Surge Visual System (AR-59.18)

- Screen edges: warm golden pulse for 0.15s on Surge announcement
- Cards: persistent golden shimmer edge throughout Surge turn
- AP area: ⚡ icon replaces AP number
- Background: ambient particles tinted gold
- Transition back: 0.3s fade to normal colors

### Chain Visual System (AR-59.17)

- Card left-edge tint: 6 distinct colors mapped from `chainType` (0-5) via `chainTypes.ts`
- In-hand pulse: tinted edges pulse in sync when 2+ cards share a `chainType`
- Play animation: thin glowing line connects chained cards during resolution
- Chain counter: displayed above hand with current chain length + milestone celebrations

### Near-Death Tension

- Screen edges pulse red at < 30% HP
- Heartbeat audio cue
- Enemy sprite slightly enlarges (threat)

### Enrage Visual Indicator

After enrage threshold, enemy sprite gains red aura, speed-up animation on intent reveal.

### Charge Attack Telegraph (Enemy)

When an enemy is about to deal high damage, their sprite builds a visible "charge aura" during the player's previous turn.

---

## 5.7. Echo Card Visuals

Echo cards have a distinctive visual signature to separate them from normal cards:

- Translucent / ghostly appearance
- Dashed purple border
- `echo-shimmer` CSS animation
- Badge shows "ECHO ⚡ CHARGE" (signals Charge-only requirement)
- Golden flash on correct resolution

---

## 6. Card Mechanics (26 Active Mechanics)

### Starting Deck (10 Cards)

| Card | Count | AP | Quick Play | Charged Correct (2a) | Charged Wrong |
|------|-------|----|------------|---------------------|---------------|
| Strike | 5 | 1 | 8 dmg | 24 dmg | 5.6 dmg |
| Block | 4 | 1 | 6 block | 18 block | 4.2 block |
| Surge | 1 | 0 | Draw 2 cards | Draw 3 cards | Draw 1 card |

**10 cards = cycle every 2 turns** (draw 5 per turn). Each card reward is a 10% deck change — immediately impactful. Boring by design; interesting mechanics come from rewards.

**One Surge (0 AP, draw 2):** The single interesting starter card. Charging Surge costs 1 AP (the +1 surcharge) for draw 3 — introduces the Charge value proposition naturally.

### Complete Mechanics Reference (v2 — QP / Charge Correct / Charge Wrong)

All 26 active mechanics. Quick Play (QP) = 1.0×. Charged Correct = tier multiplier (2.5×/3.0×/3.5×). Charged Wrong = 0.6×/0.7×. Values shown at Tier 2a (3.0×/0.7×) for standard reference.

#### Attack Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Strike** | 1 | 8 dmg | 24 dmg | 5.6 dmg | Bread and butter |
| **Multi-Hit** | 2 | 4×3 (12 total) | 12×3 (36 total) | 2.8×3 (8.4 total) | Devastating when Charged |
| **Heavy Strike** | 3 | 20 dmg | 60 dmg | 14 dmg | The nuke. Charge costs 4 AP total. |
| **Piercing** | 1 | 6 dmg (ignores block) | 18 dmg | 4.2 dmg | Anti-tank |
| **Reckless** | 1 | 12 dmg, 3 self | 36 dmg, 3 self | 8.4 dmg, 3 self | Self-damage stays flat |
| **Execute** | 1 | 6 (+8 if <30%) | 18 (+24 if <30%) | 4.2 (+5.6 if <30%) | Finisher. 42 dmg Charged vs low HP. |
| **Lifetap** | 2 | 8 dmg, heal 20% | 24 dmg, heal 20% | 5.6 dmg, heal 20% | Sustain attack |

#### Shield Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Block** | 1 | 6 block | 18 block | 4.2 block | Standard defense |
| **Thorns** | 1 | 6 block, 3 reflect | 18 block, 9 reflect | 4.2 block, 2.1 reflect | Reflect scales with Charge |
| **Emergency** | 1 | 4 (8 if <30% HP) | 12 (24 if <30%) | 2.8 (5.6 if <30%) | Desperation shield |
| **Fortify** | 2 | 7 persistent block | 21 persistent | 4.9 persistent | Carries between turns |
| **Brace** | 1 | Block = enemy intent | 3× enemy intent | 0.7× enemy intent | Perfect read |
| **Overheal** | 2 | 10 (2× if <50% HP) | 30 (2× if <50%) | 7 (2× if <50%) | Emergency mega-shield |

#### Buff Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Quicken** | 0 | +1 AP this turn | +1 AP + draw 1 card | +1 AP (no draw) | Charge costs 1 AP total |
| **Empower** | 1 | Next card +50% | Next card +75% | Next card +35% | Setup for burst |
| **Focus** | 1 | Next card −1 AP | Next 2 cards −1 AP | Next card −1 AP | Charged = 2 discounts |
| **Double Strike** | 2 | Next attack hits 2× | Next attack 2× + Pierce | Next attack hits 1× | Charged adds Piercing |

#### Debuff Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Weaken** | 1 | −25% enemy dmg, 2t | −40% dmg, 3t | −20% dmg, 1t | Defensive debuff |
| **Expose** | 1 | +50% dmg taken, 1t | +75% taken, 2t | +35% taken, 1t | Offensive setup |
| **Hex** | 1 | 3 poison, 3t (9 total) | 8 poison, 3t (24 total) | 2 poison, 3t (6 total) | Poison scales hard with Charge |
| **Slow** | 2 | Skip enemy action | Skip + Weaken 1t | Skip (no Weaken) | Charged = double value |

#### Utility Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Scout** | 1 | Draw 2 cards | Draw 3 cards | Draw 1 card | Hand cycling |
| **Foresight** | 0 | Draw 2 cards | Draw 3 + see next intent | Draw 1 card | Free info. Charge costs 1 AP. |
| **Recycle** | 1 | Draw 3 cards | Draw 4 + 1 from discard | Draw 2 cards | Premium cycling |
| **Cleanse** | 1 | Remove all debuffs + draw 1 | Remove debuffs + draw 2 | Remove debuffs only | Situational lifesaver |

#### Wild Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Mirror** | 1 | Copy last card effect (1.0×) | Copy at 1.3× power | Copy at 0.7× | Mirrors the chain too |
| **Adapt** | 1 | Auto best effect at 1.0× | Auto best effect at 1.5× | Auto best effect at 0.7× | Enemy attacking → Block; debuffing → Cleanse; else → Attack. Card text: "Smart: ATK/DEF/Cleanse" |

### Key Balance Principles (v2)

1. **Every card has a reason to Charge AND a reason to Quick Play.** Quick Play is AP-efficient. Charging is power-efficient. Different situations favor each.
2. **Buff/debuff Charging is about bonus effects, not just numbers.** Charged Focus gives 2 discounts. Charged Double Strike adds Piercing. Qualitatively different, not just "bigger number."
3. **Wrong answers always give SOMETHING (0.7×).** Never a total waste. But always worse than Quick Play (1.0×). Clear punishment without run-ending frustration.
4. **0-AP cards cost 1 AP to Charge.** Quicken and Foresight become "free quiz cards" — the quiz IS the AP cost.
5. **Chain multipliers stack with Charge multipliers.** Planning chains + Charging = exponential payoff.

### Phase Gating (Removed in v2)

All 26 mechanics are available from run start. The `ENABLE_PHASE2_MECHANICS = true` flag enables the full mechanic pool. The phase 1/phase 2 distinction is maintained in the data for gradual content rollout but is not player-facing.

---

## 7. Run Structure (3 Acts, ~25 Minutes)

### Overview

| Act | Name | Floors | Map Nodes | Key Features |
|-----|------|--------|-----------|--------------|
| 1 | The Shallows | 1–4 | 7–8 per path | Deck building, learn combat, Free First Charge exploration |
| 2 | The Depths | 5–8 | 7–8 per path | Synergy testing, first elite, quiz pressure escalates |
| 3 | The Archive | 9–12 | 7–8 per path | Build payoff, final boss, mastery tested |

**~16–18 rooms total per path. ~25–30 minute target run time.**

### Act 1: The Shallows (Floors 1–4)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (weak) | 3–4 | Card rewards, deck building |
| Mystery Room | 0–1 | Random events, bonus content |
| Shop | 0–1 | Early purchases, card removal |
| Mini-Boss | 1 | Act gate, first relic choice (1 of 3) |

Enemy pool: Cave Bat, Crystal Golem, Toxic Spore. Teaches basic Quick Play rhythm, introduces Charge as optional power boost.

### Act 2: The Depths (Floors 5–8)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (medium) | 3–4 | Synergy testing, harder enemies |
| Elite | 1 | Quiz-focused encounter, guaranteed relic |
| Rest Site | 1 | Heal / Study / Meditate choices |
| Shop/Mystery | 0–1 | Deck refinement |
| Boss | 1 | Act gate with Quiz Phase at 50% HP |

Elite encounters force Charging via enemy special abilities (Fossil Guardian gains Strength if you don't Charge). This is where quiz skill becomes non-optional.

**Boss Quiz Phase (The Archivist at 50% HP):** Combat pauses. 5 rapid questions. Each correct = boss loses 10% remaining HP + player gains buff. Each wrong = boss gains +3 Strength. Then combat resumes.

### Act 3: The Archive (Floors 9–12)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (hard) | 3–4 | Build-or-die encounters |
| Elite | 1 | Final relic opportunity |
| Rest Site | 1 | Last heal/upgrade chance |
| Shop | 0–1 | Final purchases |
| Final Boss | 1 | Extended fight with 2 Quiz Phases |

**Final Boss (The Curator):** Quiz phases at 66% and 33% HP. The 33% phase is RAPID FIRE — 8 questions, 4-second timers, each correct = 5 direct damage, each wrong = boss heals 5 HP. The climactic test of everything learned.

### Total Run Metrics

| Metric | Value |
|--------|-------|
| Total rooms per path | ~16–18 |
| Combat encounters | ~12 |
| Boss/mini-boss fights | 2–3 |
| Shops | 1–2 |
| Rest sites | 1–2 |
| Estimated run time | 25–30 minutes |
| Quizzes per run | 45–70 |

### Dungeon Map (Node Map)

The dungeon map uses a Slay the Spire-style branching node map:
- Multiple paths from top to bottom per act
- Player chooses which node type to visit at each row
- No retreat-or-delve mechanic — paths are linear with branching choices
- Resume at last completed node on save/load

Map config constants: `MAP_CONFIG.ROWS_PER_ACT = 15`, `MAP_CONFIG.BOSS_ROW = 14`, `MAP_CONFIG.PRE_BOSS_ROW = 13`

**actMap Boss Node Flow (implementation note):** Boss nodes on the actMap are single-encounter nodes (`encountersPerFloor` stays at the floor default of 3, but the boss node only has 1 encounter). After defeating a boss node, `gameFlowController` detects `justCompletedNode.type === 'boss'` and forces `encountersPerFloor = currentEncounter` so `advanceEncounter()` correctly marks the floor as complete. The relic reward and special-event/retreat-or-delve flow then trigger normally.

Node distribution by act (approximate):
| Node Type | Act 1 | Act 2 | Act 3 |
|-----------|-------|-------|-------|
| Combat | 42% | 38% | 34% |
| Elite | 12% | 14% | 16% |
| Mystery | 16% | 16% | 16% |
| Rest | 12% | 12% | 14% |
| Shop | 8% | 10% | 10% |
| Treasure | 10% | 10% | 10% |

### Rest Site — Three Choices

At each Rest Site, player chooses exactly one:

| Choice | Effect | Quiz Count |
|--------|--------|------------|
| **Rest** | Heal 30% max HP | 0 |
| **Study** | Answer 3 quiz questions — each correct answer upgrades a random eligible card | 3 |
| **Meditate** | Remove 1 card from your deck (deck thinning) | 0 |

**Study flow:** A standalone 3-question quiz is shown (`StudyQuizOverlay`). Questions are drawn from the run's current fact pool. For each correct answer, one random upgrade-eligible (non-upgraded) card in the deck is upgraded in-place (gains "+" suffix and boosted values). Perfect score = 3 upgrades. Disabled if no upgrade-eligible cards remain.

**Meditate flow:** A scrollable list of all deck cards is shown (`MeditateOverlay`). Player taps a card to select it, then confirms via a red "Remove" button. A confirm dialog prevents accidental removal. Disabled if the deck has 5 or fewer cards.

This design makes Study on-brand with the knowledge/learning theme — upgrades must be earned through correct answers, not handed out for free.

### Shop System

Each shop displays 3 cards, 1–2 relics, and a card removal service.

#### Haggling

Before each purchase, player can attempt to **Haggle**: answer 1 question correctly for a 30% discount. Wrong = full price (no penalty beyond lost discount). Haggling is always optional.

#### Pricing

**Card prices (v2):**
| Rarity | Base Price | Haggled Price |
|--------|-----------|---------------|
| Common (Tier 1) | 50g | 35g |
| Uncommon (Tier 2a/2b) | 80g | 56g |
| Rare (Tier 3) | 140g | 98g |

**Relic prices:**
| Rarity | Base Price | Haggled Price |
|--------|-----------|---------------|
| Common | 100g | 70g |
| Uncommon | 160g | 112g |
| Rare | 250g | 175g |
| Legendary | 400g | 280g |

**Card removal:** Starts at 50g, +25g per removal. Haggling applies.

Constants: `SHOP_HAGGLE_DISCOUNT = 0.30`, `SHOP_REMOVAL_BASE_PRICE = 50`, `SHOP_REMOVAL_PRICE_INCREMENT = 25`

### Card Reward System

After each combat encounter, player chooses 1 of 3 card options. Each option is an actual card — showing the mechanic name, AP cost, short description, and domain color stripe. Cards are selected from the run pool weighted by the run archetype (aggressive, defensive, control, hybrid, balanced).

**Reward screen (altar):** Displays 3 mini-cards on the altar surface. Each mini-card shows:
- AP cost badge (top-left)
- Mechanic name (center, bold)
- Short effect description
- Domain color bar (bottom)
- Golden "+" badge if the card is pre-upgraded

Inspect panel below shows the full mechanic description when a card is selected.

**Reroll:** A "Reroll" button is shown below the card options. Tapping it re-randomizes the currently selected card type with a different fact from the run pool. Maximum **1 reroll per reward screen** — the button greys out and shows "Rerolled" after use. Reroll count resets when a new reward screen opens.

**Floor-based pre-upgrade probability:** Cards in rewards can arrive pre-upgraded based on floor depth:
| Floor Range | Upgrade Chance |
|-------------|---------------|
| 1–3 | 0% |
| 4–6 | 10% |
| 7–9 | 20% |
| 10–12 | 30% |
| 13+ | 40% |

Constant: `UPGRADED_REWARD_CHANCE_BY_FLOOR` in `src/data/balance.ts`

**Pity timer (STS-style):**
- `rarePityCounter` starts at −5% per act
- Each Common card in a reward: +1% to counter
- Counter modifies Rare card appearance chance
- Resets each act

### Gold Economy

Target: ~400–800g per run (varies by risk-taking, node choices, and haggling).

| Source | Amount |
|--------|--------|
| Regular combat victory | 15–30g |
| Elite combat victory | 40–60g |
| Boss victory | 80–120g |
| Mini-boss victory | 50–70g |
| Mystery room bonus | 20–50g |
| Haggle savings (per item) | 24–75g |

### Save/Resume System

Run state saved after each completed node. On resume, player returns to the map at their last completed position. `firstChargeFreeFactIds` is serialized as an array and restored to `Set<string>` on load.

**Active Run Guard Popup:** If the player clicks "Enter Dungeon" while a saved run exists, a modal popup appears showing the run's current stats (floor, gold, encounters won, facts correct). Two options are presented: "Continue Run" (resumes the existing run) and "Abandon & Start New" (clears the save and begins a fresh run). Clicking the backdrop dismisses the popup without action. The active-run banner is hidden while the popup is visible to avoid double UI.

### Deck Building Strategy

**Pool building:** Run pools are concentrated on a subset of `chainType` values to enable chains. The domain selection at run start determines which chain type groups appear.

**Deck size:** Starts at 10 cards. Each card reward adds 1 card (no limit). Card removal at shops and Meditate at rest sites thin the deck. Optimal decks: 15–20 cards (tight and consistent).

---

## 8. Enemy Design (12 Quiz-Integrated Enemies)

### Design Philosophy

Single enemies only (no multi-enemy encounters at launch). Variety comes from enemy BEHAVIOR, not COUNT. Each enemy archetype creates different pressure on the Charge system.

### Act 1 Enemies (The Shallows)

**Cave Bat** — Common
HP: 19 | Damage: 8–11
Standard enemy. Telegraphed attacks. Teaches basic Quick Play combat.
*No special mechanics. Pure intro.*

**Crystal Golem** — Common
HP: 38 | Damage: 12 every 2 turns
Defends on off-turns (gains block). Can charge for 25 dmg spike.
*Teaches reading enemy intents. Enemy Charge turn = you should Charge too for burst.*

**Toxic Spore** — Common
HP: 15 | Damage: 8 + poison
Low HP, applies DoT. Teaches "kill fast or suffer."
*Charging for burst damage is the correct response.*

**Venomfang** — Mini-Boss (Act 1 gate)
HP: 45 | Damage: 12, enrages after turn 4 (+5/turn)
Must kill fast. Charging for burst is essential.
*Teaches new players: Charging is necessary for tough enemies.*

### Act 2 Enemies (The Depths)

**Shadow Mimic** — Common
HP: 30 | Damage: 8
When you answer wrong on a Charged card, Mimic copies that card's effect against you.
*Creates genuine tension: only Charge facts you're confident about.*

**Fossil Guardian** — Elite
HP: 55 | Damage: 10
Gains +3 Strength every turn you don't Charge at least 1 card.
*Forces quiz engagement without feeling forced. You CHOOSE when to Charge.*

**Bone Collector** — Common
HP: 35 | Damage: 10
Heals 5 HP when you answer a Charged quiz incorrectly.
*Punishes guessing. Reward for only Charging known facts.*

**The Archivist** — Boss (Act 2)
HP: 80 | Damage: 12
Phase 1: Standard combat, medium damage.
**Quiz Phase at 50% HP:** 5 rapid questions. Correct = boss loses 10% HP + player gets buff. Wrong = boss gains +3 Strength.
Phase 2: Resume with accumulated buffs/debuffs.

### Act 3 Enemies (The Archive)

**Void Mite** — Common
HP: 40 | Damage: 6
Heals 5 HP when you answer correctly on a Charge. Very weak otherwise.
*Dilemma: Charge for power (but heal the enemy) or Quick Play to chip?*

**Mantle Dragon** — Elite
HP: 70 | Damage: 14
Negates all chain bonuses. Chains still form visually but give 1.0× multiplier.
*Forces non-chain strategies. Tests build versatility.*

**Core Harbinger** — Elite
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

### Enemy Enrage System

After a turn threshold (segment-based), enemy enrage activates:
- **Phase 1 (turns 0–3 of enrage):** +2 damage/turn
- **Phase 2 (turns 4+):** +4 damage/turn
- **Low HP (<30%):** +3 bonus damage

Enrage thresholds by segment: Shallows = turn 9, Depths = turn 8, Archive = turn 6.

---

## 9. Knowledge Chain System (Summary)

See §3 for full detail. Summary for quick reference:

- **Chain trigger:** Consecutive Charge plays of same `chainType` (0-5) in one turn
- **Chain break:** Quick Play, wrong Charge answer, different `chainType`
- **Multipliers:** 1.0× (no chain), 1.3× (2-chain), 1.7× (3-chain), 2.2× (4-chain), 3.0× (5-chain)
- **Stacks with:** Charge multiplier (multiplicative), Surge (free Charge, enabling more chains per turn)
- **Visuals:** `chainType`-colored card edge tint (6-color palette), in-hand pulse, connection line animation, chain counter

---

## 10. Difficulty System

### Three Layers

| Layer | What Changes | Player Awareness |
|-------|-------------|-----------------|
| Floor depth | Quiz timer, enemy HP/damage | Visible (floor number) |
| Canary (adaptive) | Enemy damage ×, fact difficulty | Invisible |
| Ascension | All of the above + restrictions | Visible (selected pre-run) |

### Player Modes

| Mode | Description |
|------|-------------|
| **Normal** | Standard difficulty. All mechanics active. |
| **Relaxed** | +6% post-encounter healing. Timer unchanged. |

(Story Mode with forced Easy was removed in v2. All players start in Normal with full mechanics.)

### Charge System Difficulty Interaction

- Charge AP cost is flat +1 regardless of floor depth
- Charge multipliers do NOT scale with floor depth — only with fact tier (FSRS-driven)
- Enemy damage scales with floor depth (+5% per floor above floor 6)
- Timer shortens with floor depth (12s → 9s → 7s → 5s → 4s)

### Canary System (Invisible Adaptive Difficulty)

Graduated assist tiers based on performance within a floor:

| Canary State | Trigger | Enemy Damage | Timer |
|-------------|---------|--------------|-------|
| **Deep Assist** | 5+ wrong answers on floor | 0.65× | −2s |
| **Assist** | 3+ wrong answers on floor | 0.80× | −1s |
| **Neutral** | Baseline | 1.0× | Standard |
| **Challenge** | 5+ correct answer streak | 1.1× | Standard |

Canary is completely invisible. Never announced. Never reduces educational rigor (answer count, question format unchanged). Only game difficulty flexes.

Constants: `CANARY_DEEP_ASSIST_ENEMY_DMG_MULT = 0.65`, `CANARY_ASSIST_ENEMY_DMG_MULT = 0.80`, `CANARY_CHALLENGE_ENEMY_DMG_MULT = 1.1`, `CANARY_DEEP_ASSIST_WRONG_THRESHOLD = 5`, `CANARY_ASSIST_WRONG_THRESHOLD = 3`, `CANARY_CHALLENGE_STREAK_THRESHOLD = 5`

Research: Hunicke (2005) — invisible DDA preserves flow state.

### Learning Threshold Reward Gate

Progression to deeper floors requires a minimum number of correct answers in the run (to prevent button-mashing through content). Thresholds are generous enough to not block engaged players, strict enough to prevent pure skip-throughs.

### Mastery Scaling (Anti-Cheat)

When using a custom deck with heavily mastered content, reward scaling prevents farming:

| Mastery % | Label | Reward Multiplier | Timer Boost |
|-----------|-------|-------------------|-------------|
| <40% | Normal | 1.0× | +0 virtual floors |
| 40–60% | Practiced | 0.85× | +1 virtual floor |
| 60–80% | Expert | 0.65× | +2 virtual floors |
| 80–95% | Mastered | 0.40× | +4 virtual floors |

---

## 11. Echo Mechanic (v2 — AR-59.20)

When a fact is answered wrong on a **Charge play**, 85% chance it reappears later as an "Echo" card. Quick Play wrong answers never spawn Echoes.

**Visual:** Translucent/ghostly appearance, dashed purple border, `echo-shimmer` animation. Badge shows "ECHO ⚡ CHARGE". Clearly distinct from normal cards.

**Play restriction:** Echo cards can ONLY be played via Charge (quiz). Tapping a popped Echo card to Quick Play is blocked — "Must Charge!" tooltip appears.

| Event | Power | FSRS | Other |
|-------|-------|------|-------|
| Correct Echo Charge | 1.0× full power | Double credit (6.0× bonus, `FSRS_STABILITY_BONUS_CORRECT_V2`) | Golden flash; fact removed from echo set |
| Wrong Echo Charge | 0.5× (`POWER_MULTIPLIER_WRONG`) | Standard miss | Card exhausted — cannot be re-drawn this run |

Echo constants: `ECHO.REAPPEARANCE_CHANCE = 0.85`, `ECHO.POWER_MULTIPLIER = 1.0`, `ECHO.POWER_MULTIPLIER_WRONG = 0.5`, `ECHO.FSRS_STABILITY_BONUS_CORRECT_V2 = 6.0`, `ECHO.MAX_ECHOES_PER_RUN = 20`, `ECHO.INSERT_DELAY_CARDS = 3`

**`echo_lens` relic (v2):** Prevents the 0.5× wrong-Charge penalty on Echo cards. Echo cards deal 1.0× regardless of quiz result.

**Insight Prism synergy:** When `insight_prism` relic is held AND a fact is in `insightPrismAutosucceedIds`, the Echo quiz auto-succeeds: correct answer pre-highlighted for 300ms, then resolves as correct. One-time use per fact per run.

**Design effect:** Poor performance = more Echoes in hand. Each Echo is a meaningful high-stakes retry — correct for full power redemption, or fail and lose the card permanently.

Research: Karpicke & Roediger (2008) — immediate re-testing after failure is one of the most effective spaced repetition micro-patterns.

---

## 12. Exploitation Prevention

| Method | How |
|--------|-----|
| Commit-before-reveal | Question hidden until irrevocable Charge commit |
| Action Points | 3 AP forces card selection; Charge surcharge forces tradeoffs |
| Wrong answer effect | Wrong Charge = 0.7× (always SOME effect, but always worse than QP) |
| Large pools | 80–120 facts/run, see ~50–60 |
| No-repeat-until-cycled | STS draw pile model |
| Question format rotation | 2–4 variants per fact, never same format consecutively |
| Format escalation | Higher tiers = harder formats (more options, fill-blank, reverse) |
| Mastery Trial | Tier 3 requires 4s timer + 5 close distractors |
| Per-run mechanic randomization | Same fact, different combat behavior each run |
| FSRS decay | Mastered facts return if not maintained |
| Echo mechanic (v2) | Wrong Charge facts reappear as Charge-only ghost cards |
| Free First Charge | First Charge of any fact is free, preventing uninformed commitment |

---

## 13. Meta-Progression

| System | Description |
|--------|-------------|
| Knowledge Library | All facts cataloged by domain + mastery; lore entries expand on mastery |
| Relic Archive | 42 relics (25 free, 17 require Mastery Coins), earned in runs |
| Card Cosmetics | Milestone rewards; monetizable |
| Domain Unlocking | Master 25 facts → new domain |
| Streaks | Daily completion; 7d→card frame, 30d→mastery coins, 100d→exclusive cosmetic, 365d→legendary. 1 freeze/week. |
| Lore Discovery | At 10/25/50/100 mastered facts: narrative connecting learned facts |
| Bounty Quests | 1–2 bonus objectives per run |
| Ascension | 10 levels of permanent modifiers unlocked after first successful run |

No overworld, no farming/crafting, no prestige, no stamina.

### Mastery Coins (Simplified v2)

- Earned by mastering facts (reaching Tier 3 via Mastery Trial)
- Spent in the Relic Archive hub screen to permanently unlock relics for future runs
- 25 relics are free (unlocked from run start); 17 require Mastery Coins
- No per-run purchases with Mastery Coins — they are a meta-unlock currency only

### 13a. Lore Discovery System

Mastery milestones (10th, 25th, 50th, 100th mastered fact) unlock a Lore Fragment — a short, fascinating narrative connecting multiple facts the player has learned.

**Example:** After mastering 10 Chemistry facts: "The Alchemist's Dream — For centuries, alchemists tried to turn lead (atomic number 82) into gold (atomic number 79). They failed because transmuting elements requires nuclear reactions, not chemical ones. In 1980, scientists finally succeeded using a particle accelerator — but the gold cost $1 quadrillion per ounce."

Research: Elaborative encoding (Pressley et al., 1987) — connecting isolated facts into narrative improves long-term retention by 40–60%.

**Presentation:** Full-screen, pixel art illustration, atmospheric sound, "Share" button.

### 13b. Bounty Quest Examples

1–2 randomly selected per run, visible at start:

- "Chain Mastery: Build a 3-chain Knowledge Chain" → +1 card reward at next shop
- "Charge Adept: Correctly Charge 5 cards in one run" → Mastery Coins
- "Deep Delve: Reach Act 2" → 50% extra currency
- "Speed Caster: Charge 10 facts in under 3 seconds each" → Card upgrade token
- "Scholar's Path: Play cards from 4 different domains in one run" → Domain preview unlock
- "Surge Master: Charge at least 2 cards on 3 Surge turns" → Cosmetic card frame
- "Flawless Act: Complete Act 1 without a wrong Charge" → Rare card choice

---

## 14. Onboarding (v2 — AR-59.21, D25)

Research: Mobile users decide to keep an app within 7–30 seconds. Recall Rogue v2 onboarding is designed around a single principle: **feel powerful first, learn Charging second, discover chains third.**

### Run 1: Quick Play Only

```
0–3s:   Dungeon entrance. "ENTER THE DEPTHS" button.
3–10s:  First encounter. Hand of 5. Tooltip: "Tap a card to examine it."
10–14s: Card rises with info overlay. Tooltip: "Tap again to Quick Play."
14–20s: Card plays instantly. Satisfying 200ms animation. No quiz.
20–35s: Remaining AP. End Turn tooltip. Player feels competent.
35–60s: Second encounter. CHARGE button visible but labeled "optional — try later."
~2m:    Run ends. Unlock: CHARGE mechanic introduced at Run 2 start.
```

CHARGE button is visible in Run 1 but tooltipped as optional. First few encounters reward Quick Play with gold (to establish habit before introducing Charge).

### Turn 2 of Run 1 (or Run 2): Surge Tutorial

- First Surge turn is highlighted with explicit tooltip
- "SURGE TURN — Charging costs +0 AP this turn! Try it!"
- Golden screen pulse draws attention
- This is the natural moment to try a first Charge with zero downside

### Gradual Charge Introduction

- Run 2, turn 1: CHARGE button gets a pulsing glow invitation
- First Charge of any fact is FREE (AP surcharge = 0, wrong = 1.0× = no penalty)
- Successful first Charge: "CHARGED! You dealt 3× damage!" celebration

### Calibration (Accelerated FSRS, Runs 1–3)

- Correct + fast response (runs 1–3 only): counts as 2 consecutive correct answers
- Run accuracy bonus (80%+): all correctly-answered facts get +2 days stability bonus
- First-encounter stability boost: first correct answer starts stability at 2 days (not 1)

---

## 15. Wrong Answer Design

Wrong Charge resolves at **0.7× multiplier** (Tier 2a/2b) or **0.6×** (Tier 1) — partial effect, not full fizzle. Card is never wasted. It resolves weakly.

**Design intent:** Wrong answers are expected, not punished. The gap between wrong (0.7×) and Quick Play (1.0×) is clear negative feedback, but the player is not set back dramatically. They lose the Charge investment (+1 AP wasted) and get partial effect — a meaningful cost that teaches "only Charge what you know" without creating rage-quit moments.

**Anti-shame framing:**
- Wrong answer shows correct answer for 1.5s in blue (learning moment)
- No red flash/explosion — brief red dim (0.3s)
- Card resolves visibly (player sees the weak effect)
- No "fizzle" language — card still "played," just weakly

**Wrong answer sequence:**
1. Red dim (0.3s)
2. Correct answer highlighted in blue for 1.5s
3. Card resolves at 0.7× with muted effect animation
4. Card goes to discard

**Wrong answer DOES:**
- Cost the full Charge AP surcharge (+1 AP spent, no refund)
- Apply partial effect (0.7×)
- Break the Knowledge Chain counter
- Spawn an Echo card (85% chance) for that fact

**Wrong answer does NOT:**
- Destroy the card
- Deal self-damage (unless relic effect, e.g., Volatile Core)
- End the turn

---

## 16. Relic System (AR-59.10 — 5-Slot System, updated AR-92)

### Core Rules

- **5 active relic slots** per run. Expandable to 6 via Scholar's Gambit (rare, cursed).
- **42 total relics.** ~60% build-around, ~40% stat-stick.
- **No starter relic selection** — all players start the run with no relics. First relic earned at Act 1 mini-boss.

### Acquisition

| Source | Type | Notes |
|--------|------|-------|
| Act 1 Mini-Boss | Choice of 1 from 3 | First relic of the run |
| Elite kill | Choice of 1 from 3 | Regular rarity weights |
| Boss kill | Choice of 1 from 3 | Better rarity weights |
| Regular combat | 10% chance | Random drop |

**Rarity weights (regular drops):** Common 50%, Uncommon 30%, Rare 15%, Legendary 5%

**Rarity weights (boss choice):** Common 20%, Uncommon 35%, Rare 30%, Legendary 15%

**Pity timer:** 4 consecutive Common-only acquisitions → next drop guaranteed Uncommon+.

Constants: `MAX_RELIC_SLOTS = 5`, `RELIC_DROP_CHANCE_REGULAR = 0.10`, `RELIC_BOSS_CHOICES = 3`, `RELIC_PITY_THRESHOLD = 4`

### Relic Choose-1-of-3 Reward Display (AR-92)

Boss, elite, and first mini-boss relic rewards now use the **RewardRoomScene cloth display** instead of the flat `RelicRewardScreen.svelte` modal. The flow:

1. Boss/elite/mini-boss defeated → `openRelicChoiceRewardRoom()` is called with 3 relic choices
2. `RewardRoomScene` opens with 3 relic items hovering on the cloth background (bobbing, shimmer effects)
3. Player taps a relic → in-Phaser detail panel slides in (icon, name, rarity label in rarity color, description, Accept/Leave buttons)
4. **Accept** → relic collected with particle burst, other 2 relics disintegrate to the right
5. **Leave** → detail panel dismisses, relics remain on cloth (player can pick a different one)
6. **Continue/Skip** → confirmation dialog → player can leave without taking any relic
7. After collection or skip → `openCardReward()` is called to proceed to card reward
8. If relic slots are full when accepting → slot enforcement triggers `relicSwapOverlay`

### Sell-to-Make-Room

When at 5/5 slots and a new relic is offered:
- All 5 current relics + the new one are shown
- Player must sell one to make room (or pass on the new relic)
- Selling refunds partial gold based on rarity

Sell values (40% of base shop price): Common = 40g, Uncommon = 64g, Rare = 100g, Legendary = 160g

### Anytime Relic Selling from Tray (AR-92)

Players can sell equipped relics **at any time** from the in-combat relic tray tooltip:

1. Tap any equipped relic slot in combat → tooltip appears showing name and description
2. Tooltip includes a **"Sell (Xg)"** button at the bottom (X = 40% of rarity base price)
3. Tapping the sell button shows an inline confirmation: "Sell for Xg? [Yes] [No]"
4. Confirming → `sellEquippedRelic(id)` is called → relic removed, gold added, slot freed
5. This enables proactive relic management at any point during a run, not only when a new relic is offered

Sell formula: `Math.floor(SHOP_RELIC_PRICE[rarity] * RELIC_SELL_REFUND_PCT)` where `RELIC_SELL_REFUND_PCT = 0.40`.

### Reroll

At boss/mini-boss relic selection events, player may pay `RELIC_REROLL_COST = 50g` to reroll all 3 choices. Maximum `RELIC_REROLL_MAX = 1` reroll per event.

### Build Archetypes

| Archetype | Fantasy | Core Relics | Playstyle |
|-----------|---------|-------------|-----------|
| Chain Master | Long chains, exponential damage | Chain Reactor, Resonance Crystal, Prismatic Shard | Plan chains, seek tag matches |
| Speed Scholar | Fast answers, massive bonuses | Quicksilver Quill, Adrenaline Shard, Time Warp | Charge fast, get bonus multipliers |
| Glass Cannon | High risk, one-shot kills | Volatile Core, Reckless Resolve, Crit Lens | Low HP = high damage, risk everything |
| Iron Fortress | Unkillable, attrition wins | Aegis Stone, Thorn Crown, Regeneration Orb | Stack block, enemy kills itself |
| Poison Alchemist | DoT stacking, indirect damage | Plague Flask, Festering Wound, Toxic Bloom | Apply poison, then burst |
| Burst Master | Save AP, one massive turn | Capacitor, Overflow Gem, Double Down | Defend → Defend → NUKE |
| Knowledge Engine | Quiz mastery = combat mastery | Scholar's Crown, Memory Nexus, Insight Prism | Charge everything, learn everything |

### Complete Relic Catalogue (42 Relics)

#### Chain Relics (Build-Around)

**Chain Reactor** — Rare
Knowledge Chains of 3+ deal 4 splash damage per chain link.
*Synergy: Tag Magnet + Swift Boots + any multi-hit cards*

**Resonance Crystal** — Uncommon
Each chain link beyond 2 draws +1 card at end of turn.
*Long chains refill your hand, enabling longer chains next turn. Snowball engine.*

**Tag Magnet** — Uncommon
When drawing cards, +30% chance to draw cards sharing a `chainType` with your last played card.
*Makes chains more consistent.*

**Echo Chamber** — Rare
Completing a 3+ chain replays the first card in the chain at 50% power (no quiz, no AP cost).
*Free bonus action from chaining.*

#### Speed Relics (Build-Around)

**Quicksilver Quill** — Rare
Charged quizzes answered in under 2 seconds get an additional 1.5× multiplier.
*3.0× × 1.5× = 4.5× for fast correct answers.*

**Adrenaline Shard** — Uncommon
Correct Charged answers in under 3 seconds refund 1 AP (once per turn).
*Fast answerers effectively get 4 AP per turn.*

**Time Warp** — Rare
On Knowledge Surge turns, quiz timer is halved but Charge multiplier increases to 4.0×.
*High-risk, high-reward Surge turns.*

#### Glass Cannon Relics (Build-Around)

**Volatile Core** — Uncommon (Cursed)
All attacks deal +40% damage. Wrong Charged answers deal 5 damage to you AND the enemy.
*Even failures deal enemy damage. Pure aggression.*

**Reckless Resolve** — Uncommon
Below 40% HP: all attacks +50% damage. Above 80% HP: attacks −15% damage.
*Forces edge-of-death play.*

**Crit Lens** — Rare
Charged correct answers have 25% chance to DOUBLE the final damage (after all multipliers).
*The occasional CRITICAL hit.*

#### Defense Relics (Build-Around)

**Aegis Stone** — Uncommon
Block from shield cards carries between turns (max 25). At 25 block, gain Thorns 3.
*Completely changes shield card evaluation.*
Constant: `RELIC_AEGIS_STONE_MAX_CARRY = 25`

**Regeneration Orb** — Uncommon
Heal 3 HP at end of each turn where you played 2+ shield cards.

**Thorn Crown** — Rare
When you have 15+ block at start of turn, reflect 5 damage per enemy attack.

**Bastion's Will** — Rare
Charged shield cards gain an additional +50% block value.
*Makes Charging defensive cards worthwhile.*

#### Poison Relics (Build-Around)

**Plague Flask** — Uncommon
All poison ticks deal +2 extra damage. Poison lasts 1 extra turn.
*Hex goes from 9 total to 20 total damage.*

**Festering Wound** — Rare
When enemy has 5+ poison stacks, all attacks deal +30% damage.

**Toxic Bloom** — Uncommon
When enemy dies from poison, spread 3 poison to all other enemies (reserved for future multi-enemy encounters).

#### Burst Relics (Build-Around)

**Capacitor** — Rare
Unused AP at end of turn stores as Charge (max 3). Next turn, gain stored Charge as bonus AP.
*Enables "save up" turns.*
Constant: `RELIC_CAPACITOR_MAX_STORED_AP = 3`

**Overflow Gem** — Uncommon
When you spend 4+ AP in a single turn, the last card played gets +75% effect.

**Double Down** — Rare
Once per encounter: Charge same card twice. Answer 2 questions. Both correct: 5× power. One correct: 1.5×. Both wrong: 0.3×.
*Ultimate high-stakes play.*

#### Knowledge Relics (Build-Around)

**Scholar's Crown** — Rare
Tier 2+ facts Charged get +30% power. Tier 3 auto-Charged cards get +50%.

**Memory Nexus** — Uncommon
When you correctly Charge 3 cards in one encounter (cumulative), draw 2 extra next turn.

**Insight Prism** — Uncommon
Wrong Charged answers reveal correct answer AND next appearance of that fact auto-succeeds.
*Turns failures into future guaranteed wins.*

**Domain Mastery Sigil** — Rare
If deck has 6+ facts from same domain, all same-domain cards get +20% base (even Quick Play).

#### Economy Relics (Utility)

**Gold Magnet** — Common | +30% gold from all sources.

**Merchant's Favor** — Common | Shops offer 1 additional card and 1 additional relic choice.

**Lucky Coin** — Common | Start each encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1).

**Scavenger's Eye** — Common | See 4 card choices after combat instead of 3.

#### Stat Stick Relics (Always Useful)

**Whetstone** — Common | All attack cards +2 base damage.

**Iron Shield** — Common | Start each turn with 3 block.

**Vitality Ring** — Common | +12 max HP.

**Herbal Pouch** — Common | Heal 4 HP after each combat encounter.

**Swift Boots** — Common | Draw 6 cards per turn instead of 5.

**Combo Ring** — Common | First Charged correct answer each turn grants +2 damage to all attacks that turn.

**Steel Skin** — Common | Take 1 less damage from all sources (min 1).

**Last Breath** — Uncommon | Once per encounter: survive lethal at 1 HP, gain 8 block.

#### Special / Cursed Relics

**Blood Price** — Uncommon (Cursed)
+1 AP per turn. Lose 2 HP per turn.
*4 AP is transformative. HP drain creates urgency.*

**Phoenix Feather** — Rare
Once per run: on death, resurrect at 30% HP. All cards auto-Charge free for 2 turns.

**Scholar's Gambit** — Rare (Cursed)
5 relic slots → 6. Wrong Charged answers deal 3 damage to you.
*More relics, higher quiz penalty.*

**Prismatic Shard** — Legendary (1 per run max)
All chain multipliers +0.5×. 5-chains grant +1 AP.
*THE chain capstone. 5-chain = 3.5× + free AP.*

**Mirror of Knowledge** — Legendary
Once per encounter: after correct Charge, replay card at 1.5× (no quiz, no AP).

**Echo Lens** — Uncommon
Echo cards deal 1.0× regardless of quiz result (prevents wrong-Echo 0.5× penalty).

### Relic Archive (Hub — Meta-Progression)

25 relics are free (available from the start). 17 relics require Mastery Coins to unlock permanently:

**Requires Mastery Coins (17):** Chain Reactor, Resonance Crystal, Quicksilver Quill, Time Warp, Volatile Core, Crit Lens, Thorn Crown, Bastion's Will, Plague Flask, Double Down, Scholar's Crown, Domain Mastery Sigil, Blood Price, Phoenix Feather, Scholar's Gambit, Prismatic Shard, Mirror of Knowledge.

### Relic Display

- Tray at bottom of combat screen shows all equipped relics (up to 5)
- Active relics pulse on trigger (e.g., Aegis Stone glows when block carries)
- Dormant relics (condition not met) shown at 50% opacity
- Tap a relic slot to open an in-game tooltip popup showing the relic name and description
  - Tooltip appears to the left of the tray with a golden arrow pointing toward the relic
  - Dark semi-transparent background (`rgba(24, 33, 46, 0.95)`) with gold border (`#C9A227`)
  - Relic name shown in pixel font (`var(--font-pixel)`); description in small body text
  - Only one tooltip visible at a time; tapping outside or another relic closes/switches it
  - Mobile-friendly: no hover required, works via tap/click

### Hidden Relic Synergies

Some relic combinations trigger undocumented bonuses to reward exploration:
- **Perfect Storm:** Chain Reactor + Prismatic Shard + Resonance Crystal → 3-chain chains draw 2 cards and deal splash
- **Mastery Ascension:** Scholar's Crown + 5 Tier 3 cards in deck → flat damage bonus per mastered card
- **Phoenix Rage:** Phoenix Feather + Blood Price → resurrection gives +50% damage for 5 turns and waives HP drain

---

## 17. Layout System (Portrait + Landscape)

The layout system supports two modes — **portrait** (mobile, 390×844px) and **landscape** (desktop, 1280×720px) — detected at runtime from the viewport aspect ratio. A single `layoutMode` Svelte store (`src/stores/layoutStore.ts`) drives all reactive branching. Portrait mode is pixel-identical to the pre-port design. Landscape is the new desktop work (AR-71+).

**AR-71 foundation (implemented):** `layoutMode` store, CSS vars `--layout-scale`, `--layout-scale-x`, `--layout-scale-y`, `--layout-mode`, `data-layout` attribute on `.card-app`, and Phaser canvas resize on mode change. Dev toggle: `Ctrl+Shift+L`.

Card hand occupies the bottom ~45% of screen. Enemy arena occupies the top 55%. Quiz panel slides in between when Charge is committed.

### Touch Targets

- Minimum tap target: 44×44px (iOS HIG)
- Card tap: entire card face (~80×120px)
- CHARGE button: full-width bar below popped card
- Answer option buttons: minimum 48px height, full width
- End Turn button: bottom-right, always visible

### Card States

| State | Visual |
|-------|--------|
| In hand (unselected) | Normal, fanned arc |
| In hand (adjacent Charge match) | Left-edge tint pulse |
| Popped (selected) | 80px rise, info overlay, CHARGE button |
| Popped (insufficient AP) | Greyed out overlay |
| Quick Playing | 200ms instant animation |
| Dragging (lower zone) | Green glow — Quick Play on release |
| Dragging (upper zone) | Golden glow + "⚡ CHARGE +1 AP" label — Charge Play on release |
| Echo card | Dashed purple border, translucent |
| Tier 3 auto-Charge | Gold shimmer, auto-resolves on play |

### Enemy Intent Display

Enemy intent icon and damage preview shown above enemy sprite at all times. Three types:
- **Attack:** Sword icon + damage value
- **Defend:** Shield icon + block value
- **Buff:** Star icon + effect description

### HP Bar

- Player HP: prominent bar bottom-left of combat HUD
- Clear color transitions: green (>60%) → yellow (30–60%) → red (<30%)
- Numerical HP value alongside bar
- Flash red on damage taken

### Landscape Layout (Desktop — AR-73) [IMPLEMENTED]

Option D split-stage layout for desktop/landscape viewports:

**Three-zone split:**
- **Right 30% — Enemy Panel:** Enemy sprite, HP bar, block bar, intent telegraph. Always visible including during quiz. Enemy centered at `(85%, 45%)` of viewport.
- **Left 70% — Center Stage:** Reserved for quiz panel (AR-76), VFX, and floating HUD elements (relics top-left, combo counter top-center, chain counter top-right).
- **Bottom 26vh — Card Hand Strip:** Full-viewport-width horizontal card row. Cards in `flex-row`, no arc/rotation fan. Selected card rises vertically by 70px. Charge/Quick Play buttons appear above selected card.

**Player HP bar:** Vertical bar at left edge of enemy panel (`x=68%` of viewport), spanning top 20%–80% of viewport height.

**HUD element repositioning (landscape):**
- Relics: top-left of center stage (`2%, 5%`)
- AP orb: left of hand strip, above card hand at `bottom: 28vh`
- Enemy name: top of right panel (`70%–100%`, `2%` from top)
- Intent bubble: below enemy name in right panel
- Pile indicators: left edge above card hand
- End Turn button: right side above hand strip, left of enemy panel
- Combo counter: top-center of viewport

**Background:** Cover-scales to fill full viewport in both modes. Landscape variant loaded first (`_landscape` suffix) with portrait fallback.

**Toggle:** Ctrl+Shift+L (dev only) toggles layout mid-combat without crash. `repositionAll()` in CombatScene recalculates all object positions on layout change.

**Vignette (landscape):** Lighter side vignette (40% vs 52% portrait) on left side only — no right-side vignette to keep enemy panel clean.

### Quiz Panel — Landscape Mode (AR-76) [IMPLEMENTED]

In landscape mode the combat quiz panel (`CardExpanded`) occupies the **center stage** area (left 70% of viewport, above the 26vh card hand), keeping the enemy panel fully visible throughout the quiz.

**Positioning:**
- Outer container: `position: fixed; left: 0; right: auto; top: 50%; transform: translateY(calc(-50% - 13vh))` — vertically centered in the space above the card hand
- Panel width: `min(50vw, 640px)` — constrained within the left-70% zone with padding room

**Keyboard shortcuts (landscape only):**
- Keys `1`–`4` select the corresponding answer button via the `inputService` `QUIZ_ANSWER` action
- A 150 ms blue highlight flash is shown on the selected button before the answer is processed, giving the player visible feedback
- Duplicate keypresses are ignored once an answer is committed (`answersDisabled`)

**Answer button grid (landscape):**
- 3–4 options: 2×2 CSS grid (`grid-template-columns: 1fr 1fr`)
- 5 options: 3-column grid (3 top row + 2 bottom row)
- Each button shows a monospace keyboard-hint badge `[1]`–`[4]` at the left edge

**Card hand dimming:** When the quiz is visible in landscape, the card hand strip dims to `opacity: 0.7` to focus attention. The dimming is applied via the `quizVisible` prop on `CardHand`.

**Animation:** Panel slides up from 30px below target position (200ms ease-out), distinct from the portrait `slide-up-landscape` keyframe.

**Portrait mode:** Pixel-identical to pre-AR-76 implementation. No changes to portrait layout, sizing, or behavior.

**Non-combat quiz screens:** `QuizOverlay.svelte` (gate, study, artifact modes) and `ChallengeQuizOverlay.svelte` use the same center-stage positioning (`left: 0; right: 30%; bottom: 26vh`) in landscape, with the quiz panel centered within that region.

---

## 18. Game Juice

### Why Juice Matters

Player engagement research shows ~200ms is the maximum latency before "instant" feedback feels laggy. Every card play should feel satisfying at the Quick Play speed, and spectacular at Charge speed.

### Card Play Animation Sequence

**Quick Play (200ms total):**
1. Tap → instant play → 200ms type-specific animation → discard

**Charged Correct (500ms total):**
1. Fling → quiz panel slides in → answer → GREEN flash (100ms) → card erupts with particles → type-specific animation → impact sound → discard

**Charged Wrong (300ms total):**
1. Fling → quiz panel → wrong → brief red dim (150ms) → correct answer shown 1.5s → muted weak animation → discard

### Charge-Specific Juice

- **Charge hold:** Progressive golden glow builds on card as drag threshold is crossed
- **Release above threshold:** Audible "whoosh" + quiz panel slide-in
- **Correct answer:** Screen shake + particle burst + impact sound matching card type
- **Wrong answer:** Brief red tint (not punishing) + soft negative sound
- **Free First Charge correct:** "NEW!" text burst + full celebration

### Surge Juice

- Surge announcement: golden screen edge pulse + bass thrum + AP icon change
- During Surge: all cards glow gold, ambient particles gold-tinted
- Surge chain climax: "KNOWLEDGE CHAIN!" text + screen shake + celebration

### wowFactor Display

On first-ever correct answer for a Tier 1 fact, a "fun fact" summary pops up for 2s (non-blocking):
- "Did you know? [brief fascinating note about the fact]"
- Fires only on Tier 1 correct Charge (when the fact is genuinely new to the player)
- Research: Curiosity gap (Loewenstein, 1994) — surprise facts create memory consolidation hooks

### Correct Answer Juice Stack (fires on Charged correct)

1. Answer highlight (correct option turns green, 100ms)
2. Card particle burst (200ms)
3. Screen shake (150ms, intensity by multiplier)
4. Impact sound (archetype-matched)
5. HP/block bar update animation
6. Combo/chain counter update
7. Tier-up celebration if applicable

---

## 19. Sound Design

| Sound | Trigger |
|-------|---------|
| Charge buildup | Card drag above 40px threshold |
| Charge release | Fling / CHARGE button tap |
| Correct answer | Quiz correct + card effect |
| Wrong answer | Quiz wrong (soft, non-punishing) |
| Quick Play | Instant tap-to-play |
| Chain build | Each new chain link |
| Chain climax | 3+ chain completion |
| Surge announce | Bass thrum on Surge turn start |
| Surge active | Ambient golden hum throughout Surge turn |
| Tier-up | Fact advances to new FSRS tier |
| Mastery Trial | Distinct fanfare on Tier 3 achievement |
| Boss Quiz Phase | Dramatic pause music shift |
| Enemy enrage | Menacing audio shift |

---

## 20. Accessibility

- **Slow Reader mode (Settings):** +3s to all timers, amber timer bar
- **CHARGE button tap mode:** Charge can be triggered by tapping CHARGE button (not hold-only); fling gesture is one input method, button is another
- **High contrast mode (planned):** AP badge colors confirmed to pass WCAG AA
- **Font size scaling:** UI scales with `--layout-scale` CSS variable for different screen sizes

### Chain Type Icons (AR-82 — Colorblind Support)

Each of the 6 chain types has a unique SVG icon rendered alongside its color, providing a redundant visual channel for colorblind players:

| Chain Type | Index | Color | Icon Shape |
|------------|-------|-------|-----------|
| Obsidian | 0 | #546E7A | Diamond |
| Crimson | 1 | #EF5350 | Flame |
| Azure | 2 | #42A5F5 | Droplet |
| Amber | 3 | #FFA726 | Star |
| Violet | 4 | #AB47BC | Crescent |
| Jade | 5 | #26A69A | Leaf |

Icons appear at 10–12px in:
- Card face (bottom-left corner, over chain glow area)
- Card hover tooltips (alongside chain name)
- Card reward screen chain-type badges
- Shop removal picker (chain composition summary and per-card badge)

Icon path data: `src/data/chainIcons.ts`. Component: `src/ui/components/ChainIcon.svelte`.

### UI Scale Slider (AR-82 — Desktop Accessibility)

Settings → Accessibility panel includes a UI Scale slider:
- Range: 80% to 150%, step 5%, default 100%
- Persisted to `localStorage` key `recall-rogue-ui-scale`
- Applied as a multiplier on top of the computed `--layout-scale` CSS variable
- Live preview — changes apply immediately as the slider moves
- Available in both portrait and landscape settings layouts

---

## 21. Daily Expedition

Same seed all players. Score = accuracy × speed × depth × chains. One attempt/day. Leaderboard (read-only). Rewards: participation badge, bonus for top 10%/25%/50%.

Why critical: Wordle's entire viral success = one-a-day appointment. STS daily climb = most-played mode. "Did you beat today's Expedition?" = organic marketing.

### Implementation Status

- Daily runs submit to backend leaderboard category `daily_expedition` with `metadata.dateKey` (`YYYY-MM-DD`)
- Backend enforces one Daily submission per user per date key
- Daily leaderboard API supports date-key filtering (scoped to current daily seed cycle)

---

## 22. Japanese Language Decks (JLPT N5–N1)

13,073 facts across 4 subdecks:

### Vocabulary Subdeck (7,726 facts)

JLPT distribution: N5 (822), N4 (774), N3 (3,347), N2 (1,242), N1 (3,828).

Quiz format (Tier 1): "What does '食べる' (たべる) mean in English?" Answers: [to eat / to drink / to see].
Tier 2 reverse: "How do you say 'to eat' in Japanese?" Answers: [食べる / 飲む / 見る].

### Kanji Subdeck (2,230 facts)

JLPT distribution: N5 (79), N4 (164), N3 (546), N2 (189), N1 (1,118).

### Grammar Subdeck (2,701 facts)

JLPT distribution: N5 (16), N4 (32), N3 (142), N2 (252), N1 (144), Additional (58).

### Kana Subdeck (416 facts)

`japanese_hiragana`: 208 facts. `japanese_katakana`: 208 facts.
Distractors are curated hand-matched pairs based on visual similarity (e.g., あ/お, ソ/ン).

### Display Options

Language-specific settings in `DeckOptionsPanel.svelte`:
- **Furigana display** (default: ON) — ruby annotations above kanji
- **Romaji display** (default: OFF) — romanized Japanese alongside native script

Korean (11,400 facts) and Chinese (13,472 facts) also available. See Architecture doc section 13.5 for all 8 languages (108,950 total language facts).

---

## 23. FSRS Integration

FSRS replaced SM-2 (Anki default since 2023). Tracks Difficulty (1–10), Stability (days), Retrievability (0–1). `ts-fsrs` npm package. Outperforms SM-2 on 350M+ review benchmark.

### Run Pool

| Source | % |
|--------|---|
| Primary domain | 30% (~36 facts) |
| Secondary domain | 25% (~30 facts) |
| FSRS review queue | 45% (~54 facts, only from previously engaged domains) |

Players never see facts from domains they haven't opted into.

### All Quiz Moments Update FSRS

Every quiz event — Charged plays, boss Quiz Phases, shop haggling, elite encounters — updates FSRS state for the tested fact:
- Difficulty (1–10)
- Stability (days)
- Retrievability (0–1)
- consecutiveCorrect
- nextReviewDate

### Question Variety — Reducing Repetition

**Weighted review shuffle:** Overdue facts: 3× weight. Due within 24h: 2× weight. Due within 7d: 1× weight. Not yet due: 0.3× weight. Preserves FSRS integrity while keeping runs fresh.

**Recently-played deprioritization:** Facts from the last 2 runs are deprioritized when building the domain portion (~55%) of the run pool. Review cards (~45%) are NOT affected.

### Stratified Difficulty Sampling

| Difficulty | Target % |
|-----------|----------|
| Easy (1–2) | 30% |
| Medium (3) | 45% |
| Hard (4–5) | 25% |

### New Player Funness Bias

Runs 0–9: funScore ≥ 7 facts are 2× more likely to appear per difficulty tier. Linear decay to zero over runs 10–99. Run 100+: no bias.

### Player Fact State

```typescript
interface PlayerFactState {
  factId: string;
  difficulty: number;           // 1-10
  stability: number;            // Days of memory stability
  retrievability: number;       // 0-1, current recall probability
  consecutiveCorrect: number;
  nextReviewDate: Date;
  lastReviewDate: Date;
  passedMasteryTrial: boolean;
  lastVariantIndex: number;
  totalAttempts: number;
  totalCorrect: number;
  averageResponseTimeMs: number;
}
```

---

## 24. Study Presets & Deck Builder

Players can create up to 10 named study presets, each selecting any combination of domains and subcategories. Managed in the Deck Builder tab within the Library screen.

The hub screen includes a **Study Mode dropdown** near the dungeon gate:
- **All Topics** — general pool across all domains (default)
- **Saved presets** — each named preset appears as an option
- **Languages** — each enabled language domain
- **Build New Deck** — opens the Deck Builder

---

## 25. Monetization

### Mobile (F2P + Subscription)
- **Free:** All gameplay content. Full run loop. 2-3 base knowledge domains. No time gates. No pay-to-win.
- **Scholar Pass ($4.99/mo):** All domains, languages, study decks, cosmetics, multiplayer (future), daily challenges (future).

### Steam (Premium + DLC)
| Product | Price | Content |
|---------|-------|---------|
| Base Game (Early Access) | $9.99 | All 10+ knowledge domains, full roguelike, all card mechanics, all relics |
| Base Game (1.0 Release) | $14.99 | Same + post-EA polish |
| Language DLC (each) | $4.99 | Japanese N5-N3, Korean A1-B1, Spanish A1-B1, etc. |
| Curated Study Packs | $2.99 | SAT Prep, Medical Terminology, etc. |
| Cosmetic DLC | $1.99-3.99 | Card backs, particles, chain themes |

### Universal Rules
- **No pay-to-win:** Relics, card power, run advantages — none purchaseable for real money.
- **Anki imports and community packs:** ALWAYS free on all platforms.
- **Steam purchases are permanent.** Mobile subscription unlocks are active while subscribed.

### Entitlement Architecture [IMPLEMENTED — AR-81]

All content gating is centralised in `src/services/entitlementService.ts`. Components must call `hasDomainAccess(domain)` or `getAccessibleDomains()` rather than checking `platform` directly.

**Free tier domains (mobile/web):** `general_knowledge`, `natural_sciences`, `geography`.

**Steam language DLC map** (each DLC unlocks the `language` canonical domain):

| DLC ID | Language Pack |
|--------|--------------|
| `dlc_japanese` | Japanese (JLPT N5–N3) |
| `dlc_korean` | Korean (TOPIK A1–B1) |
| `dlc_spanish` | Spanish (CEFR A1–B1) |
| `dlc_french` | French (CEFR A1–B1) |
| `dlc_mandarin` | Mandarin (HSK 1–3) |
| `dlc_german` | German (Goethe A1–B1) |

Purchase prompts are surfaced via `getUnlockAction(domain)` which returns the appropriate CTA (subscribe on mobile, DLC link on Steam) without interrupting gameplay flow.

---

## 26. Post-Run Summary (Adventurer's Journal)

Shown after each run ends (victory, defeat, or retreat):

- Total facts answered
- Accuracy breakdown by domain
- Longest chain achieved
- Charge attempts vs Quick Plays ratio
- Floors reached / acts completed
- Gold earned
- Bounty quests completed
- New facts discovered (first time seen)
- Facts that leveled up (tier advances)
- New Mastery Trials passed

---

## 27. Ascension Mode

**Status: Implemented.**

Unlocks after first successful run completion (reach Act 3+ and retreat, or defeat The Curator).

10 Ascension levels, each adds a permanent modifier (all previous levels stack):

| Level | Modifier | Effect |
|-------|----------|--------|
| 1 | Tougher Enemies | All enemies +10% HP |
| 2 | Aggressive Foes | All enemies +10% damage |
| 3 | Fewer Shields | Shield cards 20% less effective |
| 4 | Shorter Fuse | Timer −1s base on all questions |
| 5 | Thin Deck | Start with 10 cards instead of... 10. (Adds to other deck-size constraints.) |
| 6 | Iron Will | No retreat from encounters once committed |
| 7 | Harsh Grading | Close-distractor answers more common (Tier 2a acts like Tier 2b) |
| 8 | Elite Surge | Elites gain boss-tier attacks |
| 9 | Endurance | Must reach Act 2+ to retain rewards on defeat |
| 10 | Heart of the Archive | The Curator gains a secret third phase |

**Design philosophy:** Early levels (1–4) are stat adjustments. Mid levels (5–8) restrict strategies. Late levels (9–10) fundamentally alter the run.

---

## 28. Fact Database

### Scale

20,000+ knowledge facts across 16 domains and 8 languages. Full database at `src/data/`.

### Domain List (16 Knowledge Domains)

| Domain | Example Facts |
|--------|--------------|
| Geography | Capitals, flags, rivers, mountains |
| History | Events, dates, figures, civilizations |
| Science | Elements, physics, biology, chemistry |
| Mathematics | Formulas, theorems, number facts |
| Literature | Authors, titles, quotes, characters |
| Art & Music | Artists, movements, instruments, composers |
| Technology | CS concepts, internet history, programming |
| Nature | Animals, plants, ecosystems, biomes |
| Culture & Society | Traditions, religions, languages |
| Philosophy | Thinkers, movements, concepts |
| Food & Drink | Cuisines, ingredients, techniques |
| Sports | Records, rules, athletes |
| Film & TV | Titles, directors, quotes, history |
| Languages (JLPT, TOPIK, HSK, CEFR) | Vocabulary, grammar, kanji |
| Mythology | Gods, heroes, stories across cultures |
| Space | Planets, stars, missions, physics |

### Fact Schema

Each fact contains: `id`, `question`, `answer`, `distractors[]`, `domain`, `categoryL2`, `chainType` (0-5), `difficulty` (1–5), `funScore` (1–10), `variants[]`, FSRS fields.

### Distractor Generation (MANDATORY RULE)

**NEVER generate distractors from database pools.** ALL distractors MUST be generated by an LLM (Haiku agent) that reads the specific question and produces semantically coherent wrong answers. Database queries for distractor generation are PERMANENTLY BANNED.

### Question Variant Requirements

Each fact requires 4–5 question variants:
- **Forward:** "What is X?" Answer: Y
- **Reverse:** "Which X has property Y?"
- **Fill-blank:** "X is the ___"
- **True/False:** Stated as a factual claim
- **Context:** Used in a sentence/scenario

### Age Gating

Mature content (violence in history, adult literature themes) uses `ageGated: true` flag. Age gate lifted at first run completion if player confirmed adult, or skipped via `btn-age-adult` in onboarding.

---

## 29. Content Quality Pipeline

### Mandatory Processing

All facts must pass through:
1. LLM-generated distractors (Haiku agent, never DB pool)
2. Post-generation validation (check distractors don't accidentally match other facts)
3. QA gates: question brevity (max 12 words), answer brevity (max 5 words/30 chars), distractor coherence

### Quality Requirements Per Fact

- Minimum 8 distractors per fact (top-level pool)
- 4–5 question variants
- `funScore` assigned (1–10 scale; facts scoring ≥7 get funness bias in early runs)
- `visualization_description` for card back art generation

---

## 30. Technical Notes

- **Stack:** Vite 7, Svelte 5, TypeScript 5.9, Phaser 3
- **Mobile:** Capacitor for Android/iOS
- **Desktop:** Tauri v2 desktop wrapper (~10MB installer vs Electron's ~150MB). Rust backend for Steamworks SDK integration. See `src-tauri/` for scaffold.
- **Backend:** Fastify + TypeScript (planned), containerized
- **Data:** Quiz facts via API, cached locally for offline play
- **FSRS:** `ts-fsrs` npm package
- **Sprites:** ComfyUI with SDXL + pixel art LoRA, PNG format, power-of-2 dimensions

### Platform Detection

`src/services/platformService.ts` exposes `platform: 'mobile' | 'desktop' | 'web'` and boolean shortcuts `isDesktop`, `isMobile`, `isWeb`, and `hasSteam`.

Detection order:
1. `window.__TAURI__` present → `'desktop'` (Tauri native window)
2. `window.Capacitor` present → `'mobile'` (iOS / Android via Capacitor)
3. Fallback → `'web'` (plain browser)

**Critical distinction:** Layout mode (portrait/landscape) is **separate** from platform. Layout is determined by viewport aspect ratio at runtime. Platform is determined by which native wrapper is active. A tablet in landscape gets landscape layout. A desktop with a vertical monitor gets portrait layout.

### Layout Scaling System

All UI uses `--layout-scale` CSS variable for responsive design across screen sizes.

### Boot Animation

An 8-second cinematic intro sequence plays on first launch only (controlled by the `recall-rogue-boot-anim-seen` localStorage flag). Skipped automatically when `skipOnboarding` or `devpreset` query params are present.

**Three-act structure:**
- **Part 1 (0–4.8s): Logo Reveal** — Logo deblurs from heavy blur → medium blur → sharp over 1.2s. Warm-gold glow burst at 1.0s with spark particles. "Recall Rogue" title text sweeps in from the left with a gold spark trail at 1.6s. "Bramblegate Games" studio tag fades in at 2.8s. Ambient firefly particles begin at 3.6s.
- **Part 2 (4.8–8.0s): Cave Fly-Through** — Logo fades out. Three cave rings fly toward the camera in staggered sequence, simulating rushing into a dungeon entrance. Campsite background blurs in at 7.0s, crossfading heavy blur → sharp.
- **Part 3 (8.0s+): Handoff** — `boot-anim-complete` event emitted. After 100 ms overlap (so Svelte hub renders behind), Phaser container is hidden and the hub appears seamlessly.

**Tap to skip:** A single tap during the animation sets `tweens.timeScale = 3` and accelerates all particle emitters, completing the sequence ~3× faster.

**Implementation:** `BootAnimScene` (Phaser) is prepended to the scene list only when `startAnimation = true` is passed to `CardGameManager.boot()`. The Svelte `FireflyBackground` and hub content are suppressed while `showBootAnimation` is true to avoid z-index conflicts.

---

## 31. App Store Review Prompt

Timing: After defeating The Archivist (Act 2 boss, first victory feeling) or after completing a Mastery Trial (emotional high). Never on failure, never mid-run.

---

## 32. Push Notifications (Mobile Retention)

| Notification | Timing | Content |
|-------------|--------|---------|
| FSRS due | When 5+ facts are overdue | "3 facts are fading — play a quick run" |
| Daily Expedition available | Reset time | "Today's Expedition is live" |
| Streak at risk | 20h after last play | "Your N-day streak ends in 4 hours" |
| Lore Discovery | After Mastery milestone | "A new Lore Fragment awaits you" |

---

## 33. Competitive Moat

What makes Recall Rogue hard to clone:

1. **Fact database with 20,000+ quality facts** — takes years to build, not months
2. **FSRS integration powering the tier system** — facts get stronger as players learn them
3. **Chains tied to named chain types (chainType 0-5)** — Obsidian, Crimson, Azure, Amber, Violet, Jade; assigned evenly at run start via `chainTypes.ts`
4. **Knowledge Surge rhythm** — turns spaced repetition into gameplay rhythm
5. **Quiz as amplifier, not gate** — requires a fundamental rethink vs. "chocolate-covered broccoli" designs

---

## 34. Automated Playtesting Framework

AI-driven playtesting system using headless combat simulation:

### Three-Tier Architecture

| Tier | Agent | Role |
|------|-------|------|
| **Play** | Haiku | Headless combat simulations. Records JSON logs. |
| **Analyze** | Sonnet | Reads logs, detects balance/UX/progression issues. |
| **Triage** | Opus | Deduplicates, scores by severity × frequency, maintains ranked leaderboard. |

### Player Profiles

| Profile | Accuracy | Speed | Strategy | Purpose |
|---------|----------|-------|----------|---------|
| `beginner` | 50% flat | slow | random | Tests Canary assist, early difficulty |
| `average` | 70% improving | normal | basic | Typical player experience |
| `expert` | 90% flat | fast | optimal | Tests high-Chain balance |
| `speed-runner` | 90% + fast | fast | optimal | Tests Quicksilver Quill snowball |
| `struggling` | 40% declining | slow | random | Stress-tests Canary + Echo mechanics |
| `impatient` | 70% volatile | normal | random, 25% skip | Tests skip/engagement patterns |

### Playtest Dashboard

- Start command: `npm run playtest:dashboard`
- URL: `http://localhost:5175/playtest`
- Campaign runner: `npm run playtest:campaign -- --runs 200 --parallel 5 --campaign-id <id>`

---

## 35. Future Todo (Post-Launch)

- **Knowledge Tree UI:** Dedicated tree-view progression screen visualizing `categoryL2` mastery across all domains, with zoom levels (forest → branch → leaf), overdue-state visual cues.
- **Extended Language Content:** Japanese Grammar deck (JLPT levels), Chinese Hanzi deck, Korean TOPIK grammar, European languages (ES/FR/DE) grammar decks.
- **Mastery Skins (Animated Card Backs):** Tier 2a+ cards unlock looping animated card backs (WAN2.1 video diffusion). Card back reverts to static if FSRS retrievability drops below learned threshold — knowledge decay visualized.
- **Multi-enemy Encounters:** Toxic Bloom and Chain Reactor interactions designed for future multi-enemy rooms.
- **Desktop Port / Steam Release:** Responsive landscape layout, keyboard+mouse input, Tauri wrapper, Steam achievements, Steam Cloud Save, Steam Rich Presence. See `docs/roadmap/phases/desktop-port/` for individual ARs.
- **Anki Deck Import:** Import .apkg files, self-graded quiz system (Wrong/Hard/Good/Easy), FSRS tier conversion from Anki intervals. See `docs/roadmap/phases/anki-import/AR-85-ANKI-DECK-IMPORT.md`.
- **Multiplayer (Seeded Competitive):** Race Mode and Same Cards mode — two players, same seed, compare scores. See `docs/roadmap/phases/future/AR-86-MULTIPLAYER-SEEDED.md`.
- **Leaderboards & Daily Challenge:** Global leaderboards, daily seeded challenge (one attempt/day), scoring formula. See `docs/roadmap/phases/future/AR-87-LEADERBOARD-DAILY-CHALLENGE.md`.
- **Community Packs & Steam Workshop:** User-created fact packs, Workshop distribution, self-graded quiz for community content. See `docs/roadmap/phases/future/AR-88-COMMUNITY-PACKS-WORKSHOP.md`.
- **Cross-Platform Save Sync:** Cloud save across mobile and Steam, conflict resolution, account linking. See `docs/roadmap/phases/future/AR-89-CROSS-PLATFORM-SAVE.md`.

---

## 36. Desktop Port & Responsive Layout [PLANNED — Steam Early Access]

### Overview

One codebase, two layout modes. The app detects viewport aspect ratio at runtime and switches between portrait (mobile) and landscape (desktop) layouts. No separate branches or builds — layout mode is determined by viewport shape, platform is determined by runtime wrapper (Capacitor = mobile, Tauri = desktop, bare = web).

### Layout Modes

**Portrait (existing, unchanged):**
- 390×844px design canvas, 9:16 aspect ratio
- Top 58% = enemy display (Phaser), bottom 42% = card hand overlay (Svelte)
- Touch-first input, 48px touch targets

**Landscape (new — "Option D"):**
```
+----------------------------------------------------+
| [Relics] [Chain Counter] [Combo]  |   ENEMY        |
|                                   |   Sprite       |
|                                   |   HP Bar       |
|        CENTER STAGE               |   Intent       |
|    (Quiz panel appears here       |   Status FX    |
|     when Charge is committed)     |   Damage nums  |
|                                   |                |
+-----------------------------------+----------------+
|  [Card1]  [Card2]  [Card3]  [Card4]  [Card5]      |
|              [AP: 3/3]  [Surge indicator]          |
|         [Quick Play]  [CHARGE +1 AP]               |
+----------------------------------------------------+
```

- 1280×720px design canvas, 16:9 aspect ratio
- Right 30% = enemy panel (always visible, even during quiz)
- Left 70% = center stage (background, VFX, quiz panel when active)
- Bottom 25-30% = card hand strip (full width)
- Hub: full 16:9 widescreen campsite background (`camp-background-wide.jpg`, 1920×1080) fills the entire viewport; the 9:16 interactive hotspot column is centered transparently over it

### Input System (Landscape) [IMPLEMENTED — AR-74]

Keyboard shortcuts (landscape only — portrait remains touch-only):

| Key | Action | Context |
|-----|--------|---------|
| 1-5 | Select card from hand | Card hand visible |
| Q | Quick Play (no quiz) | Card selected |
| E | Charge Play (quiz for bonus AP) | Card selected |
| 1-4 | Select quiz answer | Quiz visible (overrides card select) |
| Enter | End Turn | Combat |
| Escape | Deselect / Cancel / Navigate Back | Context-dependent (blocked during quiz) |
| Space | Confirm / Skip Animation | Any |
| Tab | Toggle deck/discard view | Combat |
| ? or / | Open/close keyboard shortcut help | Any |

**Input service architecture:** `src/services/inputService.ts` provides a pub/sub dispatcher for semantic `GameAction` types. `src/services/keyboardInput.ts` subscribes to `layoutMode` and only binds keyboard listeners in landscape mode. Components subscribe to `inputService` in `onMount` and unsubscribe in `onDestroy`. Keyboard module calls `setQuizVisible()` context-awareness from `CardCombatOverlay`.

**Mouse-only guarantee:** Every action is performable with mouse clicks alone. Keyboard shortcuts are acceleration, not requirements. Verified:
- Select card: clickable
- Quick Play / Charge: clickable buttons
- Quiz answer: clickable buttons
- End turn: clickable button
- Navigate back: clickable back button

Mouse enhancements (landscape only):
- Hover card: 1.05× scale lift + info preview tooltip showing mechanic name, AP cost, chain type
- Hover enemy: expanded intent tooltip (planned — AR-74 hover base implemented)
- Right-click card: detailed info popup (planned)
- Click outside modal: dismiss

**Keyboard shortcut help overlay:** `KeyboardShortcutHelp.svelte` — toggle with `?` key, only renders in landscape, shows all shortcuts organized by context (Combat, Quiz, Navigation, General). A `?` button in `CardCombatOverlay` provides mouse-accessible trigger.

### Steam Integration

- **Tauri v2** desktop wrapper (~10MB installer)
- Steam Achievements mapped 1:1 from in-game achievements
- Steam Cloud Save
- Steam Rich Presence (shows current floor, enemy, activity)
- Steam Deck Verified target (1280×800)

### Target Resolutions

| Viewport | Priority |
|----------|----------|
| 1920×1080 (FHD) | Must pass |
| 1280×800 (Steam Deck) | Must pass |
| 2560×1440 (QHD) | Should pass |
| 3440×1440 (Ultrawide) | Should pass (letterbox OK) |

### Implementation ARs

See `docs/roadmap/phases/desktop-port/README.md` for the full dependency graph and status of 14 individual implementation ARs (AR-71 through AR-84).

---

## 37. Anki Deck Import [PLANNED — Future Release]

Players import existing Anki decks (.apkg files). Anki cards become facts in the game's fact pool. Instead of multiple-choice quiz, Anki-imported facts use a **self-graded recall system** — see question, think, reveal answer, self-rate.

### Self-Graded Quiz System

```
Phase 1: See question (front of card) → [Reveal Answer]
Phase 2: See answer (back of card) → [Wrong] [Hard] [Good] [Easy]
```

| Self-Grade | Charge Multiplier | Chain Effect |
|------------|------------------|--------------|
| Wrong | 0.6× | Breaks chain |
| Hard | 1.5× | Continues chain |
| Good | 2.5× | Continues chain |
| Easy | 3.5× | Continues chain |

### FSRS Tier Conversion

| Anki Interval | FSRS Tier |
|---------------|-----------|
| 0-7 days | Tier 1 (Learning) |
| 8-30 days | Tier 2a (Familiar) |
| 31-90 days | Tier 2b (Confident) |
| 91+ days | Tier 3 (Mastered) |

### Key Rules
- **No distractors.** Anki facts use self-graded recall only.
- **Always free** on all platforms.
- **Stored locally** (not in cloud fact database).
- Imported decks appear as selectable domains at run start.
- Re-import updates existing facts, no duplicates.

See `docs/roadmap/phases/anki-import/AR-85-ANKI-DECK-IMPORT.md` for implementation details.

---

## 38. Steam Integration [PLANNED — Desktop Port]

> **Implementation AR:** AR-80 (Steam Integration Service), AR-81 (Monetization & Entitlements)

All Steam API calls are routed through `src/services/steamService.ts`, which guards every call behind `hasSteam` (= `isDesktop` from `platformService.ts`). On web and mobile, all Steam calls silently no-op. The Rust/Tauri side (`src-tauri/src/steam.rs`) is stubbed pending Steamworks SDK crate integration.

### Achievements

| Steamworks API Name | In-Game Trigger | Display Name |
|---------------------|-----------------|--------------|
| `FIRST_RUN` | First run completed | First Steps |
| `REACH_ACT_2` | Act 2 reached | Into the Depths |
| `REACH_ACT_3` | Act 3 reached | The Archive Awaits |
| `DEFEAT_CURATOR` | Final boss defeated | Knowledge is Power |
| `CHAIN_5` | 5-card chain built in one turn | Chain Master |
| `MASTER_10` | 10 facts at Tier 3 | Scholar |
| `MASTER_50` | 50 facts at Tier 3 | Professor |
| `MASTER_100` | 100 facts at Tier 3 | Sage |
| `PERFECT_ENCOUNTER` | Encounter won without taking damage | Untouchable |
| `PERFECT_ACCURACY` | Run completed with 100% Charge accuracy | Flawless Mind |
| `ASCENSION_1` | Ascension 1 run completed | Rising Challenge |
| `ASCENSION_10` | Ascension 10 run completed | Ascended |
| `RELIC_COLLECTOR` | All relics found at least once | Relic Hunter |
| `ALL_DOMAINS` | Full run in every knowledge domain | Renaissance |

Achievements are registered in `src/data/steamAchievements.ts`. Unlock calls go through `steamService.unlockAchievement(id)`.

### Steam Cloud Save

- `steamService.cloudSave(data)` — serialize run + player save to JSON, write via Steamworks Cloud
- `steamService.cloudLoad()` — read cloud save on launch
- Conflict resolution: compare timestamps; prompt player if cloud save is newer than local
- Auto-save triggers: run end, encounter end

### Rich Presence

Updated on every screen change via `updateRichPresence()` wired into `CardApp.svelte` `$effect`:

| Screen | Rich Presence string |
|--------|----------------------|
| `hub` / `mainMenu` | "In the Hub" |
| `combat` | "Floor N — Fighting {enemy}" |
| `cardReward` | "Choosing Rewards" |
| `shopRoom` | "Browsing the Shop" |
| `library` | "Studying — {domain}" |
| `restRoom` | "Resting at the Campsite" |
| `dungeonMap` / `roomSelection` | "Floor N — Choosing Path" |
| `retreatOrDelve` | "Deciding — Retreat or Delve Deeper" |

### Steam Deck Verification

Target resolution: **1280×800** (landscape layout, same as desktop). All UI must be readable and all interactions reachable by mouse/trackpad (keyboard shortcuts are acceleration, not required). On-screen keyboard triggers for any text input field.

### Steam Overlay Compatibility

Phaser canvas must not capture `Shift+Tab` (Steam Overlay toggle). Verified by ensuring the keyboard shortcut service ignores `Shift+Tab` in its bindings.

---

## Key Numbers Reference

| Metric | Value |
|--------|-------|
| AP per turn | 3 (base), 5 (max) |
| Cards drawn per turn | 5 (base), 6 with Swift Boots |
| Starter deck size | 10 |
| Quick Play multiplier | 1.0× |
| Charge correct multiplier | 2.5× (Tier 1), 3.0× (Tier 2a), 3.5× (Tier 2b) |
| Charge wrong multiplier | 0.6× (Tier 1), 0.7× (Tier 2a/2b) |
| Charge AP surcharge | +1 AP (0 during Surge, 0 for Tier 3, 0 for Free First Charge) |
| Tier 3 auto-Charge | 1.2× base, no quiz, no AP surcharge |
| Surge frequency | Every 3rd turn (turns 2, 5, 8, 11...) |
| Free First Charge wrong multiplier | 1.0× (no penalty) |
| Chain 2/3/4/5 multipliers | 1.3× / 1.7× / 2.2× / 3.0× |
| Relic slots | 5 (6 with Scholar's Gambit) |
| Run length | ~25–30 minutes |
| Acts | 3 |
| Rooms per path | ~16–18 |
| Quizzes per run | 45–70 |
| Total relics | 42 |
| Total card mechanics | 26 (active) |
| Strike base damage | 8 |
| Block base value | 6 |
| Boss quiz phase questions | 5–8 per phase |
| Rest site Study | Choose 1 eligible card to upgrade (no quiz) |
| Shop haggle | 1 question per purchase, 30% discount |
| FSRS Tier 2a threshold | stability ≥ 2d, consecutiveCorrect ≥ 2 |
| FSRS Tier 2b threshold | stability ≥ 5d, consecutiveCorrect ≥ 3 |
| FSRS Tier 3 threshold | stability ≥ 10d, consecutiveCorrect ≥ 4, passedMasteryTrial |
| Mastery Trial timer | 4 seconds |
| Mastery Trial options | 5 (close distractors) |
| Player start HP | 120 |
| Enemy pity timer (relics) | 4 consecutive Common drops → guaranteed Uncommon+ |
