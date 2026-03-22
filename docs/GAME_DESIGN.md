# Recall Rogue — Game Design (Single Source of Truth)

> **One-line summary:** Card roguelite where knowledge IS power — Quick Play cards for base effect, Charge them with quiz answers for massive multipliers, chain related facts for exponential damage. The more you know, the stronger you become.
>
> **Version:** v2 (overhaul complete). The v1 mining-era design doc has been deleted — it is fully superseded by this document.

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

     QUICK PLAY (click popped card):
       - Card plays instantly at 1.0× base power
       - No quiz. 200ms animation. Fast, snappy.
       - Costs card's base AP only
       - Does NOT trigger Chains (Chain counter resets)

     CHARGE PLAY (drag card into upper screen zone above ~40% from top, or click CHARGE button):
       - Costs card's base AP + 1 additional AP (the "Charge surcharge")
       - Quiz panel appears. Timer starts. No backing out.
       - CORRECT ANSWER → card plays at 1.5× base + mastery bonus. 500ms celebration.
       - WRONG ANSWER → card plays at 0.6× / 0.7× / 0.7× (per FSRS tier). 300ms muted resolve.
       - Card is never wasted — wrong answers still resolve (at 0.7× or lower).
       - Contributes to Knowledge Chain if same chainType (0-5) as previous Charge.
       - MASTERED cards (level 5): auto quick-play with no quiz (except final boss).

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
| 1 Charged Strike (correct, mastery 0) | 2 AP | 12 | 6 dmg/AP |
| 1 Charged Strike (correct, mastery 3) | 2 AP | 18 | 9 dmg/AP |
| 1 Charged Strike (wrong, Tier 2a) | 2 AP | 5.6 | 2.8 dmg/AP |
| 1 Charged Strike (correct) + 1 Quick Strike | 3 AP | 12 + 8 = 20 | 6.7 dmg/AP |

**Quick Play is AP-efficient. Charge is power-efficient but expensive.** The +1 AP surcharge prevents "always Charge everything" — with 3 AP, you can Quick Play 3 cards OR Charge 1 + Quick 1. Meaningful tradeoff every turn.

### Mastery Upgrade System (AR-113)

Cards have 5 in-run mastery levels (0–5). Mastery resets each run. It is the **primary power scaling axis** — the more correctly you answer a card's question, the more powerful the card becomes mid-run.

**Level colors:** L0 = base (no icon), L1 = green, L2 = blue, L3 = purple, L4 = orange, L5 = gold + glow aura.

| Rule | Detail |
|------|--------|
| Correct Charge answer | Card upgrades one mastery level (once per encounter) |
| Wrong Charge answer | Card downgrades one mastery level (once per encounter) |
| Quick Play | No mastery change |
| Per-encounter cap | Each card can only upgrade or downgrade once per encounter (flag resets on next encounter) |
| Level 5 (Mastered) | Card auto quick-plays with no quiz — except at the final boss |
| Rest Site Study | Correct answer → +1 mastery to a specific card (max 3 cards; no downgrades possible) |

**Stat display:** Card descriptions show base+bonus format: "Deal 8+2 damage" where the +2 bonus is rendered in green. Bonus scales with mastery level.

**Mechanic-level caps (AR-116):** Some mechanics cap their mastery below level 5:
- `immunity`: max level 2
- `cleanse`: max level 2
- `overclock`: max level 3
- `quicken`: max level 3
- `transmute`: max level 3

**Distractor count:** 2 distractors at mastery 0; 3 distractors at mastery 1+.

**Visuals:**
- Upgrade icon bobs gently on L1+ cards
- "Upgraded!" / "Downgraded!" popup appears on mastery change
- Stat values flash green (upgrade) or red (downgrade) when mastery changes

**Cursed cards:** Cards carrying cursed facts are effectively locked at mastery 0 until the curse is cured. Mastery Surge has no effect on cursed cards. Cure (correct Charge on a cursed fact) restores normal mastery tracking.

### Charge Gesture (Touch UX)

| Action | Gesture | Result |
|--------|---------|--------|
| Inspect card | Tap card in hand | Card pops up, shows full stats |
| Quick Play | Click popped card | Instant play at 1.0×, no quiz |
| Quick Play (drag) | Drag card upward into lower zone (below ~40% screen height), release past 60px | Quick Play, no quiz |
| Charge Play | Drag card into upper zone (above ~40% screen height) OR click CHARGE button | Quiz triggers on release |
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

- **First Charge of any fact in a run:** AP surcharge = 0. Wrong answer = 0.0× (card fizzles — no damage/effect dealt. The cost of guessing wrong on an unknown fact.)
- **Subsequent Charges of the same fact:** Normal +1 AP surcharge applies.
- **Visual indicator:** CHARGE button shows **"FREE"** (instead of "+1 AP") for not-yet-Charged facts.
- **Tier 3 auto-Charge does NOT consume the free Charge** — the player didn't consciously choose to Charge.

**Natural run arc:**
- Act 1: Most facts are new → CHARGE buttons show "FREE" → players must decide: risk a fizzle to learn, or Quick Play for guaranteed 1.0×.
- Act 2: Mix of "FREE" and "+1 AP" → selective Charging of known facts.
- Act 3: Mostly "+1 AP" → veteran players Charge with confidence.

Balance constants: `FIRST_CHARGE_FREE_AP_SURCHARGE = 0`, `FIRST_CHARGE_FREE_WRONG_MULTIPLIER = 0.0`

### Action Points (Turn Economy)

**3 AP per turn. Hard cap 5 AP (via relics/passives). Cards cost 0–3 AP. Skip is free.**

AP badge colors:
- Green: 0 AP (free)
- Blue: 1 AP (standard)
- Orange: 2 AP (heavy)
- Red: 3 AP (full turn)

### Fact-Card Pairing — Per-Draw FSRS Shuffling (AR-93)

Card slots (type + mechanic + base effect) are created at run start, but facts (the questions to answer) are **assigned fresh each draw** from the run's FSRS fact pool. This lets spaced repetition surface the facts the player most needs to review on every draw.

1. At run start, `buildRunPool()` creates card SLOTS (with `cardType`, `chainType`, `mechanic`, base effect) from the FSRS-weighted fact pool
2. Each `drawHand()` call selects facts from the fact pool via seeded RNG (`'facts'` fork) and assigns them to the drawn cards
3. Facts rotate each draw — the same card slot may show a different fact on the next encounter
4. Cooldown deduplication prevents recently-seen facts from reappearing for 3–5 encounters
5. Tier multiplier is derived from the FSRS mastery tier of the fact at the time it was initially selected into the pool

**Chain type** is assigned to card SLOTS permanently at run start. Each run selects 3 of the 6 chain types (Obsidian, Crimson, Azure, Amber, Violet, Jade) deterministically using the run seed (`selectRunChainTypes()` in `src/data/chainTypes.ts`). All cards in the run are assigned one of these 3 types. This increases chain frequency from ~15% (6 types, 5 cards) to ~50% of hands, making chains a realistic, buildable strategy rather than a rare coincidence. Chain composition is stable across draws because chain types belong to slots, not facts.

**Chain color** is derived from the card's `chainType` (0-5) — same chainType = same chain color = can chain together. Colors are defined in `src/data/chainTypes.ts`.

### Encounter Cooldown & Anti-Repetition

All facts seen during an encounter enter a 3–5 encounter cooldown. Three deduplication layers:

1. **Same-hand dedup:** No two cards in the same 5-card hand share the same underlying fact (exact ID, base key, and root ID dedup).
2. **Encounter cooldown:** All facts that appeared in any hand during an encounter enter cooldown (3–5 encounters, random per fact). Root-sibling variants also blocked.
3. **Cross-run dedup:** Facts from the last 2 runs are deprioritized when building the next run's pool.

### The Commit-Before-Reveal Rule (CRITICAL)

The quiz question is hidden until the card is committed to Charge. Once committed, there is no cancel — must answer or auto-fizzle when timer expires.

Research: Roediger & Karpicke (2006) — retrieval practice = 87% retention vs 44% for restudying. Kornell et al. (2009) — even failed retrieval beats passive viewing.

**Stage 1 — In hand:** Cards fan in arc. Shows mechanic name, effect value, difficulty stars, AP cost badge, chain color tint. No question visible.

**Stage 2 — Selected (click to rise):** Card rises 80px with info overlay. Can freely deselect. Strategic decision point — Charge or Quick Play?

**Stage 3 — Committed (click CHARGE / fling up):** Quiz panel appears. Timer starts. No cancel.

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

Cards use a **PSD-based layered V2 frame system** (AR-107). Each card composites 3 layers extracted from a master PSD (`data/generated/camp-art/NEW_CARD.psd`, 886×1142px) with text overlaid via CSS at PSD guide positions:

- **Border layer** (hue-shifted by card type): Indicates the card's mechanical category at a glance.
  - Attack: Red | Shield: Blue | Buff: Purple | Debuff: Green | Utility: Teal | Wild: Gold
- **Base frame layer** (constant): The shared structural frame — book icon area, pentagon art window, text area background. Identical across all cards.
- **Banner layer** (hue-shifted by chain type): The banner across the mechanic name area signals chain affinity.
  - ChainType 0: Obsidian (gray) | 1: Crimson | 2: Azure | 3: Amber | 4: Violet | 5: Jade
- **Pentagon art window:** Empty window ready for per-fact generated card art.
- **AP cost:** Yellow (`#fbbf24`) Cinzel bold with black outline, rendered as a CSS text overlay in the book icon area. Turns red when current cost exceeds base cost, green when below base cost.
- **Mechanic name:** Black text with white outline, Cinzel font, centered over the banner as a CSS overlay. Not baked into art.
- **Card type label:** Small sans-serif label positioned between the art window and text area.
- **Effect text:** White sans-serif text over the dark lower text area. Clean readability on dark background.
- **Upgrade icon:** Green cross icon with float animation displayed on upgraded cards.
- **CHARGE button:** Displayed below the card in the popped state. Shows "FREE" (first Charge of fact) or "+1 AP" (subsequent Charges). Tap to initiate quiz. **Hover/press preview:** Hovering or touch-pressing the CHARGE button triggers a real-time charge value preview on the selected card — numeric values in the card's description update to show their charged equivalents in green (`#4ADE80`). Leaving the button reverts to normal display. Only active when the charge is affordable.
- **RPG pixel font (AR-71.3):** Card description text uses off-white `#F0E6D2` with a 4-direction black outline for legibility over card art.

### Charge Animation System (AR-59.16)

| Phase | Duration | Effect |
|-------|----------|--------|
| Quick Play | 200ms | Instant click → effect. Lightning fast. |
| Charge fling | 200ms | Card lifts with golden glow building |
| Quiz appears | 150ms | Panel slides in above hand. Timer starts. |
| Correct answer | 500ms | GREEN flash. Card erupts with power particles. Screen shakes. Impact sound. Effect resolves at full multiplier. |
| Wrong answer | 300ms | Brief red dim (not punishing). Correct answer shown 1.5s in blue. Card resolves at 0.7× with muted effect. |

The contrast between Quick Play speed and Charged Play drama makes Charging feel special and deliberate.

### Chain Display (AR-116)

The combo system has been **fully removed** (see §15 Wrong Answer Design for removal note). Only the **Knowledge Chain** display remains.

The chain display sits at the **bottom-left** of the combat screen, colored by chain type, and shows the current chain length and multiplier in the format `"Chain: X.x"` (e.g. `"Chain: 1.7"`). It is only visible when chain length ≥ 2.

---

## 3. Knowledge Chain System (AR-59.3 / AR-93)

### How It Works

Cards have a `chainType` value (integer 0-5, corresponding to Obsidian, Crimson, Azure, Amber, Violet, Jade). When you Charge cards consecutively within the same turn that share a `chainType`, they form a chain. Each card in the chain gets a multiplier.

**Chain is built exclusively by Charge plays.** Quick Play breaks the chain. Wrong Charge answers also break the chain.

**Six distinct chain types** (0-5) map to the 6-color palette defined in `src/data/chainTypes.ts`, but each run only uses 3 of the 6 — selected deterministically by the run seed. This concentrates chain opportunities so that 2-3 matching cards appear per 5-card hand on average. Cards without a `chainType` field contribute no chain.

**Chain state is ACTIVE in combat** (AR-93 Section B): `chainSystem.ts` is wired into `turnManager.ts` and `cardEffectResolver.ts`. The chain multiplier stacks multiplicatively on every card play.

### Chain Multipliers

| Chain Length | Multiplier | Visual Feedback |
|-------------|-----------|-----------------|
| 1 (no chain) | 1.0× | Normal play |
| 2-chain | 1.3× | Subtle glow, thin line connecting cards |
| 3-chain | 1.7× | Bright glow, particle trail, chain sound |
| 4-chain | 2.2× | Screen edge pulse, chain lightning VFX |
| 5-chain | 3.0× | Full celebration, screen shake, "KNOWLEDGE CHAIN!" text |

**Chain multiplier stacks multiplicatively with all other multipliers:**

`finalValue = base × tierMult × chainMult × speedBonus × buffMult × relicMult × overclockMult`

| Scenario | Calculation | Total |
|----------|-------------|-------|
| 3-chain Quick Play Strikes | 8 × 1.7 each | 40.8 |
| 3-chain Charged (correct, Tier 2a) middle card | 8, 24×1.7, 8×1.7 | 62.4 |
| 3-chain all Charged on Surge turn (free Charge, Tier 2a) | 24 × 1.7 each | 122.4 |

The 122-damage Surge chain is the "holy shit" peak. Rare. Players will chase it.

### Chain Rules (Active in Combat)

- `resetChain()` is called at encounter start and at the start of every new player turn (in `endPlayerTurn`)
- Correct Charge: `extendOrResetChain(card.chainType)` is called; multiplier returned and passed to `resolveCardEffect`
- Quick Play: `extendOrResetChain(null)` breaks the chain — no bonus
- Wrong Charge: chain is reset before fizzle resolution — no bonus on the fizzled card
- Chain state stored on `TurnState` as `chainMultiplier`, `chainLength`, `chainType` for UI consumption

### Chain Visual System (AR-59.17 / AR-93)

**Card border + glow (primary identity):** Chain type color is the PRIMARY visual identity of every card. ALL card borders and outer glow use `getChainColor(card.chainType)` / `getChainGlowColor(card.chainType)` from `src/services/chainVisuals.ts`. This applies universally: in-hand cards (portrait and landscape), animating cards, reward screen altar options, shop buy/sell cards, and the expanded quiz card (CardExpanded). The chain border makes it immediately clear which cards can chain together across all game contexts.

**In-hand pulse:** When 2+ cards in hand share a `chainType`, their chain-colored borders pulse in sync.

**Chain ember particles (AR-71.2):** Any card with a `chainType` shows 5 small glowing dots rising from its top edge in the chain color — a "smoldering" effect that indicates chain affinity. Pure CSS animation, `pointer-events: none`.

**During chain play:** A thin glowing line briefly connects played cards as they resolve (animation only, not persistent UI).

**Chain display (AR-93 / AR-116):** When chain length ≥ 2, a `ChainDisplay` at the **bottom-left** shows the chain length and multiplier in the format `"Chain: X.x"` (e.g. `"Chain: 1.7"`) colored by chain type. Implemented inside `ChainCounter.svelte` (chain-only display; combo counter fully removed in expansion).

**Domain color:** Still used for the domain stripe/header bar inside cards and category labels — it conveys what subject matter the card covers. The chain border conveys chaining compatibility.

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

## 4. Knowledge Surge (AR-59.4, updated AR-122)

### Rhythm: Normal → Normal → Normal → SURGE (4-turn cycle)

Surge turns occur every 4th turn, starting on global turn 2 of the run (global turns 2, 6, 10, 14...).

**The Surge counter persists across encounters within a run.** It does NOT reset between fights. If fight 1 ends on global turn 3, fight 2 starts on global turn 4 — Surge may not arrive until global turn 6 (turn 3 of that fight). Short fights may have no Surge at all. This creates unpredictability and makes Surge feel like a meaningful event rather than a reliable clockwork mechanic.

**On Surge turns:** Charging costs **+0 AP** instead of +1. This is the burst window where Charging everything is viable and encouraged. Chain multipliers and Charge multipliers both apply at full strength.

Constants: `SURGE_FIRST_TURN = 2`, `SURGE_INTERVAL = 4`

Implementation: `RunState.globalTurnCounter` (persisted in save state) is passed to `startEncounter()` as the initial `turnNumber`. `TurnState.encounterTurnNumber` tracks per-fight turns for the enrage system separately.

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

### Chain Momentum (AR-122)

When a Charge play results in a correct answer, the NEXT Charge play in the same turn
has its AP surcharge waived (+0 AP instead of +1 AP). This rewards quiz accuracy with
AP savings, enabling longer chains through skill.

- Correct Charge → next Charge is free (surcharge waived, `nextChargeFree = true`)
- Wrong Charge, Quick Play, or turn end → momentum lost (`nextChargeFree = false`)
- Stacks with Surge (no additional effect during Surge since charges are already free, but flag is still consumed)
- UI: CHARGE button displays green "+0 AP" badge with green glow when momentum is active

Constants: `CHAIN_MOMENTUM_ENABLED = true`

### Design Intent

Surge creates RHYTHM. Players learn to:
1. **Normal turns (3 of them):** Quick Play efficiently, build block, manage AP
2. **Pre-Surge turn:** Set up buffs (Empower, Expose) in preparation
3. **Surge turn:** BURST — Charge 2–3 cards, build chains, deal massive damage
4. **Post-Surge:** Recover, defend, prepare for next Surge

Because the counter persists across encounters, Surge timing becomes unpredictable between fights — a short fight might leave the player starting the next encounter mid-cycle, with Surge arriving on turn 2 or turn 4. This adds strategic interest and prevents trivial Surge-gaming.

---

## 4.5. Status Effects & Combat Buffs

### Debuffs (applied to enemy or player)

| Effect | Description |
|--------|-------------|
| **Weakness** | Reduces attack damage by 25% (2 turns base) |
| **Vulnerable** | Increases incoming damage by 50% (1 turn base) |
| **Poison** | Deals flat damage per turn (stacks additively) |
| **Slow** | Skips enemy's next defend/buff action |
| **Burn** | On-hit amplifier: next hit deals +N bonus damage (N = current stacks), then stacks halve (round down). Expires at 0. Does NOT trigger on Thorns/reflect damage. Stacks additively. Multi-hit cards trigger Burn once per hit. Self-Burn variant: player's own Burn triggers when hit by enemy attack (infrastructure for AR-211 Volatile Manuscript relic). |
| **Bleed** | Persistent amplifier: each card-play attack against the target deals +N bonus damage (N = stacks). Does NOT trigger on Poison ticks, Thorns, or Burn. Stacks additively. Decays by 1 at end of each enemy turn. Does not deal independent damage. |

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
- **Bone Collector (AR-123):** Steals up to 5 block from the player when they miss a Charge. Enemy gains that stolen block as HP.
- **Void Mite (AR-123):** Gains 8 block when the player answers wrong on a Charge. Only Charge facts you know — guessing makes it tankier.
- **Core Harbinger (AR-123):** Quick Play deals only 30% damage. Charge for full effect. No longer immune — now resistant.
- **Knowledge Siphon (AR-123):** Gains +2 base damage every time the player Charges correctly. Kill it fast or play defensively.

### Enemy Combat Traits (AR-99 Phase 3)

Enemies can have passive traits that modify how specific play styles interact with them. These traits appear alongside enemy descriptions in the combat UI.

#### chargeResistant
Quick Play attacks deal **50% damage** to this enemy. Charged attacks (correct or wrong) deal full damage. Rewards players who invest AP to Charge their cards.

Enemies with chargeResistant: iron_beetle, geode_beetle, crystal_golem, basalt_crawler, quartz_elemental, iron_core_golem, rock_hermit, tectonic_scarab, granite_hound, tome_mimic, pressure_djinn

#### quickPlayDamageMultiplier (AR-123)
Quick Play attacks deal only **X% damage** (e.g., 30%) to this enemy instead of zero. A softer version of `quickPlayImmune` — players can still chip with Quick Play, but Charging is dramatically more efficient.

Enemies with quickPlayDamageMultiplier: core_harbinger (0.3)

#### chainVulnerable
Chain attacks (Knowledge Chain multiplier > 1.0×) deal **+50% bonus damage** to this enemy. Rewards players who build and sustain chains by answering varied card types correctly.

Enemies with chainVulnerable: cave_spider, root_strangler, stalactite_drake, ember_skeleton, fossil_raptor, lava_crawler, obsidian_shard, blind_grub

#### quickPlayPunish (mini-boss trait, implemented via onPlayerNoCharge)
If the player makes no Charge plays during their turn, the enemy gains **+1 Strength** (permanent for the encounter). Applied to: crystal_guardian, stone_sentinel, iron_archon, obsidian_knight, glyph_warden.

### Stacking Rules

- Multiple Weakness applications extend duration, don't stack intensity
- Poison stacks additively (3 poison + 3 poison = 6 poison per turn, each instance decays independently)
- Block stacks additively within a turn
- Empower consumes on first card played (not on Charge activation)
- Burn stacks additively (6 Burn + 4 Burn = 10 Burn). Expires by halving to 0 on each hit, not by turn countdown.
- Bleed stacks additively. Decays by 1 at end of each enemy turn. Does not trigger on passive damage sources.

---

## 4.6. Inscription Keyword (AR-204)

Inscriptions are a special card keyword. Playing an Inscription card is a one-time, permanent combat commitment.

### Behavior

- **Played once:** An Inscription card is played from hand like any other card.
- **Persists for rest of combat:** Its effect is applied continuously until the encounter ends.
- **Removed from game on play:** The card is moved to the exhaust pile with `isRemovedFromGame: true`. It cannot be recovered by Recollect (AR-208).
- **Pool = 1 per type:** Only one inscription of each mechanicId can be active at a time. Playing a second inscription of the same type is a no-op (card still exhausts, effect does not double-register).

### Three Inscription Types (card definitions ship in AR-206/AR-208)

| Card | Hook Point | QP Effect | CC Effect | CW Effect |
|------|-----------|-----------|-----------|-----------|
| Inscription of Fury | Damage pipeline step 3 (after mastery, before relic flat bonuses) | +N flat attack damage | +N flat attack damage | 0.7× N flat attack damage (Cursed QP rule) |
| Inscription of Iron | Player turn start (before draw) | +N block per turn | +N block per turn | 0.7× N block per turn |
| Inscription of Wisdom | Charge Correct resolution | Draw 1 extra card | Draw 1 extra card + heal 1 HP | Complete fizzle — card exhausted, no inscription registered |

### Damage Pipeline Integration

Inscription of Fury applies at **step 3** of the damage pipeline:
```
effectiveBase = mechanicBaseValue + sharpenedEdgeBonus + inscriptionFuryBonus
```
Only applies to `attack`-type cards. Shield, buff, debuff, utility, and wild cards are unaffected.

### Cursed Inscription

A Cursed Inscription played via Quick Play applies its effect at **0.7×** the base value (standard `CURSED_QP_MULTIPLIER`). Inscription of Wisdom played as Charge Wrong results in a complete fizzle — the card exhausts and is removed from game, but no inscription is registered.

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

For **vocabulary facts** (all languages), card tier controls which question variant types are available — not just option count. See §5 Vocabulary Question Variants below for the full variant system.

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

### Vocabulary Question Variants

All vocabulary facts (across all languages) support multiple question formats that test different cognitive skills. Variants are selected based on card tier to progressively challenge the player as they demonstrate mastery.

#### Active Variant Types

| Variant | Question Format | Answer Format | Cognitive Skill | Available From |
|---------|----------------|---------------|----------------|----------------|
| **Forward** | "What does [L2 word] mean?" | English answer choices | L2 recognition → L1 meaning | Tier 1 (default) |
| **Reverse** | "How do you say '[English]' in [language]?" | L2 word choices | L1 meaning → L2 recall (production) | Tier 2a |
| **Synonym Pick** | "Which word is closest in meaning to [L2 word]?" | English synonym choices | Semantic depth, meaning nuance | Tier 2b |
| **Definition Match** | "[English definition/explanation]" | English answer choices (no L2 word shown!) | Meaning from description without L2 cue | Tier 2b |

#### Future Variant (Requires LLM Generation)

| Variant | Question Format | Answer Format | Cognitive Skill |
|---------|----------------|---------------|----------------|
| **English Context Fill** | "He sat on a park ___" | English answer choices | Deep meaning comprehension, usage in context |

English context fill sentences will be generated by LLM (Haiku sub-agent) and stored in the `variants` field of each fact. This is deferred until the content pipeline supports it.

#### Tier → Variant Mapping

Cards upgrade through tiers as players answer correctly via spaced repetition. Each tier introduces harder question formats:

| Card Tier | Available Variants | Selection Logic |
|-----------|-------------------|----------------|
| **Tier 1** (Learning) | Forward only | Always forward — establish basic recognition |
| **Tier 2a** (Active) | Forward (60%), Reverse (40%) | Random weighted selection. Reverse tests production — harder than recognition |
| **Tier 2b** (Proficient) | Forward (30%), Reverse (30%), Synonym Pick (20%), Definition Match (20%) | All four variants in play. Wider variety prevents rote memorization |
| **Tier 3** (Mastered) | Free recall (type answer) | No multiple choice — existing system |

The variant is selected when the quiz question is generated, not at card creation time. The same card can be asked different ways on different encounters.

#### Distractor Selection — Smart Pool

Distractors for vocabulary questions are selected with these priorities (in order):

1. **Seen-but-not-mastered words first:** Pull from facts the player has encountered in previous runs but hasn't fully mastered (FSRS review state: due or overdue). These are the hardest distractors because the player has partial knowledge — they might confuse similar words they're still learning.

2. **Same difficulty band (±1):** Within the seen pool, prefer words at similar difficulty level to the target fact.

3. **Length matching:** Filter to answers with similar character length (±60%) to prevent length-based guessing.

4. **Unseen pool fallback:** If insufficient seen-but-not-mastered words exist (e.g., early in the game), fall back to the general language pool sorted by difficulty proximity.

5. **Deduplication:** No duplicate answer strings. No distractor matching the correct answer or its acceptable alternatives.

This applies to all languages uniformly — the system is language-agnostic, operating on the English `correctAnswer` values (for Forward, Synonym, Definition) or on the L2 words (for Reverse).

#### Reverse Variant — L2 Word Distractors

For Reverse questions ("How do you say 'bench' in Japanese?"), distractors must be other L2 words (e.g., other Japanese words), not English words. Selection:

1. Prefer L2 words from facts the player has seen but not mastered (same FSRS logic).
2. Prefer words at similar difficulty and similar length (in the target language script).
3. Avoid words that are translations of the same English word (e.g., two words both meaning "bench").

#### Synonym Pick — WordNet Integration

Synonym Pick uses the WordNet lexical database (pre-computed at build time):

- **Correct answers:** Members of the same WordNet synset as the fact's `correctAnswer`. E.g., for "bench" → "seat" is a valid synonym.
- **Distractors:** Other English words NOT in the same synset, preferably from the same hypernym category (e.g., other furniture words like "table", "desk") to make them plausible but wrong.
- **Fallback:** If WordNet has no synset for the answer (multi-word phrases, rare words), this variant is skipped and another variant is selected instead.
- **Coverage:** ~82.9% of single-word English answers have WordNet synsets (pre-computed into `synonymMap.json` at build time). The system gracefully degrades for the rest.

#### Definition Match — Using Existing Data

Definition Match uses the fact's `explanation` field, which contains dictionary-style definitions:

- The question shows the explanation text (stripped of the L2 word if present).
- The answer choices are English words (same as Forward variant).
- The key difference from Forward: the player never sees the foreign word — they must know the meaning deeply enough to match it from a description alone.
- **Fallback:** If the `explanation` field is empty or too short (<10 chars), skip this variant.

#### Language Agnostic Design

This system works identically for all supported languages (Japanese, Korean, Chinese, German, French, Spanish, Dutch, Czech). The variant logic operates on:
- `fact.correctAnswer` (always English) for Forward, Synonym, Definition
- `fact.quizQuestion` / L2 word extracted from the question for Reverse
- `fact.language` for pool selection
- `fact.explanation` for Definition Match

No language-specific code is required. Adding a new language automatically gets all variant types.

---

## 5.5. Combat Visuals & Enemy Sprites

### Enemy Sprite Rendering

Enemies are rendered in the Phaser canvas with pixel-art sprites. First-person dungeon perspective — enemy centered in viewport, player hand at bottom. Enemies animate their intent telegraphs every turn.

### Per-Enemy Combat Backgrounds (AR-110)

Each of the 86+ enemies has a unique combat background image that reflects their lore and environment. The system provides:

- **Two orientations per enemy:** Portrait and Landscape versions, auto-selected at runtime based on viewport aspect ratio
- **Runtime orientation selection:** `getCombatBgForEnemy(enemyId)` in `src/data/backgroundManifest.ts` checks `window.innerWidth / window.innerHeight` and returns the correct path
- **Fallback system:** `getRandomCombatBg()` falls back to segment-based pools when enemy-specific art is missing (Shallow Depths / Deep Caverns / The Abyss / The Archive / Endless Void)
- **Asset location:** `public/assets/backgrounds/combat/enemies/<enemyId>/portrait.webp` and `.../landscape.webp`

This gives each enemy a distinct visual identity and reinforces the dungeon atmosphere with environment-appropriate art.

#### Per-Enemy Lore-Driven Animations (AR-111)

Each of the 84 enemies has a unique idle behavior, attack style, and hit reaction tailored to its visual form and lore identity. Replaces the old 8 generic animation archetypes with per-enemy overrides.

**Animation system:**
- Per-enemy configs in `src/data/enemyAnimationOverrides.ts` (keyed by enemy ID)
- Falls back to archetype-based config if no override exists
- Two custom step types: `rotate` (angle tweening) and `fade` (alpha tweening)
- `getAnimConfig(archetype?, enemyId?)` checks overrides first

**Animation highlights by creature type:**
| Visual Form | Animation Technique | Examples |
|-------------|-------------------|----------|
| Moths/bats | scaleX compression (wing folding) | Page Flutter, Burnout, Moth of Enlightenment, Echo Chamber |
| Worms/slugs | Peristaltic undulation (alternating squash) | Eraser Worm, Gut Feeling, Ink Slug |
| Ghosts | Alpha fading + drift | All-Nighter, Burnout Phantom, Lost Thesis, Blank Spot |
| Heavy golems | Near-still + rare ground-pound squash | Thesis Construct, Textbook, Dissertation, Sacred Text |
| Cursors/blocks | Cursor blink (alpha toggle at rhythm) | Writer's Block |
| Multi-headed | Chaotic angle swings + jitter | Group Project, Hydra Problem, Study Group |
| Pressure vessels | Constant jitter + building scale + squash release | Pressure Cooker, Burning Deadline |
| Jellyfish | Float-up/drop-down bob + scaleY trailing | Bright Idea, Hyperlink |

Config data: `src/data/enemyAnimationOverrides.ts`. System: `src/game/systems/EnemySpriteSystem.ts`.

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

### Surge Border Overlay (§6 — Both Portrait + Landscape)

`SurgeBorderOverlay.svelte` — viewport-level fixed overlay rendered above all content during Surge turns. Works in both portrait and landscape.

- **Canvas 2D particle system** — ~24 particles (2–4px) flowing clockwise around all four viewport edges
- **Colors:** alternating `#FFCA28` (Gilded) and `#FFA726` (Amber) with soft glow
- **Border glow:** 2–3px golden stroke at `rgba(255, 202, 40, 0.35)` with `shadowBlur: 6`
- **Speed:** full perimeter traversal in ~8–12 seconds at 60fps
- **Fade:** 300ms opacity transition on enter/exit via Svelte `fade` transition
- **Performance:** `pointer-events: none`, `will-change: opacity/transform`, low particle count
- Integrated in `CardCombatOverlay.svelte` via `<SurgeBorderOverlay active={isSurgeActive} />`

### Quiz Result Flash (§1 — Landscape Only)

When a quiz answer is submitted in landscape mode, a brief result overlay appears over the quiz panel for 500ms:
- **Correct:** Green tinted overlay (`rgba(34, 197, 94, 0.14)`) + large "CORRECT" text in green
- **Wrong:** Red tinted overlay (`rgba(239, 68, 68, 0.13)`) + large "WRONG" text in red + correct answer revealed
- Fades in over 300ms, auto-dismisses after 500ms
- Implemented in `CardExpanded.svelte` via `quizResultState` local state

### Chain Visual System (AR-59.17)

- **Card border + glow (primary identity):** Chain type color is the primary visual on ALL cards everywhere — in-hand, animating, reward screen, shop, expanded quiz view. Uses `getChainColor` / `getChainGlowColor` from `chainVisuals.ts`
- In-hand pulse: chain-colored borders pulse in sync when 2+ cards share a `chainType`
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

## 5.7. Cursed Card Visuals

Cursed cards have a distinctive visual signature to separate them from normal cards:

- Semi-transparent purple tint over the card frame
- Cracked border (CSS overlay layer)
- `cursed-shimmer` CSS animation — faint purple shimmer
- Cure animation: purple cracks shatter, card glows gold briefly (300ms)
- Clearly distinct from normal cards — no tooltip needed

**Note:** The old Echo system (ghost cards with dashed purple borders that spawned on wrong Charge and exhausted on second fail) was removed. It was replaced by the Cursed Card system — see §1C above for full mechanical specification.

---

## 6. Card Mechanics (91 Active Mechanics)

Cards unlock as character level increases. New players start at level 0 with 36 mechanics (all 31 original + 5 new basics). Exotic mechanics unlock gradually through level 13.

### Starting Deck (10 Cards)

| Card | Count | AP | Quick Play | Charged Correct (2a) | Charged Wrong |
|------|-------|----|------------|---------------------|---------------|
| Strike | 5 | 1 | 8 dmg | 24 dmg | 5.6 dmg |
| Block | 4 | 1 | 6 block | 18 block | 4.2 block |
| Surge | 1 | 0 | Draw 2 cards | Draw 3 cards | Draw 1 card |

**10 cards = cycle every 2 turns** (draw 5 per turn). Each card reward is a 10% deck change — immediately impactful. Boring by design; interesting mechanics come from rewards.

**One Surge (0 AP, draw 2):** The single interesting starter card. Charging Surge costs 1 AP (the +1 surcharge) for draw 3 — introduces the Charge value proposition naturally.

### Card Unlock Progression (Level 0–13)

| Level | New Cards Unlocked | Total Available | Design Intent |
|-------|-------------------|-----------------|---------------|
| 0 | 31 existing + Power Strike, Iron Wave, Reinforce, Inscription of Fury, Inscription of Iron | 36 | Core game. All existing mechanics + basic upgrades + build-defining Inscriptions from day 1. |
| 1 | Bash, Guard, Sap, Inscription of Wisdom | 40 | First upgrades + final Inscription. |
| 2 | Twin Strike, Shrug It Off, Swap | 43 | Cycling and multi-hit. |
| 3 | Stagger, Sift, Riposte | 46 | Tempo and scry tools. |
| 4 | Rupture, Lacerate, Scavenge, Absorb, Precision Strike | 51 | Bleed archetype introduced. |
| 5 | Kindle, Ignite, Corrode, Overcharge, Archive | 56 | Burn archetype + combat persistence. |
| 6 | Gambit, Curse of Doubt, Knowledge Ward, Aegis Pulse, Reflex, Unstable Flux, Chameleon | 63 | Quiz-reward cards + wild cards. Knowledge-is-power identity solidifies. |
| 7 | Burnout Shield, Battle Trance, Volatile Slash, Corroding Touch, Phase Shift | 68 | Exhaust archetype + advanced utility. |
| 8 | Ironhide, War Drum, Chain Lightning, Dark Knowledge, Mark of Ignorance, Sacrifice | 74 | Chain archetype + curse-as-weapon emerge. |
| 9 | Smite, Entropy, Bulwark, Conversion, Chain Anchor | 79 | Build-defining specialists. |
| 10 | Feedback Loop, Frenzy, Aftershock, Synapse, Catalyst | 84 | High-skill ceiling cards. |
| 11 | Recall, Mastery Surge, Tutor, Mimic, Siphon Strike | 89 | Discard/mastery scaling + toolbox cards. |
| 12 | Eruption (X-cost) | 90 | X-cost introduced. |
| 13 | Knowledge Bomb, Siphon Knowledge | 92 | Final quiz cards. Encounter-scaling spectacular + study-during-combat. |

**Note on total:** 91 unique mechanic IDs total. The table shows 92 unlock slots because Inscription of Fury and Inscription of Iron appear in both the Buff and Inscription categories — they are the same cards, not duplicates.

### Complete Mechanics Reference (v2 — QP / Charge Correct / Charge Wrong)

All 91 active mechanics. Quick Play (QP) = 1.0×. Charged Correct = 1.5× base + mastery bonus (see Mastery Upgrade System). Charged Wrong = 0.6×/0.7×. Values shown at mastery 0, Tier 2a (1.5×/0.7×) for standard reference.

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
| **Focus** | 1 | Next card −1 AP | Next 2 cards −1 AP | Next card −1 AP | Charged = 2 discounts. Card description reads "Next N cards" where N includes mastery bonus. |
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
| **Scout** | 1 | Draw 2 cards | Draw 3 cards | Draw 1 card | Hand cycling. Card description shows actual draw count (not a placeholder). |
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
3. **Wrong answers always give SOMETHING (0.7×).** Never a total waste. But always worse than Quick Play (1.0×). Clear punishment without run-ending frustration. Exception: Feedback Loop CW = 0 dmg. Inscription of Wisdom CW = complete fizzle.
4. **0-AP cards cost 1 AP to Charge.** Quicken, Foresight, Swap, Corroding Touch, and Sacrifice become "free quiz cards" — the quiz IS the AP cost.
5. **Chain multipliers stack with Charge multipliers.** Planning chains + Charging = exponential payoff.
6. **Unlock gating creates a progression curve.** Levels 0–3 (first ~5 runs) = basics. Levels 4–6 (runs 6–15) = the game's unique mechanics. Levels 7–10 (runs 15–30) = advanced archetypes. Levels 11–13 (runs 30–60) = chase unlocks.

### New Mechanic Summary by Type

#### New Attack Mechanics (14)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| A1 | Siphon Strike | 1 | 6 dmg + heal min(2, overkill capped 10) | 18 dmg + heal | 11 | Always heals at least 2 |
| A2 | Rupture | 1 | 5 dmg + 3 Bleed | 15 dmg + 8 Bleed | 4 | Primary Bleed applicator |
| A3 | Hemorrhage | 2 | 4 + (4 per Bleed stack), consume all | 4 + (6 per Bleed), consume all | 7 | Bleed finisher |
| A4 | Kindle | 1 | 4 dmg + 4 Burn (triggers immediately) | 8 dmg + 8 Burn | 5 | Burst + lingering |
| A5 | Gambit | 1 | 10 dmg, lose 2 HP | 30 dmg, heal 5 HP | 6 | FLAGSHIP. HP swing by knowledge |
| A6 | Chain Lightning | 2 | 8 dmg | 8 × chain length | 8 | THE chain payoff card |
| A7 | Smite | 2 | 10 dmg | 10 + (3 × avg hand mastery) | 9 | Rewards broad mastery |
| A8 | Overcharge | 1 | 6 dmg | 6 + (2 per Charge this encounter) | 5 | Scales over encounter |
| A9 | Volatile Slash | 1 | 10 dmg | 30 dmg, EXHAUST | 7 | One-shot burst |
| A10 | Riposte | 1 | 5 dmg + 4 block | 15 dmg + 12 block | 3 | Hybrid attack/shield |
| A11 | Feedback Loop | 1 | 5 dmg | 20 dmg | 10 | CW = complete fizzle (0 dmg) |
| A12 | Precision Strike | 1 | 8 dmg | 24 dmg | 4 | Passive: +50% longer timer |
| A13 | Eruption (X) | X | 8 dmg per AP | 12 dmg per AP | 12 | X = all remaining AP |
| A14 | Recall | 1 | 1 dmg per discard card | 2 per discard | 11 | Late-fight nuke |

#### New Shield Mechanics (8)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| S1 | Absorb | 1 | 5 block | 5 block + draw 1 | 4 | Defensive cantrip |
| S2 | Reactive Shield | 1 | 4 block + 2 Thorns (1t) | 12 block + 5 Thorns (2t) | 5 | Thorns-based |
| S3 | Bulwark | 3 | 18 block | 36 block, EXHAUST | 9 | Emergency mega-block |
| S4 | Knowledge Ward | 1 | 4 block per unique domain in hand | Same × 1.5 | 6 | Domain diversity reward |
| S5 | Burnout Shield | 1 | 8 block | 24 block, EXHAUST | 7 | Mirror of Volatile Slash |
| S6 | Conversion | 1 | Convert up to 10 block → damage | Convert up to 15 block | 10 | Lose converted block |
| S7 | Ironhide | 2 | 6 block + 1 Strength (this turn) | 6 block + 1 Strength (permanent) | 8 | Strength snowball |
| S8 | Aegis Pulse | 1 | 5 block | 5 block + chain allies +2 block | 6 | Chain synergy defense |

#### New Buff Mechanics (8, including 2 Inscriptions)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| B1 | Ignite | 1 | Next attack applies 4 Burn | Next attack applies 8 Burn | 5 | Burn setup buff |
| B2 | Warcry | 1 | +2 Strength (this turn) | +2 Strength (permanent) + free Charge | 6 | Absorbs Concentration's niche |
| B3 | Frenzy | 2 | Next 2 cards cost 0 AP (incl. surcharge) | Next 3 cards cost 0 AP | 10 | Surcharge waived on free plays |
| B4 | Battle Trance | 1 | Draw 3, can't play more cards | Draw 3, no restriction | 7 | STS adaptation |
| B5 | Mastery Surge | 1 | +1 mastery to 1 random hand card | +1 mastery to 2 cards | 11 | Wasted on cursed cards |
| B6 | War Drum | 1 | All hand cards +2 base effect this turn | All +4 base | 8 | Universal hand buff |
| B7/I1 | Inscription of Fury | 2 | All attacks +2 dmg rest of combat | All attacks +4 dmg | 0 | INSCRIPTION — persistent |
| B8/I2 | Inscription of Iron | 2 | Start each turn with 3 block rest of combat | Start with 6 block | 0 | INSCRIPTION — persistent |

#### New Debuff Mechanics (7)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| D1 | Lacerate | 1 | 4 dmg + 4 Bleed | 12 dmg + 8 Bleed | 4 | Primary Bleed + damage |
| D2 | Corrode | 1 | Remove 5 enemy block + 1t Weakness | Remove all block + 2t Weakness | 5 | Anti-tank |
| D3 | Curse of Doubt | 1 | Enemy takes +30% from Charges (2t) | +50% from Charges (3t) | 6 | FLAGSHIP. Quiz-specific debuff |
| D4 | Mark of Ignorance | 1 | Enemy takes +3 flat from Charges (2t) | +5 flat from Charges (3t) | 8 | Companion to Curse of Doubt |
| D5 | Entropy | 2 | Apply 3 Burn + 2 Poison (2t) | Apply 6 Burn + 4 Poison (3t) | 9 | Dual DoT |
| D6 | Stagger | 1 | Skip enemy's next action | Skip + 1t Vulnerable | 3 | Tempo card |
| D7 | Corroding Touch | 0 | Apply 2 Weakness (1t) | Apply 3 Weakness (2t) + 2 Vulnerable | 7 | 0-cost debuff |

#### New Utility Mechanics (9)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| U1 | Scavenge | 1 | Put 1 discard card on top of draw | Put 2 on top | 4 | STS Headbutt style |
| U2 | Sift | 1 | Look at top 3 draw, discard 1 | Look at top 5, discard 2 | 3 | Scry mechanic |
| U3 | Siphon Knowledge | 2 | Draw 2 + see quiz answers 3s | Draw 3 + see answers 5s | 9 | FLAGSHIP. Study in combat |
| U4 | Swap | 0 | Discard 1, draw 1 | Discard 1, draw 2 | 2 | 0-cost cycling |
| U5 | Tutor | 1 | Search deck, add any card to hand | +0 AP cost this turn | 11 | Always powerful |
| U6 | Recollect | 1 | Return 1 exhausted card to discard | Return 2 exhausted | 8 | Exhaust recovery |
| U7 | Synapse | 1 | Draw 2 | Draw 2 + wildcard chain link | 10 | Chain wildcard |
| U9 | Archive | 1 | Retain 1 hand card (doesn't discard) | Retain 2 cards | 5 | Combo setup |
| U10 | Reflex | 1 | Draw 2 | Draw 3 | 6 | Passive: +3 block when discarded from hand |

#### New Wild Mechanics (10)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| W1 | Chameleon | 1 | Copy last card at 1.0× | Copy at 1.3× + inherit chain type | 6 | Chain-aware copy |
| W2 | Phase Shift | 1 | Choose: 8 dmg OR 8 block | 12 dmg AND 12 block | 7 | Per-play modal |
| W3 | Knowledge Bomb | 2 | 4 dmg | 4 dmg per correct Charge this encounter | 13 | Scales with quiz performance |
| W4 | Dark Knowledge | 1 | 3 dmg per cursed fact | 5 dmg per cursed fact | 8 | Turns failures into a weapon |
| W5 | Catalyst | 1 | Double all Poison on enemy | Double Poison + double Burn | 10 | STS classic |
| W6 | Chain Anchor | 1 | Draw 1 | Set chain to 2 + draw 1 | 9 | Chain starter |
| W7 | Sacrifice | 0 | Lose 5 HP, draw 2, gain 1 AP | Lose 5 HP, draw 3, gain 2 AP | 8 | STS Offering |
| W8 | Mimic | 1 | Random discard card at 0.8× | Choose discard card at 1.0× | 11 | Discard pile toolbox |
| W9 | Unstable Flux | 1 | Random effect at 1.0× | CHOOSE effect at 1.5× | 6 | FLAGSHIP. Knowledge = control |
| W10 | Aftershock | 1 | Repeat last QP card at 0.5× | Repeat last Charged card at 0.7× | 10 | Mode-aware copy |

#### Inscription Mechanics (3 — New Keyword)

| # | Name | AP | QP Effect (rest of combat) | CC Effect | Unlock |
|---|------|----|----|-----|--------|
| I1 | Inscription of Fury | 2 | All attacks +2 dmg | All attacks +4 dmg | 0 |
| I2 | Inscription of Iron | 2 | Start each turn with 3 block | Start with 6 block | 0 |
| I3 | Inscription of Wisdom | 2 | Charged correct → draw 1 extra | CC draws 1 extra + heal 1 HP | 1 |

#### Filler Mechanics (8 — New Basics)

| # | Name | Type | AP | QP | CC | Unlock |
|---|------|------|----|----|----|--------|
| F1 | Power Strike | Attack | 1 | 10 dmg | 30 dmg | 0 |
| F2 | Twin Strike | Attack | 1 | 5×2 (10 total) | 15×2 (30 total) | 2 |
| F3 | Iron Wave | Attack | 1 | 5 dmg + 5 block | 15 dmg + 15 block | 0 |
| F4 | Reinforce | Shield | 1 | 8 block | 24 block | 0 |
| F5 | Shrug It Off | Shield | 1 | 6 block + draw 1 | 18 block + draw 1 | 2 |
| F6 | Bash | Attack | 2 | 10 dmg + 1t Vulnerable | 30 dmg + 2t Vulnerable | 1 |
| F7 | Guard | Shield | 2 | 14 block | 42 block | 1 |
| F8 | Sap | Debuff | 1 | 3 dmg + 1t Weakness | 9 dmg + 2t Weakness | 1 |

### Key Balance Principles (v2)

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

**Map room distribution (AR-116 — per-floor exact counts):**

`mapGenerator.ts` enforces exact room counts via a post-processing step after initial generation:

| Row | Type |
|-----|------|
| Row 0 | Combat (always) |
| Rows 1–5 | 1 Rest (random position) |
| Rows 1–5 | 2 Shops (spaced 2+ rows apart) |
| Rows 1–5 | 2 Mystery rooms (not on shop rows) |
| Remaining rows | Combat or Elite |
| Row 6 | Rest (pre-boss rest, always) |
| Row 7 | Boss (always) |

Node distribution by act (approximate, legacy reference — actual counts enforced above):
| Node Type | Act 1 | Act 2 | Act 3 |
|-----------|-------|-------|-------|
| Combat | 42% | 38% | 34% |
| Elite | 12% | 14% | 16% |
| Mystery | 16% | 16% | 16% |
| Rest | 12% | 12% | 14% |
| Shop | 8% | 10% | 10% |
| Treasure | 10% | 10% | 10% |

**Treasure rooms** present 3 relic choices (choose 1) from the player's character-unlocked relic pool, displayed on the RewardRoomScene (rock/cloth display). If no eligible relics remain, falls back to +25 gold and a card reward.

**Room backgrounds:** Each non-combat room type has its own background pool (5 variants each, randomly selected):
- Rest: `rooms/rest/rest-campfire-*.webp`
- Shop: `rooms/shop/shop-merchant-*.webp`
- Mystery: `rooms/mystery/mystery-arcane-*.webp`
- Treasure: `rooms/treasure/treasure-cache-*.webp`
- Descent: `rooms/descent/descent-*.webp`
- Defeat/Victory: `screens/defeat/` and `screens/victory/`

The retreat-or-delve screen uses the **descent** background pool (`/assets/backgrounds/rooms/descent/`).

### Room Transition Animations (Parallax 2.5D)

Room transitions use a real-time WebGL parallax shader that creates a 2.5D "walking through" effect from static room background images. Each room background has a companion **depth map** (grayscale image, bright=near, dark=far) generated offline by DepthAnythingV2.

**Assets per room:**
- `{orientation}.webp` — the room background image (landscape or portrait)
- `{orientation}_depth.webp` — the grayscale depth map (5-12 KB each)
- Location: `public/assets/backgrounds/rooms/{room_type}/`

**Three transition types:**

| Type | Direction | Used When | Visual Effect |
|------|-----------|-----------|---------------|
| `enter` | Forward into room | Entering any room | Fade from black, camera pulls back from close to rest position, vignette opens up |
| `exit-forward` | Forward through room | Leaving combat rooms (walking to far exit) | Camera pushes deep forward with zoom, vignette closes, fade to black |
| `exit-backward` | Backward out of room | Leaving non-combat rooms (shop, rest, mystery, treasure) | Camera pulls backward, slight zoom-out, vignette closes, fade to black |

**Walking bob:** All transitions include a 4-cycle vertical sine oscillation to simulate footsteps. Amplitude eases in/out with the animation.

**Technical implementation:**
- `ParallaxTransition.svelte` — Svelte component with inline WebGL canvas
- Fragment shader displaces UV coordinates based on depth map values and dolly/zoom uniforms
- Animation runs via `requestAnimationFrame`, duration 2 seconds
- Click-to-skip supported
- Zero runtime dependencies beyond WebGL (no Phaser required)

**Depth map generation:**
- Script: `scripts/generate_depth_maps.py`
- Uses DepthAnythingV2 (via `broken.externals.depthmap` from the `depthflow` package)
- Run: `python3 scripts/generate_depth_maps.py` (all rooms) or `--room shop` (single room)
- Output: grayscale WebP, resized to match source image dimensions

### Rest Site — Three Choices

At each Rest Site, player chooses exactly one:

| Choice | Effect | Quiz Count |
|--------|--------|------------|
| **Rest** | Heal 30% max HP | 0 |
| **Study** | Answer up to 3 quiz questions — each correct answer raises one specific card's mastery level (max 3 cards, no downgrades) | 3 |
| **Meditate** | Remove 1 card from your deck (deck thinning) | 0 |

**Study flow:** A standalone 3-question quiz is shown (`StudyQuizOverlay`). Questions are drawn from the run's current fact pool. For each correct answer, one specific card in the deck gains one mastery level (see Mastery Upgrade System). Maximum 3 cards upgraded; no downgrades are possible during Study. Perfect score = 3 mastery upgrades. Disabled if all cards are already at max mastery.

**Meditate flow:** A scrollable list of all deck cards is shown (`MeditateOverlay`). Player clicks a card to select it, then confirms via a red "Remove" button. A confirm dialog prevents accidental removal. Disabled if the deck has 5 or fewer cards.

This design makes Study on-brand with the knowledge/learning theme — mastery gains must be earned through correct answers, not handed out for free.

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

### Synergy Tooltips (AR-122)

Card rewards and shop cards display synergy indicators when they synergize with mechanics already in the player's deck. A small green "Synergy: [mechanic names]" badge appears below cards that combo with existing deck composition, helping new players discover build paths.

- **Card Reward screen:** Each altar card option shows a synergy badge if its mechanic matches deck mechanics in the synergy map.
- **Shop:** Buy-section cards show a synergy badge if they synergize with anything already in the deck.
- Badges are subtle (small green text, low-opacity background) and only appear for acquisition contexts — not on cards already in hand or deck.
- Synergy data is defined in `src/data/synergies.ts` (`MECHANIC_SYNERGIES` map).

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

**Bonus relic on card reward:** 50% chance per floor (once per floor max), a bonus relic from the unlocked pool appears alongside the card choices on the reward screen. Tracked via `bonusRelicOfferedThisFloor` flag on floor state, reset on floor advance.

### Mystery Rooms — Floor-Scaled Events

Mystery rooms are narrative encounters that add unpredictability without breaking progression balance. They are **side dishes, not the main course** — never outclassing combat rewards, shops, or rest sites.

**Event distribution per mystery node:**
| Outcome | Chance | Details |
|---------|--------|---------|
| Narrative event | 70% | Drawn from tiered pools based on current floor |
| Combat ambush | 20% | Floors 1-5: regular enemy. Floors 6-8: 50/50 regular/elite. Floors 9+: elite. NO post-combat card reward. |
| Card reward | 10% | Standard 3-card choice screen |

**Event tiers:**
| Tier | Unlocks At | Examples |
|------|-----------|----------|
| Tier 1 | Floor 1+ | Healing Fountain (15% HP), Scattered Coins (25g), Reading Nook (upgrade card), Whispering Shelf (free card) |
| Tier 2 | Floor 3+ | Strict Librarian (return card or take damage), Knowledge Tax (pay gold/HP), Ambush!, Gambler's Tome |
| Tier 3 | Floor 6+ | Burning Library (15 HP for upgrade+card), Mirror Scholar (elite combat), Merchant of Memories (trade max HP) |
| Tier 4 | Floor 9+ | Final Wager (50/50 gamble), The Recursion (meet past self), Eraser Storm (lose 2 cards, heal), Elite Ambush |

**Balance ceilings (hard limits):**
- No free relics from mystery events
- Max 1 card upgrade per event
- Heals capped at 20% max HP (rest site heals 30%)
- Currency gains capped at 25-40 gold
- Combat ambush events give NO post-combat reward

**Effect types:** heal, damage, currency, maxHpChange, upgradeRandomCard, removeRandomCard, combat, cardReward, healPercent, transformCard, freeCard, nothing, choice (multi-option)

27 unique events across 4 tiers. Event data in `src/services/floorManager.ts`. Effect resolution in `src/services/gameFlowController.ts`. UI in `src/ui/components/MysteryEventOverlay.svelte`.

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

**Bone Collector** — Common (AR-123 redesign)
HP: 30 | Damage: 10
Steals up to 5 block from the player when they miss a Charge. That stolen block heals the enemy.
*Block theft punishes unprotected guessing. Build shields before risking a quiz.*

**The Archivist** — Boss (Act 2)
HP: 80 | Damage: 12
Phase 1: Standard combat, medium damage.
**Quiz Phase at 50% HP:** 5 rapid questions. Correct = boss loses 10% HP + player gets buff. Wrong = boss gains +3 Strength.
Phase 2: Resume with accumulated buffs/debuffs.

### Act 3 Enemies (The Archive)

**Void Mite** — Common (AR-123 redesign v2)
HP: 40 | Damage: 6
Gains 8 block when the player answers wrong on a Charge. Only Charge facts you know — guessing makes it tankier.
*Rewards confident knowledge. Wrong answers make the fight harder without punishing correct ones.*

**The Grade Curve (knowledge_siphon)** — Common (AR-123 new)
HP: 45 | Damage: 8–10
Gains +2 base damage every time the player Charges correctly (stacks indefinitely).
*Kill fast or accept mounting risk. Tests when to Quick Play vs. Charge.*

**Mantle Dragon** — Elite
HP: 70 | Damage: 14
Negates all chain bonuses. Chains still form visually but give 1.0× multiplier.
*Forces non-chain strategies. Tests build versatility.*

**Core Harbinger** — Elite (AR-123 redesign)
HP: 65 | Damage: 12
Quick Play deals only 30% damage. Charge for full effect.
*Softer wall than full immunity. Quick Play chips are viable but inefficient — Charging is the clear correct play.*

### Intent Variation (AR-123)
Three Act 1–2 enemies gained a low-weight (1) 4th intent for rare surprise variation:
- **crystal_golem**: Occasionally uses `Crystal barrage` (multi_attack ×2, 6 dmg) instead of its standard single-hit/defend/charge pattern
- **cave_bat**: Occasionally uses `Wing cover` (defend 4) instead of always attacking
- **shadow_mimic**: Occasionally uses `Shadow copies` (multi_attack ×2, 4 dmg) in addition to its existing 3-hit flurry

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
- **Run chain selection:** Each run uses 3 of the 6 chain types (selected deterministically by run seed). Cards are assigned only these 3 types, yielding ~50% chain frequency vs. ~15% with 6 types.
- **Multipliers:** 1.0× (no chain), 1.3× (2-chain), 1.7× (3-chain), 2.2× (4-chain), 3.0× (5-chain)
- **Stacks with:** Charge multiplier (multiplicative), Surge (free Charge, enabling more chains per turn)
- **Visuals:** `chainType`-colored card edge tint (6-color palette, 3 active per run), in-hand pulse, connection line animation, chain display (bottom-left, format "Chain: X.x")

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

## 11. Cursed Card System (Replaces Old Echo Mechanic)

The Echo system has been **fully removed** and replaced by the Cursed Card system. Full specification is in §4.5 Status Effects section (§1C of the expansion spec). Summary:

**Why Echoes were removed:**
1. **Exploit:** Players could intentionally fail cards they didn't want, using wrong answers as free deck thinning.
2. **Anti-learning:** The cards a player most needed to practice were removed — wrong behavior for an educational game.

**How Cursed Cards work:**
- Wrong Charge on a mastery-0 card → the **fact** (not card slot) is added to `cursedFactIds: Set<string>` on RunState
- Any card drawn that gets assigned a cursed fact shows the Cursed visual (purple tint, cracked border, shimmer)
- Cursed QP: 0.7×. Cursed Charge Correct: 1.0× (cure reward). Cursed Charge Wrong: 0.5×
- Cure: correct Charge on a cursed-fact card → fact removed from `cursedFactIds`, double FSRS credit
- **Free First Charge is EXEMPT** — guessing wrong on an unknown fact does NOT curse it (fizzle is enough punishment)
- Auto-cure safety valve: if 60%+ of hand is cursed across 2 consecutive draws → oldest fact auto-cures at encounter end
- Card removal (Meditate/shop) does NOT remove the cursed fact — it follows the fact, not the slot

**Constants:** `CURSED_QP_MULTIPLIER = 0.7`, `CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0`, `CURSED_CHARGE_WRONG_MULTIPLIER = 0.5`, `CURSED_FSRS_CURE_BONUS = 6.0`, `CURSED_AUTO_CURE_THRESHOLD = 0.6`, `FREE_FIRST_CHARGE_EXEMPT_FROM_CURSE = true`

Research: Karpicke & Roediger (2008) — immediate re-testing after failure is one of the most effective spaced repetition micro-patterns. The Cursed system forces continued exposure to failed facts rather than removing them.

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
| Cursed Card system | Wrong Charge on mastery-0 facts weakens any card carrying that fact until correct Charge cures it |
| Free First Charge | First Charge of any fact is free, preventing uninformed commitment |

---

## 13. Meta-Progression

| System | Description |
|--------|-------------|
| Knowledge Library | All facts cataloged by domain + mastery; lore entries expand on mastery |
| Relic Archive | 77 relics total: 24 always available (starter pool), rest unlock via character level |
| Camp Upgrade System | 9 camp elements each with 5–6 upgrade tiers, purchased with Dust |
| Card Cosmetics | Milestone rewards; monetizable |
| Domain Unlocking | Master 25 facts → new domain |
| Streaks | Daily completion; 7d→card frame, 30d→mastery coins, 100d→exclusive cosmetic, 365d→legendary. 1 freeze/week. |
| Lore Discovery | At 10/25/50/100 mastered facts: narrative connecting learned facts |
| Bounty Quests | 1–2 bonus objectives per run |
| Ascension | 10 levels of permanent modifiers unlocked after first successful run |
| Character Level | XP-based account level (1–25) with relic unlocks, dust bonuses, titles, and cosmetics per level |

No overworld, no farming/crafting, no prestige, no stamina.

### 13c. Character Leveling System (AR-112)

**Service:** `src/services/characterLevel.ts` (pure logic, no framework imports)
**Store integration:** `awardRunXP()` in `src/ui/stores/playerData.ts` — called at run end, attaches result to `RunEndData.xpResult` for RunEndScreen display.

Players accumulate XP across all runs. XP feeds a permanent account level (1–25) that unlocks relics, dust, titles, and cosmetics. XP is awarded at the end of every non-practice run.

**XP Curve:** `XP_BASE=80`, `XP_MULTIPLIER=1.14` — level 1 costs 80 XP; each subsequent level costs ~14% more.

**Pacing:** Level 1 after first run (~30 XP minimum), Level 10 at ~24 runs, Level 25 at ~224 runs.

**XP Sources per run:**

| Source | XP |
|--------|----|
| Correct answer | +3 each |
| Speed bonus (top 25% of timer) | +1 each |
| Streak bonus (beyond 2nd consecutive correct) | +2 per answer in streak |
| Floor cleared | +8 each |
| Combat won | +5 each |
| Elite defeated | +15 each |
| Mini-boss defeated | +10 each |
| Boss defeated | +15 each |
| New fact encountered | +2 each |
| Retreat bonus | +10 flat |
| Full run completion | +25 flat |
| Ascension multiplier | ×(1 + ascension×0.1) applied to subtotal |
| Daily first-run bonus | +30% of post-ascension total |

**Practice runs earn no XP** (pool already mastered — `isPracticeRun` flag suppresses `awardRunXP` call).

**Enemy type tracking:** `RunState` tracks `elitesDefeated`, `miniBossesDefeated`, and `bossesDefeated` separately from `encountersWon`. These are populated in `onEncounterComplete()` by checking `actMap` node type and floor/encounter position. They are passed through `RunEndData` to `awardRunXP` for precise XP calculation.

**RunEndScreen XP display:** After a non-practice run, the `xpResult` object is attached to `RunEndData` and passed to `RunEndScreen.svelte` as the `xpResult` prop. The screen shows total XP earned, and if one or more levels were gained, displays a "Level Up! → Lv.N" banner with any relics unlocked and dust awarded.

**Level Rewards (selected highlights):**

| Level | Reward |
|-------|--------|
| 1 | Relic: chain_reactor |
| 2 | 200 dust |
| 5 | Relic: quicksilver_quill, Title: Novice |
| 10 | Relic: thorn_crown, Cosmetic: cardback-bronze |
| 15 | Relic: double_down, Title: Adept |
| 20 | Relics: scholars_gambit + prismatic_shard, Title: Master |
| 21 | Cosmetic: cardframe-gold |
| 23 | Title: Sage |
| 25 | Title: Grand Scholar, Cosmetic: legendary-frame |

18 relics are distributed across levels 1–24. Levels without relics award dust (200–1000).

**Relic unlock persistence:** When a player levels up, `processXPGain()` returns `relicsUnlocked: string[]` containing all relic IDs from `LEVEL_REWARDS` for each gained level. These are merged into `PlayerSave.unlockedRelicIds` (with dedup) by `awardRunXP()` in `playerData.ts`. This handles level-skip scenarios — if a player jumps from level 5 to level 8, they receive relics from levels 6, 7, and 8.

**Two unlock systems — cards vs relics:**

| System | How it works | Persistence |
|--------|-------------|-------------|
| **Cards** | Level-gated via `getUnlockedMechanics(characterLevel)` at pool-build time | No separate unlock list — purely derived from current level |
| **Relics** | Level-gated via `RelicDefinition.unlockLevel` for pool eligibility, PLUS `LEVEL_REWARDS` relic IDs added to `unlockedRelicIds` on level-up | Persisted in `PlayerSave.unlockedRelicIds` array |

Cards are stateless (derived from level). Relics are stateful (persisted in save). The relic collection screen shows `???` for relics not in `unlockedRelicIds`.

### 13c-ii. Card Mechanic Unlock Gating (AR-205 / AR-209)

**Service:** `src/services/characterLevel.ts` — `MECHANIC_UNLOCK_SCHEDULE`, `getUnlockedMechanics(level)`, `getMechanicUnlockLevel(id)`
**Filter applied in:** `src/services/runPoolBuilder.ts` (`applyMechanics`), `src/services/presetPoolBuilder.ts` (`applyMechanics`)

Card mechanics are gated by character level. 91 total mechanics unlock across levels 0–13. This creates a meaningful progression curve: new players learn the game's basic mechanics first; advanced archetypes unlock after sustained play.

**Unlock schedule (91 unique mechanic IDs, levels 0–13):**

| Level | Count at Level | Cumulative | Mechanic IDs |
|-------|---------------|------------|--------------|
| 0 | 36 | 36 | All 31 existing + power_strike, iron_wave, reinforce, inscription_fury, inscription_iron |
| 1 | 4 | 40 | bash, guard, sap, inscription_wisdom |
| 2 | 3 | 43 | twin_strike, shrug_it_off, swap |
| 3 | 3 | 46 | stagger, sift, riposte |
| 4 | 5 | 51 | rupture, lacerate, scavenge, absorb, precision_strike |
| 5 | 5 | 56 | kindle, ignite, corrode, overcharge, archive |
| 6 | 7 | 63 | gambit, curse_of_doubt, knowledge_ward, aegis_pulse, reflex, unstable_flux, chameleon |
| 7 | 5 | 68 | burnout_shield, battle_trance, volatile_slash, corroding_touch, phase_shift |
| 8 | 6 | 74 | ironhide, war_drum, chain_lightning, dark_knowledge, mark_of_ignorance, sacrifice |
| 9 | 5 | 79 | smite, entropy, bulwark, conversion, chain_anchor |
| 10 | 5 | 84 | feedback_loop, frenzy, aftershock, synapse, catalyst |
| 11 | 5 | 89 | recall, mastery_surge, tutor, mimic, siphon_strike |
| 12 | 1 | 90 | eruption |
| 13 | 2 | 92 | knowledge_bomb, siphon_knowledge |
| 14–25 | 0 | 92 | No new mechanics above level 13 |

**Note on total 92 vs 91:** Inscription of Fury/Iron appear in both Buff and Inscription categories in this table — 91 unique mechanic IDs total.

**Backward compatibility:** All 31 existing mechanics have `unlockLevel: 0` in `MechanicDefinition`. The filter is a no-op for existing content at any level.

**Filter contract:** Unlock filtering is applied once per run at pool build time in `buildRunPool()` / `buildPresetRunPool()`. Cards in the run pool always have level-appropriate mechanics. Reward and shop screens use the same run pool so no independent filter is required there.

**Empty-pool fallback:** If a card type has zero unlocked mechanics at the player's level (possible with misconfigured tables), `pickMechanic()` falls back to the full type pool rather than crashing.

**No UI in AR-205:** The "locked card" UI (greyed-out cards in selection screens) belongs to AR-209. AR-205 is pure data + filter logic.

### 13d. Camp Upgrade System (AR-111)

The **Camp** is the persistent home base shown between runs. Players spend **Dust** (the meta-progression currency) to upgrade camp elements, which visually evolve the camp and may provide passive bonuses.

**9 camp elements**, each with **5–6 upgrade tiers:**

| Element | Tiers | First Upgrade Cost | Notes |
|---------|-------|--------------------|-------|
| Tent | 6 | 60 dust | Sleeping quarters; upgrades improve aesthetics |
| Campfire | 5 | 60 dust | Central visual; higher tiers add warmth effects |
| Character | 6 | 80 dust | Player avatar; visual progression |
| Pet | 5 | 150 dust | Companion; pets unlocked separately (cat free, owl 180, fox 260, dragon_whelp 520) |
| Library | 5 | 80 dust | Knowledge storage; cosmetic |
| Questboard | 6 | 40 dust | Bounty board; cosmetic |
| Shop | 6 | 60 dust | Merchant stall; cosmetic |
| Journal | 6 | 40 dust | Field notes; cosmetic |
| Doorway | 6 | 100 dust | Camp entrance; cosmetic |

**Upgrade costs:** Each element has a per-tier cost schedule defined in `campState.ts`. Dust is the sole upgrade currency. No real-money purchases for camp upgrades.

**Sprite system:** Camp is rendered using a PSD-based full-canvas overlay stacking approach. Each upgrade tier corresponds to a separate overlay sprite. The runtime composites all active tier overlays at startup and on upgrade.

**Camp Shop:** Two-tab interface accessible from the hub:
- **Camp Upgrades tab:** Shows all 9 elements with current tier, next upgrade cost, and preview art.
- **Relics tab:** Shows all 77 relics with unlock status. Level-gated with no per-relic cost (Mastery Coin model removed as of AR-112).

**Dust currency:** Awarded from run results (via `currencyEarned`), level-up rewards, and Mastery Trial completions.

### 13e. Relic Unlock Model (Updated)

As of AR-112 (extended by expansion), the relic unlock model is **character level gating**:

- **24 starter relics** are always available in every run's drop pool from account creation.
- Remaining relics unlock progressively as the player gains character levels.
- No Mastery Coins are required to unlock relics. Mastery Coins section is legacy documentation.
- The Camp Shop Relics tab displays all 77 relics with their unlock status and the level required.

### 13e-ii. Relic Unlock Schedule (Character Level)

| Level | New Relics Unlocked | Total Available |
|-------|-------------------|-----------------|
| 0 | 24 existing starters + Quick Study, Thick Skin, Tattered Notebook, Battle Scars, Brass Knuckles | 29 |
| 1 | Chain Reactor (existing), Pocket Watch, Chain Link Charm | 32 |
| 2 | Worn Shield, Bleedstone, Gladiator's Mark | 35 |
| 3 | Ember Core, Gambler's Token | 37 |
| 4 | Thoughtform, Scar Tissue, Living Grimoire | 40 |
| 5 | Quicksilver Quill (existing), Surge Capacitor, Obsidian Dice | 43 |
| 6 | Time Warp (existing), Red Fang, Chronometer | 46 |
| 7 | Soul Jar, Null Shard, Hemorrhage Lens | 49 |
| 8 | Crit Lens (existing), Archive Codex, Chain Forge | 52 |
| 9 | Berserker's Oath, Deja Vu, Entropy Engine | 55 |
| 10 | Thorn Crown (existing), Inferno Crown, Mind Palace | 58 |
| 11 | Bastion's Will (existing), Bloodstone Pendant, Chromatic Chain | 61 |
| 12 | Volatile Manuscript, Dragon's Heart | 63 |
| 13 | Festering Wound (existing), Capacitor (existing) | 65 |
| 14 | Double Down (existing) | 66 |
| 15 | Scholar's Crown (existing) | 67 |
| 16 | Domain Mastery Sigil (existing) | 68 |
| 18 | Phoenix Feather (existing) | 69 |
| 20 | Scholar's Gambit (existing), Prismatic Shard (existing), Omniscience | 72 |
| 21 | Paradox Engine | 73 |
| 22 | Mirror of Knowledge (existing), Akashic Record | 75 |
| 23 | Singularity | 76 |
| 24 | Toxic Bloom (existing) | 77 |

**Note:** Echo Chamber has been removed from the game entirely. Final count: 77 relics (41 existing relics minus Echo Chamber + 36 new expansion relics).

### Mastery Coins (Legacy — No Longer Used for Relic Unlocks)

- Earned by mastering facts (reaching Tier 3 via Mastery Trial)
- Previously spent to unlock relics in the Relic Archive hub screen
- As of AR-112, relics are level-gated, not Mastery Coin gated
- Mastery Coins may be repurposed in a future cosmetics or consumables system

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

### In-Run Tutorial Tooltips (AR-124)

Lightweight contextual hints that fire once per device (localStorage-gated). These are NOT blocking dialogs — they are passive floating tooltips that auto-dismiss.

#### Feature 1: First-Turn AP Tooltip
- **Trigger:** First-ever card play (Quick Play or Charge). Checks `localStorage.getItem('tutorial:apShown')`.
- **Content:** "You have 3 AP per turn. Each card costs AP to play."
- **Display:** Floating tooltip near the AP counter, 4-second auto-dismiss.
- **Location:** `CardCombatOverlay.svelte` — `maybeShowApTutorial()`.

#### Feature 2: Charge Cost Tooltip
- **Trigger:** First non-free Charge play (surcharge > 0). Checks `localStorage.getItem('tutorial:chargeShown')`.
- **Content:** "Charging costs +1 extra AP for the quiz power boost."
- **Display:** Floating tooltip above the card hand, 5-second auto-dismiss.
- **Not shown** on Surge turns or Chain Momentum turns where Charge is free.
- **Location:** `CardCombatOverlay.svelte` — `maybeShowChargeTutorial()`.

#### Feature 3: Quick Play vs Charge Comparison Banner
- **Trigger:** Player has performed BOTH a Quick Play AND a Charge in the same run. Checks `localStorage.getItem('tutorial:comparisonShown')`.
- **Content:** "Quick Play = safe at 1.0x. Charge = quiz for up to 3x power!"
- **Display:** Horizontal banner at top of combat area, 5-second auto-dismiss.
- **Location:** `CardCombatOverlay.svelte` — `maybeShowComparisonBanner()`.

#### Feature 4: Deck Cycle-Speed Indicator
Shows current vs projected deck cycle time in the card reward and meditate UIs. Not a tooltip — a persistent muted info line.

- **Formula:** `cycleSpeed = deckSize / 5` (5 cards drawn per turn, rounded to 1 decimal).
- **Reward screen:** "Deck: X cards (cycle: Y.Y turns) → X+1 cards (Y.Y turns)" — shown below the altar options.
- **Meditate screen:** "Deck: X cards (cycle: Y.Y turns) → X-1 cards (Y.Y turns)" — shown below the action buttons.
- **Style:** Small muted grey text (`#6E7681`), 11px, non-interactive.
- **Location:** `CardRewardScreen.svelte` and `MeditateOverlay.svelte`.

#### Tooltip Styling
All tutorial tooltips use:
- `background: rgba(0, 0, 0, 0.85)`, `color: #f0e6d2`, `border-radius: 8px`, `font-size: 13px`
- `pointer-events: none` — purely informational, never blocks interaction
- `z-index: 9999` — always on top, but no overlay/backdrop

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
- If card is mastery 0: add the fact to `cursedFactIds` (Cursed Card system)
- If card is mastery 1+: downgrade mastery by 1 level (once per encounter)

**Wrong answer does NOT:**
- Destroy the card
- Deal self-damage (unless relic effect, e.g., Volatile Core, Scholar's Gambit)
- End the turn

**Combo system removal note:** The combo multiplier system (`COMBO_MULTIPLIERS`, `COMBO_HEAL_*`, `COMBO_DECAY_*`, `comboCount`) has been fully removed from the game. Chains are the only streak mechanic. The `ComboCounter.svelte` component has been replaced by `ChainCounter.svelte` (chain-only display).

---

## 15.5. Damage Pipeline (Appendix E — Authoritative)

The exact order of damage calculation for all attack cards. **The combo multiplier is NOT in this pipeline** — the combo system has been fully removed.

1. `mechanicBaseValue` (from QP/CC/CW lookup)
2. + mastery bonus (`perLevelDelta × masteryLevel`)
3. + Inscription of Fury flat bonus (if active — applied here as flat addition, attack cards only)
4. + relic flat bonuses (`barbed_edge`, etc.)
5. × `card.effectMultiplier` (tier-derived: 1.0× QP, 1.5–3.5× CC, 0.6–0.7× CW)
6. × `chainMultiplier` (1.0–3.0, based on chain length)
7. × `speedBonus` (from quiz timer — only applies on CC)
8. × `buffMultiplier` (from Empower/buff cards active this turn)
9. × relic percent bonuses (Volatile Core, Reckless Resolve, Berserker's Oath, etc.)
10. × `overclockMultiplier` (if Overclock active)
11. + Burn bonus (= current Burn stacks, then halve stacks round down — triggered ONCE per hit)
12. + Bleed bonus (= Bleed stacks per card-play hit; does NOT decay on hit — only at end of enemy turn)
13. + relic flat attack bonus applied post-multiply (Bloodstone Pendant Fury stacks, etc.)
14. If enemy has Vulnerable: × 1.5
15. Block absorbs final total
16. Remaining damage after block hits HP

**Notes:**
- Burn and Bleed bonuses (steps 11–12) are added BEFORE block is applied. Block absorbs the combined total, not separately.
- Chain Anchor sets next chain's starting length to 2; Chain Anchor itself is not a chain link and does not contribute to step 6.
- AP gain from Sacrifice/Blood Price can push past `MAX_AP_PER_TURN` — there is no hard AP cap.
- Multi-hit cards trigger Burn once per hit. Bleed triggers once per card-play hit.

---

## 16. Relic System (AR-59.10 — 5-Slot System, updated AR-92)

### Core Rules

- **5 active relic slots** per run. Expandable to 6 via Scholar's Gambit (rare, cursed).
- **77 total relics** (41 original + 36 new expansion relics). ~60% build-around, ~40% stat-stick. Echo Chamber relic removed; not counted.
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
3. Player clicks a relic → in-Phaser detail panel slides in (icon, name, rarity label in rarity color, description, Accept/Leave buttons)
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

### Anytime Relic Selling from Tray (AR-92 / AR-116 update)

Players can sell equipped relics from the relic tray tooltip, **but only outside of combat** (shop or hub):

- **During combat:** Tapping a relic slot shows an info-only tooltip (name + description). No sell button.
- **In shop/hub:** Tapping a relic slot shows the tooltip with a **"Sell (Xg)"** button.

Sell flow:
1. Tap relic slot → tooltip shows name, description, and "Sell (Xg)" button
2. Tapping sell → inline confirmation: "Sell for Xg? [Yes] [No]"
3. Confirming → `sellEquippedRelic(id)` → relic removed, gold added, slot freed

Sell formula: `Math.floor(SHOP_RELIC_PRICE[rarity] * RELIC_SELL_REFUND_PCT)` where `RELIC_SELL_REFUND_PCT = 0.40`.

### Reroll

At boss/mini-boss relic selection events, player may pay `RELIC_REROLL_COST = 50g` to reroll all 3 choices. Maximum `RELIC_REROLL_MAX = 1` reroll per event.

### Archetype Selection (Disabled)
The archetype selection screen exists in code but is currently disabled. All runs use the "Balanced" archetype by default. The system biases card reward types toward a chosen playstyle (Aggressive, Defensive, Control, Hybrid, or Balanced). It was disabled because the mechanic adds decision complexity before the player understands the card system well enough for the choice to be meaningful. The component (`ArchetypeSelection.svelte`) and reward biasing logic are preserved for potential future re-enablement.

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
Knowledge Chains of 2+ deal 6 splash damage per chain link.
*Synergy: Tag Magnet + Swift Boots + any multi-hit cards*

**Resonance Crystal** — Uncommon
Each chain link beyond 2 draws +1 card at end of turn.
*Long chains refill your hand, enabling longer chains next turn. Snowball engine.*

**Tag Magnet** — Uncommon
When drawing cards, +30% chance to draw cards sharing a `chainType` with your last played card.
*Makes chains more consistent.*

#### Speed Relics (Build-Around)

**Quicksilver Quill** — Rare
Charged quizzes answered in under 2 seconds get an additional 1.5× multiplier.
*3.0× × 1.5× = 4.5× for fast correct answers.*

**Adrenaline Shard** — Uncommon
Correct Charged answers in under 3 seconds refund 1 AP (once per turn).
*Fast answerers effectively get 4 AP per turn.*

**Time Warp** — Rare
On Knowledge Surge turns, quiz timer is halved but Charge multiplier increases to 5.0× and gain +1 AP.
*High-risk, high-reward Surge turns.*

#### Glass Cannon Relics (Build-Around)

**Volatile Core** — Uncommon (Cursed)
All attacks deal +50% damage. Wrong Charged answers deal 3 damage to you AND the enemy.
*Even failures deal enemy damage. Pure aggression.*

**Reckless Resolve** — Uncommon
Below 40% HP: all attacks +50% damage. Above 80% HP: attacks −15% damage.
*Forces edge-of-death play.*

**Crit Lens** — Rare
Charged correct answers have 25% chance to DOUBLE the final damage (after all multipliers).
*The occasional CRITICAL hit.*

#### Defense Relics (Build-Around)

**Aegis Stone** — Uncommon
Block from shield cards carries between turns (max 15). At 15 block, gain Thorns 2.
*Completely changes shield card evaluation.*
Constant: `RELIC_AEGIS_STONE_MAX_CARRY = 15`

**Regeneration Orb** — Uncommon
Heal 3 HP at end of each turn where you played 2+ shield cards.

**Thorn Crown** — Rare
When you have 15+ block at start of turn, reflect 5 damage per enemy attack.

**Bastion's Will** — Rare
Charged shield cards gain +75% block. Quick Play shield cards gain +25% block.
*Makes Charging defensive cards worthwhile.*

#### Poison Relics (Build-Around)

**Plague Flask** — Uncommon
All poison ticks deal +2 extra damage. Poison lasts 1 extra turn.
*Hex goes from 9 total to 20 total damage.*

**Festering Wound** — Rare
When enemy has 3+ poison stacks, all attacks deal +40% damage.

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
Tier 1 Charged facts get +10% power. Tier 2+ get +40%. Tier 3 auto-Charged get +75%.

**Memory Nexus** — Uncommon
When you correctly Charge 3 cards in one encounter (cumulative), draw 2 extra next turn.

**Insight Prism** — Uncommon
Wrong Charged answers reveal correct answer AND next appearance of that fact auto-succeeds.
*Turns failures into future guaranteed wins.*

**Domain Mastery Sigil** — Rare (ID: `domain_mastery_sigil`, fixed from old ID `domain_mastery`)
If deck has 4+ facts from same domain, all same-domain cards get +30% base damage (even Quick Play).

#### Economy Relics (Utility)

**Gold Magnet** — Common | +30% gold from all sources.

**Merchant's Favor** — Common | Shops offer 1 additional card and 1 additional relic choice.

**Lucky Coin** — Common | Start each encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1).

**Scavenger's Eye** — Common | See 4 card choices after combat instead of 3.

#### Stat Stick Relics (Always Useful)

**Whetstone** — Common | All attack cards +2 base damage.

**Iron Shield** — Common | Start each turn with 2 block.

**Vitality Ring** — Common | +20 max HP. Applied at run start (max HP increased immediately on pickup).

**Herbal Pouch** — Common | Heal 8 HP after each combat encounter.

**Swift Boots** — Common | Draw 6 cards per turn instead of 5.

**Combo Ring** — Common | First Charged correct answer each turn grants +1 damage to all attacks that turn.

**Steel Skin** — Common | Take 3 less damage from all sources (min 1).

**Last Breath** — Uncommon | Once per encounter: survive lethal at 1 HP, gain 8 block.

#### Special / Cursed Relics

**Blood Price** — Uncommon (Cursed)
+1 AP per turn. Lose 2 HP per turn.
*4 AP is transformative. HP drain creates urgency.*

**Phoenix Feather** — Rare
Once per run: on death, resurrect at 15% HP. All cards auto-Charge free for 1 turn.

**Scholar's Gambit** — Rare (Cursed)
5 relic slots → 6. Wrong Charged answers deal 3 damage to you.
*More relics, higher quiz penalty.*

**Prismatic Shard** — Legendary (1 per run max)
All chain multipliers +0.5×. 5-chains grant +1 AP.
*THE chain capstone. 5-chain = 3.5× + free AP.*

**Mirror of Knowledge** — Legendary
Once per encounter: after correct Charge, replay card at 1.5× (no quiz, no AP).

**Volatile Manuscript** — Rare (Cursed)
All Charge multipliers +0.5×. Every 3rd Charge applies 4 Burn to yourself. Self-Burn triggers when hit by enemy attacks.

> **Removed relics (historical note):** Echo Lens, Echo Chamber, Phantom Limb were removed when the Echo system was replaced by the Cursed Card system. Combo Ring was removed with the combo system.

### New Expansion Relics (36 Added)

#### New Common Relics (5)

| ID | Name | Trigger | Effect |
|----|------|---------|--------|
| `quick_study` | Quick Study | on_encounter_end | After combat, if 3+ Charges correct, see quiz answer for 1 random deck fact (3s) |
| `thick_skin` | Thick Skin | permanent | First debuff each encounter has duration −1 turn |
| `tattered_notebook` | Tattered Notebook | on_charge_correct | +5 gold on first correct Charge per encounter |
| `battle_scars` | Battle Scars | on_damage_taken | Next attack deals +3 damage after taking a hit (once/turn) |
| `brass_knuckles` | Brass Knuckles | on_attack | Every 3rd attack card played deals +6 bonus damage |

#### New Uncommon Relics (12)

| ID | Name | Trigger | Effect |
|----|------|---------|--------|
| `pocket_watch` | Pocket Watch | on_turn_start | +1 draw on turns 1 and 5 of each encounter |
| `chain_link_charm` | Chain Link Charm | on_chain_complete | +5 gold per chain link in completed chains |
| `worn_shield` | Worn Shield | on_block | Every 2nd shield card played gains +3 block |
| `bleedstone` | Bleedstone | permanent | Bleed stacks applied by you are +2 higher; Bleed decays 1 slower |
| `ember_core` | Ember Core | permanent | Burn applied by you starts +2 extra stacks. Enemy at 5+ Burn: attacks +20% |
| `gambler_s_token` | Gambler's Token | on_charge_wrong | Wrong Charge = +3 gold |
| `thoughtform` | Thoughtform | on_perfect_turn | +1 permanent Strength when ALL cards in a turn were Charged correctly |
| `scar_tissue` | Scar Tissue | permanent | Cursed cards deal 0.85× QP instead of 0.7×. Does NOT cure — softens penalty |
| `surge_capacitor` | Surge Capacitor | on_surge_start | Surge turns: +1 AP and draw 2 extra cards |
| `obsidian_dice` | Obsidian Dice | on_charge_correct | 60% chance: +50% Charge mult. 40% chance: −25% Charge mult |
| `living_grimoire` | Living Grimoire | on_encounter_end | If 3+ Charges correct in encounter, heal 3 HP |
| `gladiator_s_mark` | Gladiator's Mark | on_encounter_start | Start each encounter with +1 Strength for 3 turns |

#### New Rare Relics (15)

| ID | Name | Trigger | Effect |
|----|------|---------|--------|
| `red_fang` | Red Fang | on_encounter_start | First attack each encounter +30% damage |
| `chronometer` | Chronometer | permanent | All quiz timers +3s. All Charge multipliers −15% |
| `soul_jar` | Soul Jar | on_charge_correct | 1 charge per 5 correct Charges. CHARGE button shows "GUARANTEED" — click to auto-succeed |
| `null_shard` | Null Shard | permanent | All chain multipliers = 1.0× (chains disabled). All attack cards +25% base damage |
| `hemorrhage_lens` | Hemorrhage Lens | on_multi_hit | Multi-Hit attacks apply 1 Bleed per hit |
| `archive_codex` | Archive Codex | on_encounter_end | +1 damage per 10 total mastery levels across deck |
| `berserker_s_oath` | Berserker's Oath | on_run_start | −30 max HP. All attacks +40% damage |
| `chain_forge` | Chain Forge | on_chain_complete | Once per encounter: a card that would break a chain continues instead |
| `deja_vu` | Deja Vu | on_turn_start | Turn 1: add 1 random discard card to hand at −1 AP. Card gets a previously-correct fact |
| `inferno_crown` | Inferno Crown | permanent | Enemy has BOTH Burn and Poison: all damage +30% |
| `mind_palace` | Mind Palace | permanent | Track consecutive correct Charges. Forgiveness: 1 wrong per 10 freezes progress. At 10/20/30 streak: +3/+6/+10 all effects |
| `entropy_engine` | Entropy Engine | on_turn_end | If 3+ different card types played this turn: deal 5 dmg + gain 5 block |
| `bloodstone_pendant` | Bloodstone Pendant | on_damage_taken | Each hit received → +1 Fury stack. Each Fury = +1 damage to next attack (consumed) |
| `chromatic_chain` | Chromatic Chain | on_chain_complete | Once per encounter: completing 3+ chain makes next chain start at length 2 |
| `dragon_s_heart` | Dragon's Heart | on_elite_kill / on_boss_kill | Elite kill: +5 max HP + heal 30%. Boss kill: +15 max HP + full heal + random Legendary. Passive: +2 attack damage always |
| `volatile_manuscript` | Volatile Manuscript | permanent | All Charge multipliers +0.5×. Every 3rd Charge applies 4 Burn to yourself |

#### New Legendary Relics (4)

| ID | Name | Trigger | Effect |
|----|------|---------|--------|
| `omniscience` | Omniscience | on_charge_correct | 3 correct Charges in one turn → 4th Charge auto-succeeds |
| `paradox_engine` | Paradox Engine | on_charge_wrong | Wrong Charges resolve at 0.3× AND deal 5 piercing damage. +1 AP per turn |
| `akashic_record` | Akashic Record | on_charge_correct | Tier 2b+ facts: one wrong answer subtly highlighted. Tier 3 auto-Charge = 1.5× (up from 1.2×) |
| `singularity` | Singularity | on_chain_complete | Completing a 5-chain deals BONUS damage equal to total chain damage (doubles 5-chain output) |

### Relic Archive (Hub — Meta-Progression)

24 existing starter relics are available from account creation. New relics unlock progressively via character level — see the full Relic Unlock Schedule in §13e-ii below. No Mastery Coins are required to unlock any relic — the unlock model is purely level-gated.

### Relic Display

- Tray at bottom of combat screen shows all equipped relics (up to 5)
- Active relics pulse on trigger (e.g., Aegis Stone glows when block carries)
- Dormant relics (condition not met) shown at 50% opacity
- Tap a relic slot to open an in-game tooltip popup showing the relic name and description
  - Tooltip appears to the left of the tray with a golden arrow pointing toward the relic
  - Dark semi-transparent background (`rgba(24, 33, 46, 0.95)`) with gold border (`#C9A227`)
  - Relic name shown in pixel font (`var(--font-pixel)`); description in small body text
  - Only one tooltip visible at a time; clicking outside or another relic closes/switches it
  - Mobile-friendly: no hover required, works via click

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

### Click Targets

- Minimum click target: 44×44px (iOS HIG)
- Card click: entire card face (~80×120px)
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
| Cursed card | Purple tint, cracked border, `cursed-shimmer` CSS animation |
| Tier 3 auto-Charge | Gold shimmer, auto-resolves on play |

### Enemy Intent Display

Enemy intent icon and damage preview shown above enemy sprite at all times. Three types:
- **Attack:** Sword icon + damage value
- **Defend:** Shield icon + block value
- **Buff:** Star icon + effect description

### Health Management Design Rules

**Healing must be scarce and strategic — never automatic or generous.**

- **Post-encounter healing vials** appear on the reward screen as small health potions (2-6% of max HP). They do NOT always appear — probability-based, not guaranteed.
- **POST_ENCOUNTER_HEAL_PCT stays at 3%** — this is the tiny passive recovery (bandaging wounds). NOT a full heal.
- **Rest rooms are the primary healing source** — 30% HP heal, but costs a room choice (opportunity cost vs shop/mystery).
- **Shop food** — buyable healing at gold cost (rations, elixirs). Strategic resource decision.
- **If healing is too generous, HP management becomes trivial** and the game loses tension. The player should feel pressure to play well (shields, correct answers) to AVOID damage, not rely on healing it away.
- **STS reference:** STS Ironclad heals 6 HP after combat (7.5% of 80 HP). Other characters get 0. Rest sites heal 30%. This creates real attrition pressure.

### HP Bar

- Player HP: prominent bar bottom-left of combat HUD
- Clear color transitions: green (>60%) → yellow (30–60%) → red (<30%)
- Numerical HP value alongside bar
- Flash red on damage taken

### Landscape Layout (Desktop — AR-73) [IMPLEMENTED]

Option D split-stage layout for desktop/landscape viewports:

**Three-zone split:**
- **Right 30% — Enemy Panel:** Enemy sprite, HP bar, block bar, intent telegraph. Always visible including during quiz. Enemy centered at `(85%, 45%)` of viewport.
- **Left 70% — Center Stage:** Reserved for quiz panel (AR-76), VFX, and floating HUD elements (relics top-left, chain display bottom-left).
- **Bottom 26vh — Card Hand Strip:** Full-viewport-width horizontal card row. Cards in `flex-row`, no arc/rotation fan. Selected card rises vertically by 70px. Charge/Quick Play buttons appear above selected card.

**Player HP bar:** Vertical bar at left edge of enemy panel (`x=68%` of viewport), spanning top 20%–80% of viewport height.

**HUD element repositioning (landscape):**
- Relics: top-left of center stage (`2%, 5%`)
- AP orb: left of hand strip, above card hand at `bottom: 35vh` (was 45vh; 10% lower on mobile)
- Enemy name: top of right panel (`70%–100%`, `2%` from top)
- Intent bubble: below enemy name in right panel
- Pile indicators: left edge above card hand
- End Turn button: right side above hand strip, left of enemy panel
- Chain display: bottom-left of combat screen (chain-only; combo counter removed)

**Background:** Cover-scales to fill full viewport in both modes. Landscape variant loaded first (`_landscape` suffix) with portrait fallback.

**Toggle:** Ctrl+Shift+L (dev only) toggles layout mid-combat without crash. `repositionAll()` in CombatScene recalculates all object positions on layout change.

**Vignette (landscape):** Lighter side vignette (40% vs 52% portrait) on left side only — no right-side vignette to keep enemy panel clean.

**Combat UI layout adjustments (AR-113 / AR-116):**
- Card hand strip lowered to `bottom: 2vh` (was 10vh) for more enemy viewing space
- Draw/discard pile indicators repositioned alongside card tops at 200px offset from baseline
- Discard pile shows dashed 3px border when empty
- Charge button matches the selected card's width; no lightning icon; text "CHARGE +1 AP"
- Combo counter removed; chain display replaces it (bottom-left, format "Chain: X.x")
- AP orb positioned at `bottom: 35vh` (was 45vh; lowered 10% on mobile)
- Card AP cost font: thicker 2px stroke + stronger shadows for readability
- Enemy intent padding increased
- Camp/rest-site background stretches to full viewport edges (100vw + translateX centering)
- Reward room card rewards are clickable via `container.setSize()` fix
- `RewardCardDetail` uses V2 frame rendering (card name on banner, type badge, white text)

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

### Audio Event Catalog (AR-228)

The **complete, exhaustive audio event catalog** lives in `docs/roadmap/completed/AR-228-COMPLETE-AUDIO-EVENT-CATALOG.md`. It contains **234 discrete audio events** across 23 categories, each with creative sound design direction, priority level, and implementation status.

**This catalog is a LIVING DOCUMENT.** Whenever ANY new mechanic, screen, interaction, enemy, card type, relic, room, or UI element is added, the corresponding audio events MUST be added to AR-228. No exceptions.

### Current Audio Infrastructure

| Component | File | Purpose |
|-----------|------|---------|
| Audio Synthesis Engine | `src/services/audioService.ts` | Web Audio API synthesis — 180 programmatic sounds (2,683 lines) |
| Card Audio Manager | `src/services/cardAudioManager.ts` | High-level cue layer (141 cues mapped to synthesized sounds) |
| Biome Audio Manager | `src/game/managers/AudioManager.ts` | Ambient loops + hazard SFX for 25 biome types |
| Settings UI | `src/ui/components/SettingsPanel.svelte` | SFX + Music volume sliders with localStorage persistence |

### Implementation Status Summary

| Priority | Count | Description | Status |
|----------|-------|-------------|--------|
| P0 (Ship-blocking) | 31 | Core feel — combat, encounters, run lifecycle, UI basics | DONE (synthesis) |
| P1 (Core Feel) | 100 | Status effects, chains, enemies, transitions | DONE (synthesis), BGM pending |
| P2 (Polish) | 73 | UI interactions, NPC sounds, ambient details | Mostly wired |
| P3 (Nice-to-have) | 26 | Hover sounds, scroll feedback, environmental micro-detail | Partially wired |
| **Total** | **234** | **182 trigger calls across 32 files** | **SFX complete, BGM pending** |

### Background Music (BGM) — User-Created via AI Music Generation

13 BGM tracks are needed. These will be created by the developer using **ACE-Step 1.5** (open source, installed locally at `~/opt/ace-step`, runs on M4 Max MPS) or commercial tools (Suno, Udio, AIVA). ACE-Step benchmarks above Suno v5 (SongEval 8.09), generates full songs in 30-60s locally, and costs nothing. **Detailed generation prompts** for every track are in `docs/roadmap/future/BGM-MUSIC-GENERATION-PROMPTS.md` and AR-228 Section 23.

| Track | Screen | Priority | Duration |
|-------|--------|----------|----------|
| Hub theme | Camp/home screen | P1 | 60-90s loop |
| Combat (normal) | Standard encounters | P1 | 45-60s loop |
| Combat (boss) | Boss fights | P1 | 60-90s loop |
| Combat (elite) | Elite encounters | P2 | 45-60s loop |
| Shop theme | Merchant room | P2 | 30-45s loop |
| Rest site theme | Campfire rest | P2 | 60-90s loop |
| Map/exploration | Dungeon map | P2 | 45-60s loop |
| Mystery event | Strange encounters | P2 | 30-45s loop |
| Surge overlay | Knowledge Surge turns | P1 | 15-20s loop |
| Boss quiz phase | Critical quiz moments | P1 | 15-20s loop |
| Run victory | Dungeon complete | P0 | 15-20s one-shot |
| Run defeat | Game over | P1 | 12-15s one-shot |
| Tutorial/onboarding | First-time experience | P2 | 45-60s loop |

Place generated files in `public/assets/audio/bgm/` as `.ogg` or `.mp3` (128-192kbps).

### Sonniss GDC Archive — Foley Replacement Path

The Sonniss GDC 2026 Bundle (7.47GB, royalty-free, no attribution) provides professional foley samples to replace Web Audio synthesis for sounds that need organic texture. See AR-228 "Sonniss GDC Sound Archive — Integration Guide" for download instructions, directory structure, and the 8 priority replacement targets (enemy attacks, shield break, coins, footsteps, etc.).

### Key Sound Design Principles

| Principle | Description |
|-----------|-------------|
| Charge buildup | Card drag above 40px threshold — arcane energy gathering, rising hum |
| Correct answer | Triumphant power release — bright major-chord burst + resonant impact |
| Wrong answer | Soft deflation — muted "fwomp", NOT punishing, encourages retry |
| Chain progression | Ascending metallic clinks, each link a half-step higher in pitch |
| Surge announce | Bass thrum + rising golden energy — deep, resonant, exciting |
| Surge active | Continuous warm golden hum throughout Surge turn |
| Tier-up | Shimmering overtones + choir-like sustain — knowledge crystallized |
| Mastery Trial | Gong strike + rising tension — solemn, important |
| Boss Quiz Phase | Combat music pauses, replaced by tense clock-ticking phrase |
| Enemy enrage | Bestial roar — deep distorted growl rising to a scream |
| Room transitions | 4-6 footsteps on surface matching room type + environmental ambience |
| Player defeat | Heartbeat slowing to silence — somber, NOT a harsh game-over buzzer |

For the full 234-event catalog with detailed sound design direction per event, see AR-228.

---

## 20. Accessibility

- **Slow Reader mode (Settings):** +3s to all timers, amber timer bar
- **CHARGE button click mode:** Charge can be triggered by clicking CHARGE button (not hold-only); fling gesture is one input method, button is another
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

### Grade Badge

Displayed prominently on the Run End screen for `defeat` and `victory` results (hidden for `retreat`). A circular badge with a glowing border pops in 400ms after the screen loads, followed by a flavor text line.

| Grade | Condition | Color | Flavor |
|-------|-----------|-------|--------|
| S | Victory (defeated The Curator) | Gold `#FFD700` | "Knowledge is power!" |
| A+ | Floor ≥ 22 | Purple `#7C4DFF` | "Scholar material!" |
| A | Floor ≥ 19 | Cyan `#00BCD4` | "Scholar material!" |
| B+ | Floor ≥ 16 | Green `#4CAF50` | "Impressive run!" |
| B | Floor ≥ 13 | Light green `#8BC34A` | "Impressive run!" |
| C+ | Floor ≥ 10 | Yellow-green `#CDDC39` | "Getting there." |
| C | Floor ≥ 7 | Amber `#FFC107` | "Getting there." |
| D+ | Floor ≥ 5 | Orange `#FF9800` | "Room for improvement." |
| D | Floor ≥ 3 | Deep orange `#FF5722` | "Room for improvement." |
| F | Floor < 3 | Red `#FF1744` | "Back to the books..." |

The badge uses a spring-bounce entry animation and a continuous shimmer glow effect. Both are suppressed under `prefers-reduced-motion`.

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

- Minimum 8 distractors per fact (top-level pool); **2 shown at card mastery 0, 3 shown at mastery 1+**
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

All UI uses two CSS custom properties for responsive design across screen sizes:

- **`--layout-scale`**: Applied to all layout dimensions (padding, margin, gap, width, height, border-width). Set dynamically by `CardApp.svelte` based on viewport size. Pattern: `calc(Npx * var(--layout-scale, 1))`
- **`--text-scale`**: Applied to all font sizes. Pattern: `calc(Npx * var(--text-scale, 1))`

**ZERO hardcoded px values** are permitted for layout, sizing, spacing, or fonts. The game must scale seamlessly from 720p to 1440p+ without any element appearing too small or too large. Exceptions: `1px` borders, `0` values, percentages, unitless values (opacity, z-index, flex), and Phaser canvas coordinates.

### Boot Animation

An 8-second cinematic intro sequence plays on first launch only (controlled by the `recall-rogue-boot-anim-seen` localStorage flag). Skipped automatically when `skipOnboarding` or `devpreset` query params are present.

**Three-act structure:**
- **Part 1 (0–4.8s): Logo Reveal** — Logo deblurs from heavy blur → medium blur → sharp over 1.2s. Warm-gold glow burst at 1.0s with spark particles. "Recall Rogue" title text sweeps in from the left with a gold spark trail at 1.6s. "Bramblegate Games" studio tag fades in at 2.8s. Ambient firefly particles begin at 3.6s.
- **Part 2 (4.8–8.0s): Cave Fly-Through** — Logo fades out. Three cave rings fly toward the camera in staggered sequence, simulating rushing into a dungeon entrance. Campsite background blurs in at 7.0s, crossfading heavy blur → sharp.
- **Part 3 (8.0s+): Handoff** — `boot-anim-complete` event emitted. After 100 ms overlap (so Svelte hub renders behind), Phaser container is hidden and the hub appears seamlessly.

**Click to skip:** A single click during the animation sets `tweens.timeScale = 3` and accelerates all particle emitters, completing the sequence ~3× faster.

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
3. **Chains tied to named chain types (chainType 0-5)** — Obsidian, Crimson, Azure, Amber, Violet, Jade; each run selects 3 of the 6 deterministically (by seed), then assigns evenly across all cards via `chainTypes.ts`
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
| `struggling` | 40% declining | slow | random | Stress-tests Canary + Cursed Card accumulation |
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
| [Relics]                          |   ENEMY        |
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
- **No sidebar navigation:** The landscape left sidebar (AR-91 `HubNavBar`) has been permanently removed. Hub screens use their own navigation elements. Portrait retains its bottom tab bar.

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
| Charge correct multiplier | 1.5× flat + mastery bonus (mastery is now the primary power scaling) |
| Charge wrong multiplier | 0.6× (Tier 1), 0.7× (Tier 2a/2b) |
| Charge AP surcharge | +1 AP (0 during Surge, 0 for Tier 3, 0 for Free First Charge) |
| Tier 3 auto-Charge | 1.2× base, no quiz, no AP surcharge |
| Surge frequency | Every 4th turn, run-persistent counter (global turns 2, 6, 10, 14...) |
| Free First Charge wrong multiplier | 0.0× (card fizzles — no effect) |
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
| Rest site Study | 3 quiz questions; each correct answer raises one card's mastery level (max 3 upgrades, no downgrades) |
| Shop haggle | 1 question per purchase, 30% discount |
| FSRS Tier 2a threshold | stability ≥ 2d, consecutiveCorrect ≥ 2 |
| FSRS Tier 2b threshold | stability ≥ 5d, consecutiveCorrect ≥ 3 |
| FSRS Tier 3 threshold | stability ≥ 10d, consecutiveCorrect ≥ 4, passedMasteryTrial |
| Mastery Trial timer | 4 seconds |
| Mastery Trial options | 5 (close distractors) |
| Player start HP | 120 |
| Enemy pity timer (relics) | 4 consecutive Common drops → guaranteed Uncommon+ |

---

## Appendix: Agent Skills Catalog

> Complete list of Claude agent capabilities. For detailed descriptions, see `CLAUDE_CAPABILITIES.md` in project root.

### Always Active (auto-triggered)
| Skill | Purpose |
|-------|---------|
| `feature-pipeline` | 7-phase workflow for all non-trivial tasks |
| `work-tracking` | AR-based phase documents and task tracking |
| `game-design-sync` | Keeps this document in sync with code changes |

### Development & Quality
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `quick-verify` | `/quick-verify` | Typecheck + build + tests + visual check |
| `code-review` | `/code-review` | Staged change review for quality and security |
| `simplify` | `/simplify` | Review code for reuse, quality, efficiency |
| `visual-inspect` | `/visual-inspect` | Instant game state jump via Playwright |
| `playthrough` | `/playthrough` | Full visual playthrough with screenshots |

### Balance & Playtesting
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `headless-playtest` | `/headless-playtest` | 6,000 runs/5 sec statistical balance data |
| `llm-playtest` | `/llm-playtest` | LLM agents play strategically with reasoning |
| `advanced-balance` | `/advanced-balance` | Per-card metrics, tension scores, predictability |
| `balance-check` | `/balance-check` | Narrative report from headless sim JSON |
| `playtest-analyze` | `/playtest-analyze` | Log analysis for balance/UX/bugs |
| `playtest-triage` | `/playtest-triage` | Deduplicate, score, rank issues |
| `playtest-results` | `/playtest-results` | View latest reports and leaderboard |

### Content Pipeline
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `manual-fact-ingest-dedup` | `/manual-fact-ingest-dedup` | 10-domain fact pipeline with validation |
| `subcategorize` | `/subcategorize` | Assign subcategories to unclassified facts |
| `answer-checking` | `/answer-checking` | Live DB-first answer verification |

### Art & Audio
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `artstudio` | `/artstudio` | Sprite/enemy/card art generation pipeline |
| `audio-manager` | `/audio-manager` | Complete audio system — 180 sounds, 141 cues, 182 triggers, ACE-Step BGM generation |

### Performance & Debugging
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `phaser-perf` | `/phaser-perf` | Phaser optimization, Canvas vs WebGL, FPS |
| `mobile-debug` | `/mobile-debug` | Capacitor debugging, remote inspection |

### Deployment & Infrastructure
| Skill | Invoke | Purpose |
|-------|--------|---------|
| `android-deploy` | `/android-deploy` | Build and deploy debug APK |
| `site-manage` | `/site-manage` | Manage recallrogue.com website |
