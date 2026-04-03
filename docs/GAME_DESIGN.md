# Recall Rogue — Game Design (Single Source of Truth)

> **One-line summary:** Card roguelite where knowledge IS power — Quick Play cards for base effect, Charge them with quiz answers for massive multipliers, chain related facts for exponential damage. The more you know, the stronger you become.
>
> **Version:** v3 (curated deck redesign). This document reflects the v3 curated deck system described in `docs/RESEARCH/DECKBUILDER.md`. Where DECKBUILDER.md conflicts with this document, DECKBUILDER.md takes precedence. The v1 mining-era design doc and v2 cross-domain pool design have been superseded.

> **Key v3 changes from v2:** Single curated deck per run (no cross-domain mixing), dynamic fact assignment at charge time (not draw time), pool-based adaptive distractors (not LLM-generated), mastery-driven quiz difficulty (not FSRS tier), no Cursed Card system, no Free First Charge, no visible quiz timer.

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
| 2 | Curated Deck Selection with Chains | Select a focused knowledge deck; chain related facts for multipliers |
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
       - CORRECT ANSWER → card plays at getMasteryStats().qpValue × 1.75. 500ms celebration.
       - WRONG ANSWER → card plays at FIZZLE_EFFECT_RATIO (0.25×). 300ms muted resolve.
       - Card is never wasted — wrong answers still resolve at reduced effect.
       - Contributes to Knowledge Chain if same chainType (0-5) as previous Charge.
       - MASTERED cards (level 5): quiz uses the hardest variant with most confusable distractors, but rewards the highest multiplier.

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
| 3 Quick Strike plays | 3 AP | 3 + 3 + 3 = 9 | 3 dmg/AP |
| 1 Charged Strike (correct, mastery 0) | 2 AP | 5.25 | 2.6 dmg/AP |
| 1 Charged Strike (correct, mastery 3) | 2 AP | 10.5 | 5.25 dmg/AP |
| 1 Charged Strike (wrong, mastery 1+) | 2 AP | 1 | 0.5 dmg/AP |
| 1 Charged Strike (correct) + 1 Quick Strike | 3 AP | 5.25 + 3 = 8.25 | 2.75 dmg/AP |

**Quick Play is AP-efficient. Charge is power-efficient but expensive.** The +1 AP surcharge prevents "always Charge everything" — with 3 AP, you can Quick Play 3 cards OR Charge 1 + Quick 1. Meaningful tradeoff every turn.

### Charge Damage Pipeline (How Values Are Actually Computed)

The runtime computes card effect values through this pipeline:

1. **Base value** = `getMasteryStats(mechanicId, masteryLevel).qpValue` — explicit per-level value from stat table (e.g., Strike L0=3, L5=8)
   - Note: L0 qpValue may be LOWER than the mechanic's legacy `quickPlayValue`. Stat tables override.
2. **Play mode scaling:**
   - Quick Play: `qpValue × 1.0` (no multiplier)
   - Charge Correct: `qpValue × CHARGE_CORRECT_MULTIPLIER (1.75×)` — mastery already encoded in qpValue
   - Charge Wrong: `FIZZLE_EFFECT_RATIO (0.25×)` of base effect — always resolves, never zero
3. **Tier multiplier** = T1: 1.0×, T2a: 1.0×, T2b: 1.0× — tier multipliers REMOVED (all active tiers = 1.0×)
4. **Chain multiplier** = [1.0, 1.2, 1.5, 2.0, 2.5, 3.5] at chain lengths 0–5
5. **Buff/relic/overclock** multipliers stacked on top
6. **Vulnerable** (+50% if enemy is vulnerable)

**The 1.75× CC multiplier is the base.** The real power progression comes from:
- Mastery upgrades: Each correct Charge upgrades the card one mastery level, increasing qpValue in the stat table
- Chain stacking: A 5-chain gives 3.5× on top of everything
- Relic synergies: Many relics amplify Charge Correct specifically

**Example — Strike at different mastery levels (Charge Correct, no chain/relic):**

Strike uses explicit stat table: L0=3, L1=4, L2=5, L3=6, L4=7, L5=8.

| Mastery | qpValue | × 1.75 CC | Total |
|---------|---------|-----------|-------|
| 0 | 3 | × 1.75 | **5.25** |
| 2 | 5 | × 1.75 | **8.75** |
| 5 | 8 | × 1.75 | **14** |

With a 3-chain (2.0×) on top of mastery 5: 14 × 2.0 = **28 damage** from a single Strike.

> **Design intent (2026-04-03):** Mastery stat table system replaces perLevelDelta. Every mechanic
> has an explicit L0–L5 table. Cards start WEAKER (Strike L0 QP=3, was 4). Max-mastery ceiling
> compressed (Strike L5=8, was 10). CC multiplier = 1.75× (was 1.5×). All tier multipliers = 1.0×.
> Power tiers: Modest (1.5–2×), Solid (2–2.5×), Great (2.5–3×).

> **Implementation note:** The `chargeCorrectValue` field in `mechanics.ts` is **dead data** — the resolver does NOT read it. CC is always computed as `getMasteryStats().qpValue × CHARGE_CORRECT_MULTIPLIER (1.75)`. The field exists for historical reference only.

### Mastery Upgrade System (AR-113)

Cards have 5 in-run mastery levels (0–5). Mastery resets each run. It is the **primary power scaling axis** — the more correctly you answer a card's question, the more powerful the card becomes mid-run.

**Level colors:** L0 = base (no icon), L1 = green, L2 = blue, L3 = purple, L4 = orange, L5 = gold + glow aura.

| Rule | Detail |
|------|--------|
| Correct Charge answer | Card upgrades one mastery level (once per encounter) |
| Wrong Charge answer | Card downgrades one mastery level (once per encounter) |
| Quick Play | No mastery change |
| Per-encounter cap | Each card can only upgrade or downgrade once per encounter (flag resets on next encounter) |
| Level 5 (Mastered) | Quiz uses hardest variant + most confusable distractors. Rewards highest multiplier. |
| Rest Site Study | Correct answer → +1 mastery to a specific card (max 3 cards; no downgrades possible) |

**Stat display:** Card descriptions show base+bonus format: "Deal 4+3 damage" where the +3 bonus is rendered in green. Bonus scales with mastery level.

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

**Wrong answer mastery impact:** Wrong Charge on any card downgrades mastery by 1 level (once per encounter). No separate "cursed card" state — the mastery level itself is the punishment/reward axis.

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
- **Mastery 5 cards (Mastered, final boss only exception):** Always show charge zone indicator; auto-charge mechanic is removed from the general system.

**Desktop (mouse):** Same drag-upward mechanic with pointer events.

### Free First Charge — REMOVED

**Free First Charge has been removed.** With curated domain decks the player chose themselves, plus adaptive difficulty that starts with easier facts at mastery 0 and easy question variants, the "blind guess" problem is solved by design. All charges cost their normal AP surcharge. The first charge of a run is not special.

The problem this mechanic solved — "don't punish blind guessing on unknown facts" — is now addressed by: (1) the player choosing a deck they know something about, (2) mastery 0 selecting the easiest facts and variants, and (3) 2 distractors at mastery 0 making questions easier.

### Action Points (Turn Economy)

**3 AP per turn. Hard cap 5 AP (via relics/passives). Cards cost 0–3 AP. Skip is free.**

AP badge colors:
- Green: 0 AP (free)
- Blue: 1 AP (standard)
- Orange: 2 AP (heavy)
- Red: 3 AP (full turn)

### Dynamic Fact Assignment (Replaces Per-Draw FSRS Shuffling)

Cards drawn into hand have **no fact**. The fact is selected at the moment the player commits to charging — not at draw time.

**New flow:**
```
Draw hand → cards show mechanic + chain theme only → player charges a card →
system selects fact from chain theme's fact sub-pool → quiz with dynamically selected fact
```

This replaces the old per-draw FSRS shuffling (AR-93) where facts were assigned to cards at draw time. The new system means:
- Card faces show only mechanic, AP cost, chain theme color+icon+name, and mastery level (0-5)
- No question text, no difficulty stars, no fact ID on the card face
- Players see their strategic options (which chains can form, which mechanics to play) without seeing quiz content in advance
- Commit-before-reveal is preserved: the quiz question only appears when the charge is committed

**Chain theme assignment:** Chain themes (knowledge decks) or generic chain types (vocabulary decks) are assigned to card SLOTS permanently at run start. Each run selects 3 of the deck's chain themes deterministically using the run seed. All cards in the run are assigned one of these 3 themes. This concentrates chain opportunities so that 2–3 matching cards appear per 5-card hand on average.

**Fact selection algorithm:** When a card is charged, `selectFactForCharge()` picks a fact from the intersection of the card's chain theme sub-pool (knowledge decks) or full deck pool (vocabulary decks) and the cooldown-filtered available facts, weighted by in-run FSRS state:
- Never seen this run → moderate priority (weight 1.5×)
- More wrong than correct → high priority (weight 3.0×)
- 2+ correct, no wrong → low priority / hot-streak suppression (weight 0.2×)
- Seen once, correct → moderate-low (weight 0.7×)
- At high mastery (3+): struggling facts boosted further

**In-Run FSRS (lightweight session tracker):** A per-run state tracks `correctCount`, `wrongCount`, `lastSeenEncounter`, `confusedWith[]`, `averageResponseTimeMs`, and `streak` for each fact seen in the run. Initialized from global FSRS (low-stability facts start with `wrongCount: 1`; high-stability facts start with `correctCount: 1`). Updated on every charge result.

**Chain type** is derived from the card's chain theme (for knowledge decks, this has thematic meaning, e.g., "Civil War Era") or from the generic 6-color palette (for vocabulary decks, no educational meaning — purely mechanical). Colors and icons are defined in `src/data/chainTypes.ts` and extended per deck.

### Encounter Cooldown & Anti-Repetition

All facts seen during an encounter enter a 3–5 encounter cooldown. Three deduplication layers:

1. **Same-hand dedup:** No two cards in the same 5-card hand share the same underlying fact (exact ID, base key, and root ID dedup).
2. **Encounter cooldown:** All facts that appeared in any hand during an encounter enter cooldown (3–5 encounters, random per fact). Root-sibling variants also blocked.
3. **Cross-run dedup:** Facts from the last 2 runs are deprioritized when building the next run's pool.

### The Commit-Before-Reveal Rule (CRITICAL)

The quiz question is hidden until the card is committed to Charge. Once committed, there is no cancel — must answer or auto-fizzle when timer expires.

Research: Roediger & Karpicke (2006) — retrieval practice = 87% retention vs 44% for restudying. Kornell et al. (2009) — even failed retrieval beats passive viewing.

**Stage 1 — In hand:** Cards fan in arc. Shows mechanic name, effect value, AP cost badge, chain theme color+icon+name, mastery level badge. No quiz content visible.

**Stage 2 — Selected (click to rise):** Card rises 80px with info overlay. Can freely deselect. Strategic decision point — Charge or Quick Play?

**Stage 3 — Committed (click CHARGE / fling up):** Quiz panel appears. Timer starts. No cancel.

### Dynamic Timer System (Invisible Internal Timer Only)

**There is NO visible quiz timer in the game UI.** No countdown bar, no ticking clock, no time pressure visual.

The floor-based timer table below describes an **invisible internal timer** only:

| Floor | Base Timer | Segment |
|-------|-----------|---------|
| 1–6 | 12s | The Shallows |
| 7–12 | 9s | The Depths |
| 13–18 | 7s | The Depths (late) |
| 19–24 | 5s | The Archive |
| 25+ | 4s | Endless |

**Purpose of the invisible timer:**
1. **Relic triggers:** Relics like Quicksilver Quill ("answered in under 2 seconds") and Adrenaline Shard ("under 3 seconds") check against it.
2. **Leaderboard scoring:** Daily Expedition and competitive runs use response time as a scoring component — faster correct answers score higher.
3. **Auto-fizzle:** Cards auto-fizzle if no answer is given before the timer expires (prevents AFK stalling). This timeout is generous and not communicated as time pressure.

**Question length modifier:** Add +1s per 12 words beyond 10 words in total text (question + all answer options). Applied to the invisible timer threshold.

**Slow Reader mode (Settings):** Flat +3s to all invisible timer thresholds. Does not show any visible timer UI.

Difficulty scaling is achieved through question variant selection and distractor quality (mastery-driven), NOT through visible time pressure.

### Card Anatomy & Frame System

Cards use a **PSD-based layered V2 frame system** (AR-107). Each card composites 3 layers extracted from a master PSD (`data/generated/camp-art/NEW_CARD.psd`, 886×1142px) with text overlaid via CSS at PSD guide positions.

**Cards no longer display facts, question text, or difficulty stars on the card face.** Cards are purely mechanical objects with chain theme identity. Cards in hand show:

- **Mechanic** (Strike, Block, Hex, etc.) — what the card does
- **AP cost** — how much it costs to play
- **Chain theme color + icon** — tells you the sub-topic pool (e.g., "Civil War Era" for knowledge decks, or generic Obsidian/Crimson/etc. for vocabulary decks)
- **Chain theme name** — small label identifying the sub-pool
- **Mastery level (0-5)** — per card slot, reflects quiz performance with this card slot this run
- **NO specific fact, NO question text, NO difficulty stars** — quiz content hidden until charge

This creates a strategic layer: "I have two Civil War Era cards and one Founding Fathers card. If I charge the Civil War Era cards consecutively, they'll chain. But I need to answer correctly on Civil War content."

**Frame layers:**

- **Border layer** (hue-shifted by card type): Indicates the card's mechanical category at a glance.
  - Attack: Red | Shield: Blue | Buff: Purple | Debuff: Green | Utility: Teal | Wild: Gold
- **Base frame layer** (constant): The shared structural frame — book icon area, pentagon art window, text area background. Identical across all cards.
- **Banner layer** (hue-shifted by chain type): The banner across the mechanic name area signals chain affinity.
  - Knowledge decks: deck-specific theme colors (e.g., Founding Fathers = #546E7A, Civil War Era = #EF5350)
  - Vocabulary decks: generic colors — ChainType 0: Obsidian (gray) | 1: Crimson | 2: Azure | 3: Amber | 4: Violet | 5: Jade
- **Pentagon art window:** Empty window ready for per-deck generated card art.
- **AP cost:** Yellow (`#fbbf24`) Cinzel bold with black outline, rendered as a CSS text overlay in the book icon area. Turns red when current cost exceeds base cost, green when below base cost.
- **Mechanic name:** Black text with white outline, Cinzel font, centered over the banner as a CSS overlay. Not baked into art.
- **Chain theme name:** Small label below mechanic name showing the chain theme (e.g., "Civil War Era" or "Obsidian").
- **Mastery level badge:** Level indicator (0–5) displayed on the card.
- **Effect text:** White sans-serif text over the dark lower text area. Clean readability on dark background.
- **Upgrade icon:** Green cross icon with float animation displayed on upgraded cards.
- **CHARGE button:** Displayed below the card in the popped state. Shows "+1 AP". Tap to initiate quiz. **Hover/press preview:** Hovering or touch-pressing the CHARGE button triggers a real-time charge value preview on the selected card — numeric values in the card's description update to show their charged equivalents in green (`#4ADE80`). Leaving the button reverts to normal display. Only active when the charge is affordable.
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

### Per-Language Display Settings

Language vocabulary decks support per-language display settings that customize how quiz content is rendered. Settings are scoped to a language (not per-deck) and apply to ALL sub-decks of that language.

**Current settings (Japanese):**
- **Furigana** (default: on) — show hiragana readings above kanji
- **Romaji** (default: off) — show romanized readings
- **Kana Only** (default: off) — replace all kanji with hiragana (beginner mode)

**Access points:**
- **Study Temple** — cogwheel (⚙) on each language group header in the vocabulary tree view
- **During runs** — cogwheel (⚙) on the quiz overlay when a language fact appears. Changes take effect immediately for the current and all subsequent quizzes in the run.

Settings are persisted in localStorage and shared across all contexts. Future languages may add their own display options (e.g., pinyin for Chinese, romanization for Korean).

### Chain Display (AR-116)

The combo system has been **fully removed** (see §15 Wrong Answer Design for removal note). Only the **Knowledge Chain** display remains.

The chain display sits at the **bottom-left** of the combat screen, colored by chain type, and shows the current chain length and multiplier in the format `"Chain: X.x"` (e.g. `"Chain: 1.7"`). It is only visible when chain length ≥ 2.

---

## 3. Knowledge Chain System (AR-59.3 / AR-93)

### How It Works

Cards have a `chainType` value that corresponds to one of the run's 3 active chain themes. When you Charge cards consecutively within the same turn that share a `chainType`, they form a chain. Each card in the chain gets a multiplier.

**Chain is built exclusively by Charge plays.** Quick Play breaks the chain. Wrong Charge answers also break the chain.

**Chain types are deck-specific (knowledge decks) or generic (vocabulary decks):**
- **Knowledge decks** (US Presidents, Periodic Table, etc.): Chain themes are named, thematic sub-groups within the deck (e.g., "Founding Fathers", "Civil War Era", "Progressive Era"). Each run selects 3 of the deck's themes deterministically from the run seed. Cards assigned to a theme will quiz from that theme's fact sub-pool when charged.
- **Vocabulary decks** (Japanese N5, Spanish A1, etc.): Chain types use the generic 6-color palette (Obsidian, Crimson, Azure, Amber, Violet, Jade). No educational meaning — purely mechanical. Facts are drawn from the full deck pool at charge time, not from a theme sub-pool.

Each run uses exactly 3 chain themes, selected from the deck's available themes. This concentrates chain opportunities so that 2-3 matching cards appear per 5-card hand on average. Cards without a `chainType` field contribute no chain.

**Example — US Presidents deck (knowledge deck):**
- "Civil War Era" cards (red border) — charge to get a Civil War Era president question
- "Founding Fathers" cards (steel blue border) — charge to get a Founding Fathers question
- Two consecutive "Civil War Era" charges → 2-chain at 1.3×

**Example — Japanese N5 deck (vocabulary deck):**
- "Obsidian" cards → generic color, draws from full N5 vocabulary pool when charged
- "Crimson" cards → generic color, same full pool
- Two consecutive "Obsidian" charges → 2-chain at 1.3×

**Minimum 3 chain themes per knowledge deck.** No upper limit. A Periodic Table deck might have 8+ themes (Alkali Metals, Noble Gases, Transition Metals, etc.). Decks with exactly 3 themes always use all of them; decks with more themes get different 3-theme combinations per seed — adding replayability.

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
| 3-chain Quick Play Strikes | 7 × 1.7 each (M1 QP) | 35.7 |
| 3-chain Charged (correct, mastery 1) middle card | 7, 10.5×1.7, 7×1.7 | 43.0 |
| 3-chain all Charged on Surge turn (free Charge surcharge, mastery 1) | 10.5 × 1.7 each | 53.6 |

The 54-damage Surge chain is the "holy shit" peak at early mastery. Rare. Players will chase it — and at M5, a 3-chain CC sits at ~78 damage (see pipeline example above).

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

**Chain theme identity:** The chain border color conveys both chaining compatibility AND (for knowledge decks) the educational sub-topic. For vocabulary decks, chain color is purely mechanical.

### Chain Examples

**US Presidents deck (knowledge deck — themed chains):**
- Card with "Civil War Era" theme (red banner) → charges into a Civil War era president quiz
- Another "Civil War Era" card → charges into another Civil War era president quiz
→ 2-chain on shared theme at 1.3×; if both correct, adds to chain for multiplier

**Japanese N5 deck (vocabulary deck — generic chains):**
- "Crimson" card → charges into any N5 vocabulary fact from the full pool
- Another "Crimson" card → charges into another N5 vocabulary fact from the full pool
→ 2-chain on matching generic chain color at 1.3×

### Facts Assigned Dynamically at Charge Time

Card mechanics pair with dynamically selected facts at charge time — not at draw. A Strike with "Civil War Era" theme will ask about a Civil War era president when charged. Which specific president? The in-run FSRS selects the best one for that moment — prioritizing facts the player has struggled with, suppressing ones they've recently got right.

This means:
- Every charge is a fresh selection from the theme sub-pool
- Players know the SUB-TOPIC (chain theme) but not the specific fact
- Strategic layer: "I have two Civil War Era cards — do I chain them or play them separately?"
- Educational breadth within a deck is preserved via the FSRS-weighted selection

---

## 3.5. Curated Deck System

### Deck Structure

Each curated deck is a self-contained educational unit designed for a specific knowledge domain or sub-domain. A run uses exactly one deck.

```typescript
interface CuratedDeck {
  id: string;                          // e.g., "us_presidents", "japanese_n5_vocab"
  name: string;                        // Display name
  domain: string;                      // Parent domain for knowledge tracking
  subDomain?: string;                  // Optional sub-domain
  description: string;                 // Player-facing description
  minimumFacts: number;                // Minimum facts required (default: 30)
  targetFacts: number;                 // Ideal fact count (default: 50)
  facts: DeckFact[];                   // The fact pool
  answerTypePools: AnswerTypePool[];   // Sub-pools grouped by answer format
  synonymGroups: SynonymGroup[];       // Groups of facts whose answers overlap (never distract each other)
  chainThemes: ChainTheme[];           // Deck-specific chain type definitions
  questionTemplates: QuestionTemplate[]; // Deck-specific question formats
}
```

### Answer Type Pools

Facts within a deck are grouped into **answer type pools** — sets of facts whose answers are the same format and can serve as distractors for each other.

**Minimum pool size: 5 facts.** With fewer than 5, the player will pattern-match distractors within 2–3 encounters.

**Example — US Presidents deck:**

| Pool ID | Answer Format | Example Answers | Count |
|---------|--------------|-----------------|-------|
| `president_names` | Name | Washington, Lincoln, Roosevelt, Obama... | 46 |
| `inauguration_years` | Year (bracket) | {1789}, {1861}, {1933}, {2009}... | 46 |
| `party_names` | Term | Federalist, Whig, Republican, Democrat... | ~8 |
| `home_states` | Place | Virginia, Illinois, New York, Hawaii... | ~30 |

**Example — Japanese N5 Vocabulary deck:**

| Pool ID | Answer Format | Example Answers | Count |
|---------|--------------|-----------------|-------|
| `english_meanings` | English word/phrase | to eat, to drink, delicious, big... | 822 |
| `japanese_words` | Japanese word | 食べる, 飲む, おいしい, 大きい... | 822 |
| `reading_hiragana` | Hiragana | たべる, のむ, おいしい... | 822 |

### Deck-Specific Chain Themes vs Generic (Vocabulary)

**Knowledge decks** define named chain themes that map to meaningful sub-groupings:

```typescript
interface ChainTheme {
  id: number;                    // 0-N (minimum 3 per deck, no upper limit)
  name: string;                  // e.g., "Founding Fathers", "Civil War Era"
  color: string;                 // Hex color
  icon: string;                  // SVG icon path
  factSubset: string[];          // Fact IDs belonging to this theme (minimum 8 per theme)
}
```

**Vocabulary decks** skip thematic chain types. The semantic groupings in vocabulary (actions, adjectives, nouns) don't create meaningful strategic chain decisions. Instead, vocabulary deck cards are assigned **generic chain types** (Obsidian, Crimson, Azure, Amber, Violet, Jade) distributed evenly by the seed. Facts are drawn from the **full deck pool** at charge time, not from a theme subset. Chains still work mechanically — matching generic colors still give multipliers — but the chain color carries no educational meaning.

**This distinction applies to ALL vocabulary decks across all languages.** Knowledge decks use thematic chains. Vocabulary decks use generic chains.

### Deck Selection at Run Start

1. **Domain selection** — Choose a top-level domain (e.g., "History", "Japanese", "Science")
2. **Deck selection** — Choose a specific deck within that domain (e.g., "US Presidents", "World War II", "Ancient Rome")
3. If a deck has sub-decks, optionally narrow further

The selected deck's full fact pool (minimum 30, target 50+) is loaded for the entire run. All quiz content comes from this single deck.

**Multiple deck composition (future consideration):** A "Mixed Deck" option could combine 2–3 curated decks. NOT for initial implementation.

### Pool-Based Adaptive Distractors

Distractors are drawn from the deck's own fact pool (same answer type pool as the correct answer), weighted by the player's **confusion matrix**:

1. **Synonym group exclusion (MANDATORY — checked first):** Any fact in the same `synonymGroupId` as the correct fact is EXCLUDED from candidates entirely. This prevents unfair questions where multiple answers are semantically correct.
2. **Known confusions first:** Facts the player has previously confused with the correct answer (from confusion matrix). These are the hardest, most educational distractors.
3. **In-run struggles:** Facts the player has gotten wrong this run (from in-run FSRS). Plausible because the player is actively uncertain.
4. **Same answer-type pool, similar difficulty:** Other facts from the same pool at ±1 difficulty.
5. **Same answer-type pool, any difficulty:** Remaining facts from the pool.

**Confusion matrix (persistent):** Tracks across runs which facts the player has confused with each other. "When asked about Madison, the player chose Monroe." This pair is stored permanently and prioritized as a distractor whenever Madison is the correct answer. The confusion matrix makes each player's questions uniquely challenging — adapting to their personal knowledge gaps.

### Synonym Group System (Mandatory for All Decks)

Synonym groups prevent unfair questions where multiple answer options are semantically correct.

**The problem:** If おいしい = "delicious" and another word = "tasty," showing "tasty" as a distractor for おいしい is unfair — both are correct.

**The solution:** `acceptableAlternatives` intersection at deck build time — entirely programmatic.

```typescript
// Run at deck build time to compute synonym groups
function buildSynonymGroups(facts: DeckFact[]): SynonymGroup[] {
  // For each pair of facts: if their correct answers + acceptableAlternatives share ANY overlap,
  // they are in the same synonym group and NEVER distract each other.
  // Safety default: any overlap → group them. Over-grouping is strictly safer than under-grouping.
}
```

Synonym detection works on the **English translation layer**, making it language-agnostic. Works identically for Japanese, Korean, Chinese, Spanish, French, German, Dutch, Czech.

### Chain Theme Pool Exhaustion

If a chain theme's available fact pool drops below 3 (due to cooldown), cooldown resets for that theme. This prevents stalling during long boss encounters. If a theme has fewer than 3 total facts (should not happen with minimum 8 per theme), all theme facts become available regardless of recent-use state.

### Dungeon Selection Screen (AR-244)

When the player clicks "Start Run" from the Hub, they enter the Dungeon Selection Screen — a unified run configuration interface with two distinct modes.

**Trivia Dungeon** — Casual exploration mode. Left sidebar shows domain checkboxes (multi-select). Content area displays subdomain checklists for each selected domain. Facts come from the general trivia database. Players can select entire domains or drill into specific subdomains (e.g., History > World War II only).

**Study Temple** — Focused learning mode. Left sidebar shows domains with curated decks (single-select). Content area displays deck tiles with FSRS progress bars showing mastery in each deck. Vocabulary domain is special: it shows a language tree (e.g., Japanese expanded into JLPT N5 → N1 levels + Kana, each expandable to sub-decks). Per-language settings are accessible via a ⚙ Settings button on language headers.

**Custom Playlists** — Players can add any deck or subdomain to named custom playlists via "Add to Custom ➕" buttons. Custom playlists persist as a toolbar at the bottom of the selection screen.

The screen remembers the last selected mode and configuration between sessions.

**Run Modes:**
- `trivia` — Facts from general trivia database, filtered by selected domains/subdomains
- `study` — Facts from a curated deck, adaptive difficulty via confusion matrix + in-run FSRS
- `all:languageCode` — Combines all curated decks for a language (e.g., all Japanese decks) into a single fact pool for that run

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

### Complete Status Effect Reference

| Effect | Type | Stacking | Per-Turn | Trigger | Decay | Notes |
|--------|------|----------|----------|---------|-------|-------|
| **Poison** | Debuff | Additive | Deals value as damage | Start of turn | −1 stack/turn after tick | Blocked by Immunity |
| **Burn** | Debuff | Additive | None (trigger-based) | On card-play hit | Halves after each trigger | Deals current stacks as bonus damage on hit; multi-hit cards trigger once per hit |
| **Bleed** | Debuff | Additive | None | Per card play | −1 stack/turn (end of enemy turn) | +1 flat damage per stack per card play (BLEED_BONUS_PER_STACK) |
| **Weakness** | Debuff | Additive | None | Passive | Decrements turns | −25% damage per stack (min multiplier 0.25×) |
| **Vulnerable** | Debuff | Boolean | None | Passive | Decrements turns | +50% incoming damage |
| **Strength** | Buff | Additive | None | Passive | Decrements turns | +25% damage per stack |
| **Regen** | Buff | Additive | Heals value | Start of turn | Decrements turns | — |
| **Immunity** | Buff | Boolean | None | On poison tick | Consumed on use | Absorbs next poison tick (immunity expires after blocking) |
| **Charge Dmg Amp %** | Debuff | Additive | None | On Charge | Decrements turns | +X% Charge damage (AR-207: Curse of Doubt) |
| **Charge Dmg Amp Flat** | Debuff | Additive | None | On Charge | Decrements turns | +X flat Charge damage (AR-207: Mark of Ignorance) |

### Debuff Details (applied to enemy or player)

**Weakness:** Reduces attack damage by 25% per stack (minimum multiplier 0.25×). Stacks additively. Duration decrements per turn.

**Vulnerable:** Increases incoming damage by 50%. Boolean effect (present or not). Duration decrements per turn.

**Poison:** Deals flat damage per turn equal to stacks. On each turn, poison damage is applied first, then all effects decrement. Blocked by Immunity (Immunity is consumed when it blocks one poison tick). Stacks additively — multiple poison applications add their values and take the maximum duration.

**Burn:** On-hit amplifier triggered when the target is hit by a card-play attack. Deals bonus damage equal to current Burn stacks, then stacks halve (floor). Expires when stacks reach 0. Does NOT trigger on Thorns/reflect damage or passive damage sources. Stacks additively. Multi-hit cards trigger Burn once per hit.

**Bleed:** Persistent amplifier. Each card-play attack against the target deals +1 bonus damage per stack (BLEED_BONUS_PER_STACK = 1 from balance.ts). Does NOT trigger on Poison ticks, Thorns, Burn, or passive damage. Decays by 1 at end of each enemy turn. Stacks additively.

**Charge Damage Amplifiers (AR-207):** Two variants introduced with the Curse of Doubt and Mark of Ignorance relics.
- **Charge Dmg Amp %:** Curse of Doubt. Percentage bonus to Charge damage (e.g., 30 = +30% multiplier). Stacks additively. Duration decrements per turn.
- **Charge Dmg Amp Flat:** Mark of Ignorance. Flat bonus to Charge damage (e.g., 3 = +3 damage). Stacks additively. Duration decrements per turn.

### Buff Details (applied to player)

**Strength:** +25% damage per stack. Applied via relics, enemy debuffs, or card mechanics. Stacks additively. Duration decrements per turn.

**Regen:** Heals the player by its value each turn (at the start of the turn, alongside other per-turn effects). Stacks additively. Duration decrements per turn.

**Immunity:** Blocks the next poison tick, then expires (consumes on use). Boolean effect. Can be applied for multiple turns but only blocks one poison instance.

### Player Turn Buffs (from card mechanics, last 1 turn)

| Buff | Source | Effect |
|------|--------|--------|
| AP bonus | Quicken | +1 AP this turn |
| AP discount | Focus | Next card costs 1 less AP |
| Double strike | Double Strike | Next attack hits twice |
| Cost reduction | Empower | Next card +50/75% effect |

**Focus visual feedback (CardHand):** When Focus is active (`focusReady && focusCharges > 0`), the AP gem on each card shows the reduced cost and turns green (`#4ADE80`). The `focusDiscount` prop (1 or 0) is passed from `CardCombatOverlay` to `CardHand`. The gem color returns to off-white (`#F0E6D2`) when no discount is active. The `hasEnoughAp()` check and charge button affordability both account for the Focus discount, so cards costing 1 AP that become free (0 AP) are correctly highlighted as playable.

### Enemy-Specific Interactions (v2)

- **The Peer Reviewer:** Gains +3 Strength every turn you don't Charge at least 1 card
- **The Algorithm:** Heals 8 HP when you answer correctly on a Charge (boss phase)
- **The Crib Sheet:** Copies card damage against you when you answer wrong on a Charged card
- **The Citation Needed:** Steals up to 5 block from the player when they miss a Charge. Enemy gains that stolen block as HP.
- **The Burnout:** Gains block when the player plays without Charging. Play with purpose — don't waste turns.
- **The Blank Spot:** Weaken effects (opponent reduction). Play Strength and Regen to overcome it. Vulnerable to direct damage.
- **The Spark Note:** Gains +2 base damage every time the player Charges correctly. Kill it fast or play defensively.

### Enemy Combat Traits (AR-99 Phase 3)

Enemies can have passive traits that modify how specific play styles interact with them. These traits appear alongside enemy descriptions in the combat UI.

#### chargeResistant
Quick Play attacks deal **50% damage** to this enemy. Charged attacks (correct or wrong) deal full damage. Rewards players who invest AP to Charge their cards.

Enemies with chargeResistant: thesis_construct, staple_bug, crambot, watchdog, dropout, rote_memory, hidden_gem, thesis_djinn, sacred_text, institution, fake_news

#### quickPlayDamageMultiplier (AR-123)
Quick Play attacks deal only **X% damage** (e.g., 30%) to this enemy instead of zero. A softer version of `quickPlayImmune` — players can still chip with Quick Play, but Charging is dramatically more efficient.

Enemies with quickPlayDamageMultiplier: singularity (0.3)

#### chainVulnerable
Chain attacks (Knowledge Chain multiplier > 1.0×) deal **+50% bonus damage** to this enemy. Rewards players who build and sustain chains by answering varied card types correctly.

Enemies with chainVulnerable: bookmark_vine, index_weaver, eraser_worm, thesis_dragon, writers_block, outdated_fact, rushing_student, ember_skeleton

#### quickPlayPunish (mini-boss trait, implemented via onPlayerNoCharge)
If the player makes no Charge plays during their turn, the enemy gains **+1 Strength** (permanent for the encounter). Applied to: crystal_guardian, stone_sentinel, iron_archon, obsidian_knight, glyph_warden.

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
| Inscription of Fury | Damage pipeline step 3 (after mastery, before relic flat bonuses) | +N flat attack damage | +N flat attack damage | 0.7× N flat attack damage (QP penalty for playing as Quick Play) |
| Inscription of Iron | Player turn start (before draw) | +N block per turn | +N block per turn | 0.7× N block per turn |
| Inscription of Wisdom | Charge Correct resolution | Draw 1 extra card | Draw 1 extra card + heal 1 HP | Complete fizzle — card exhausted, no inscription registered |

### Damage Pipeline Integration

Inscription of Fury applies at **step 3** of the damage pipeline:
```
effectiveBase = mechanicBaseValue + sharpenedEdgeBonus + inscriptionFuryBonus
```
Only applies to `attack`-type cards. Shield, buff, debuff, utility, and wild cards are unaffected.

### Cursed Inscription

An Inscription card played via Quick Play applies its effect at **0.7×** the base value (the "QP penalty" for not charging). Inscription of Wisdom played as Charge Wrong results in a complete fizzle — the card exhausts and is removed from game, but no inscription is registered.

---

## 4.7 Brain Fog (AR-261)

Per-encounter fog gauge (0–10) driven by Charge accuracy. Starts at 0 (clear) each encounter. Higher fog = worse for the player.

**Fog Changes:**

| Event | Delta |
|-------|-------|
| Wrong Charge | +2 (fog increases) |
| Correct Charge | −1 (fog decreases) |
| Quick Play | 0 |

**Fog States:**

| Range | State | Effect |
|-------|-------|--------|
| 0–2 | Flow State | Draw +1 card per turn |
| 3–6 | Neutral | No effect |
| 7–10 | Brain Fog | Enemies deal +20% damage |

Quick Play doesn't affect fog — QP is already punished through lower multipliers, no chains, no mastery progress. Fog purely tracks Charge accuracy.

Cards and relics can reference fog state (e.g., Smite scales inversely with fog level — clearer mind hits harder; Domain Mastery Sigil grants ±1 AP based on state; Feedback Loop gets bonus damage in Flow State).

**UI:** Fog is displayed as a wing extending below the left section of the top bar, with a quarter-circle bottom-right corner. Shows fog icon (✨ for Flow State, 🌫️ otherwise) and numeric level. Animated mist overlay intensifies with higher fog. Golden glow in Flow State.

**Implementation:** `src/services/knowledgeAuraSystem.ts` — pure module with `resetAura()`, `adjustAura()`, `getAuraState()`, `getAuraLevel()`.

---

## 4.8 Review Queue (AR-261)

Per-encounter list of fact IDs from wrong Charge answers. Resets each encounter.

When a Charge answer is wrong, the fact ID is added to the Review Queue. If a subsequent Charge correctly answers a Review Queue fact, it is cleared from the queue and triggers bonus effects on cards/relics that reference it (e.g., Recall deals bonus damage + heal on Review Queue facts, Scholar's Crown grants +40% damage).

The queue count is displayed as a 📝 pill badge in the top bar center section, next to the floor/segment info.

**Implementation:** `src/services/reviewQueueSystem.ts` — pure module with `resetReviewQueue()`, `addToReviewQueue()`, `clearReviewQueueFact()`, `isReviewQueueFact()`.

---

## 4.9 Accuracy Grade (AR-262)

Post-encounter accuracy grade based on Charge quiz performance. Pure upside — no penalties for low accuracy, only bonuses for excellence.

At the end of each combat encounter, the game calculates:
```
accuracy = chargesCorrectThisEncounter / encounterChargesTotal × 100%
```

| Accuracy | Grade | Effect |
|----------|-------|--------|
| 90%+ | **S** | +1 card option (4 total) AND guaranteed Tier 2a/2b card in options |
| 80–89% | **A** | +1 card option (4 total) |
| 60–79% | **B** | Standard rewards (3 card options) |
| Below 60% | **C** | Standard rewards (3 card options) |

**Edge cases:**
- 0 charges attempted (Quick Play-only encounter) → grade C, standard rewards
- Grade is stored in `activeRewardBundle.accuracyGrade` and read by `openCardReward()` in `gameFlowController.ts`

**Badge display:** Grade badge shown on the card reward screen's header for A and S grades. S grade has a gold shimmer animation. B/C grades show no badge (no negative feedback).

**Implementation files:**
- `src/services/accuracyGradeSystem.ts` — pure `calculateAccuracyGrade(attempted, correct)` module
- `src/services/turnManager.ts` — `chargesCorrectThisEncounter` counter (alongside `encounterChargesTotal`)
- `src/services/encounterBridge.ts` — computes grade at encounter victory, stores in `activeRewardBundle`
- `src/services/gameFlowController.ts` — `openCardReward()` reads grade and passes `typeCount`/`guaranteeUncommon` to reward generator
- `src/services/rewardGenerator.ts` — `generateCardRewardOptionsByType()` accepts `typeCount` and `guaranteeUncommon` params
- `src/ui/components/CardRewardScreen.svelte` — grade badge UI

---

## 5. Card Tiers and Mastery

### FSRS Tiers (Long-Term Knowledge Tracking — Decoupled from Combat Power)

FSRS tiers (1/2a/2b/3) still exist for global long-term knowledge tracking, but they are **decoupled from combat power**. Tiers no longer drive card multipliers or auto-charge behavior.

```typescript
function getCardTier(state: PlayerFactState): '1' | '2a' | '2b' | '3' {
  if (state.stability >= 10 && state.consecutiveCorrect >= 4 && state.passedMasteryTrial) return '3';
  if (state.stability >= 5  && state.consecutiveCorrect >= 3) return '2b';
  if (state.stability >= 2  && state.consecutiveCorrect >= 2) return '2a';
  return '1';
}
```

**What tiers still do:**
- Long-term knowledge tracking — every quiz result updates FSRS state
- Run pool seeding — low-stability facts are flagged as "needs practice" when initializing in-run state
- Knowledge visualization — powers the cross-run knowledge map showing mastery across domains
- Deck difficulty estimation — "you know 73% of US Presidents well"

**What tiers no longer do:**
- Do NOT drive card power multipliers for combat
- Do NOT trigger Mastery Trials
- Do NOT determine auto-charge eligibility
- Do NOT set question format (that is now card slot mastery + deck templates)

### Charge Scaling Table (Mastery-Driven)

Combat power is driven by **card slot mastery** (0–5, per run), not FSRS tier:

- **Quick Play:** `getMasteryStats(mechanicId, level).qpValue` (1.0× of level's qpValue)
- **Charge Correct:** `getMasteryStats().qpValue × CHARGE_CORRECT_MULTIPLIER (1.75×)`
- **Charge Wrong:** `FIZZLE_EFFECT_RATIO (0.25×)` of base effect — always resolves
- **Charge AP Cost:** +1 AP surcharge (waived during Surge, Chain Momentum, first charge)

Power comes from explicit per-level stat tables — not a delta formula. Cards start weaker at L0 and transform through mastery. Some mechanics gain new tags, AP reductions, or hit count increases at milestone levels (see `docs/mechanics/cards.md` — Wow Moment Milestones).

| Card Slot Mastery | Strike stat table qpValue | CC Value (×1.75) |
|-------------------|--------------------------|-----------------|
| 0 | 3 | 5.25 |
| 1 | 4 | 7 |
| 3 | 6 | 10.5 |
| 5 | 8 | 14 |

### Mastery-Driven Question Difficulty

Card mastery level (0-5) now controls quiz difficulty:

| Mastery Level | Distractor Count | Question Variant | Distractor Source Priority |
|---------------|-----------------|------------------|---------------------------|
| 0 | 2 | Easiest available for deck | Random from pool |
| 1 | 3 | Standard | Pool + some confusion-based |
| 2 | 3 | Standard + reverse variants | Confusion-weighted |
| 3 | 4 | Harder variants unlocked | Heavily confusion-weighted |
| 4 | 4 | Hardest available | Maximum confusion-weighting |
| 5 | 4 | Hardest + closest distractors | Known confusions + closest similarity |

**The reward loop:** Higher mastery = higher card power multiplier. But the questions get proportionally harder. Mastery 5 gives a massive multiplier IF you can answer the hardest variant with the most confusable distractors. Knowledge IS power, but only genuine knowledge.

**Fact difficulty scales with mastery:** At mastery 0, the system prefers easier facts from the chain theme pool. At mastery 4–5, it prefers facts the player struggles with most. This replaces the old "master a fact, get free hits" dynamic.

### Tier 3 Auto-Charge — REMOVED

**Tier 3 auto-charge is removed.** There is no fact-level mastery that eliminates quizzes. Every charge always presents a quiz. At card mastery 5, the quiz is the hardest variant — but the multiplier is also the highest.

### Mastery Trial — REMOVED

Mastery Trials as a fact-level graduation ceremony are removed (no Tier 3 auto-charge to graduate into).

**Possible future replacement:** A run-level "Mastery Challenge" at the final boss where the hardest facts from the run are presented in rapid succession — a climactic test, not a graduation.

### Pool Exhaustion Prevention

If cooldown would exhaust the fact pool (available facts < hand size), cooldown relaxes to 1 encounter. If still insufficient, cooldown is disabled for that draw.

### Question Templates (Deck-Specific)

Each curated deck defines its own question templates rather than using the old global tier-based variant system. Templates are specific to the deck's subject matter and answer type pools.

#### Template Selection at Charge Time

1. Filter templates to those available at the current card mastery level
2. Filter to templates whose answer pool contains the selected fact
3. Weight by: difficulty appropriate to mastery level, variety (don't repeat same template consecutively), in-run template history
4. Select weighted random (seeded)

#### Vocabulary Deck Templates (Standard Across All Languages)

| Template ID | Format | Answer Pool | Available From Mastery | Notes |
|-------------|--------|-------------|----------------------|-------|
| `forward` | "What does '{word}' mean?" | `english_meanings` | 0 | L2 recognition → L1 meaning |
| `reading` | "What is the reading of '{kanji}'?" | `reading_hiragana` | 1 | Japanese/Chinese only |
| `reverse` | "How do you say '{english}'?" | `target_language_words` | 2 | L1 meaning → L2 recall |
| `synonym_pick` | "Which word is closest in meaning to '{word}'?" | `english_meanings` | 3 | Semantic depth |
| `definition_match` | "[definition/explanation]" | `english_meanings` | 3 | No L2 word shown |

This is language-agnostic — the same template IDs and logic work for Japanese, Korean, Chinese, Spanish, French, German, Dutch, Czech.

#### Vocabulary Distractor Sources (Pool-Based)

All vocabulary distractors come from the run's deck pool:
- **Forward/Synonym/Definition:** Distractors are other English meanings from the `english_meanings` pool
- **Reverse:** Distractors are other target language words from the `target_language_words` pool
- **Reading:** Distractors are other readings from the `reading_hiragana` (or `reading_pinyin`) pool

The confusion matrix applies naturally: if you've confused 飲む ("to drink") with 食べる ("to eat") three times, 飲む is permanently the #1 distractor whenever 食べる is the answer.

#### Synonym Pick — WordNet Integration

Synonym Pick uses the WordNet lexical database (pre-computed at build time):
- **Coverage:** ~82.9% of single-word English answers have WordNet synsets. The system gracefully degrades for the rest.
- **Fallback:** If WordNet has no synset for the answer, this variant is skipped and another is selected.

#### Synonym Safety for Vocabulary Decks

Vocabulary decks have high synonym density. The synonym group system (§3.5) is MANDATORY for all vocabulary decks.

| Language | Word A | Word B | English Overlap | Must Group? |
|----------|--------|--------|-----------------|-------------|
| Japanese | おいしい | うまい | "delicious", "tasty" | YES |
| Japanese | きれい | うつくしい | "beautiful", "pretty" | YES |
| Spanish | bonito | hermoso | "beautiful", "pretty" | YES |
| French | beau | joli | "beautiful", "pretty" | YES |

The `acceptableAlternatives` intersection algorithm (§3.5) catches all of these automatically at deck build time.

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

See §8 for the complete 89-enemy roster with HP, intents, traits, and quiz integration behaviors.

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

## 5.7. Cursed Card Visuals — REMOVED

**The Cursed Card visual system has been removed** along with the Cursed Card mechanic (see §11). With dynamic fact assignment, there is no persistent "cursed fact on a card" to display — facts are assigned at charge time, not at draw time.

Wrong answers are now handled by:
- Lower multiplier (0.6×/0.7×) — unchanged
- Higher in-run FSRS weight for future fact selection — the system will present this fact again sooner
- Confusion matrix recording — the wrong answer pair is stored and used to generate harder distractors later
- Card slot mastery does not gain a level on wrong answer — or loses one level at mastery 1+

No separate cursed visual state is needed. The consequence of failure is built into the adaptive system.

---

## 6. Card Mechanics (91 Active Mechanics)

Cards unlock as character level increases. New players start at level 0 with 36 mechanics (all 31 original + 5 new basics). Exotic mechanics unlock gradually through level 13.

### Starting Deck (10 Cards)

| Card | Count | AP | Quick Play | Charged Correct (2a) | Charged Wrong |
|------|-------|----|------------|---------------------|---------------|
| Strike | 5 | 1 | 4 dmg | 6 dmg | 2.8 dmg |
| Block | 4 | 1 | 3 block | 4.5 block | 2.1 block |
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

All 91 active mechanics. Quick Play (QP) = 1.0×. Charged Correct = 2.5×–4.0× (mastery 0–5, see Mastery Upgrade System). Charged Wrong = 0.6× (mastery 0) / 0.7× (mastery 1+). Values shown at mastery 0 for standard reference unless noted.

#### Attack Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Strike** | 1 | 4 dmg | 6 dmg | 2.8 dmg | Bread and butter — weak at M0 by design |
| **Multi-Hit** | 2 | 4×3 (12 total) | 12×3 (36 total) | 2.8×3 (8.4 total) | Devastating when Charged |
| **Heavy Strike** | 3 | 20 dmg | 60 dmg | 14 dmg | The nuke. Charge costs 4 AP total. |
| **Piercing** | 1 | 6 dmg (ignores block) | 18 dmg | 4.2 dmg | Anti-tank |
| **Reckless** | 1 | 12 dmg, 3 self | 36 dmg, 3 self | 8.4 dmg, 3 self | Self-damage stays flat |
| **Execute** | 1 | 6 (+8 if <30%) | 18 (+24 if <30%) | 4.2 (+5.6 if <30%) | Finisher. 42 dmg Charged vs low HP. |
| **Lifetap** | 2 | 8 dmg, heal 20% | 24 dmg, heal 20% | 5.6 dmg, heal 20% | Sustain attack |

#### Shield Mechanics

| Mechanic | AP | Quick Play | Charged Correct | Charged Wrong | Notes |
|----------|----|------------|-----------------|---------------|-------|
| **Block** | 1 | 3 block | 4.5 block | 2.1 block | Standard defense — weak at M0 by design |
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
| **Adapt** | 1 | Shows CardPickerOverlay: choose attack form, shield form, or cleanse+draw form | Same forms at 1.5× power | Forms at 0.7× power | REWORKED: player picks form each play via overlay instead of auto-selecting |
| **Transmute** | 1 | Shows CardPickerOverlay: choose 1 of 3 cards to become for this encounter | At M3: choose up to 2 of 3 (all at Transmute's mastery level) | Card reverts to Transmute at encounter end | REWORKED: self-transforms into player's choice (M1: 1 option at M1; M2: all options at M1; M3: 2 picks at Transmute mastery). Player can always skip. |

### Key Balance Principles (v2)

1. **Every card has a reason to Charge AND a reason to Quick Play.** Quick Play is AP-efficient. Charging is power-efficient. Different situations favor each.
2. **Buff/debuff Charging is about bonus effects, not just numbers.** Charged Focus gives 2 discounts. Charged Double Strike adds Piercing. Qualitatively different, not just "bigger number."
3. **Wrong answers always give SOMETHING (0.7×).** Never a total waste. But always worse than Quick Play (1.0×). Clear punishment without run-ending frustration. Exception: Feedback Loop CW = 0 dmg. Inscription of Wisdom CW = complete fizzle.
4. **0-AP cards cost 1 AP to Charge.** Quicken, Foresight, Swap, Corroding Touch, and Sacrifice become "free quiz cards" — the quiz IS the AP cost.
5. **Chain multipliers stack with Charge multipliers.** Planning chains + Charging = exponential payoff.
6. **Unlock gating creates a progression curve.** Levels 0–3 (first ~5 runs) = basics. Levels 4–6 (runs 6–15) = the game's unique mechanics. Levels 7–10 (runs 15–30) = advanced archetypes. Levels 11–13 (runs 30–60) = chase unlocks.

### Encounter-Scoped Transform System

Cards can be temporarily transformed for the duration of a single encounter and then revert:

- A transformed card has `isTransmuted: true` and an `originalCard` reference stored on it
- At the end of every encounter, `revertTransmutedCards()` in `turnManager.ts` restores all such cards to their original state
- **Transmute** uses this to self-transform into a player-chosen card type for one encounter
- **Conjure** creates temporary cards added to hand (also `isTransmuted: true`) that are removed at encounter end
- **Mimic** copies a discard card for the current turn only (per-turn variant of the same pattern)
- Mastery level of the temporary form can differ from the source card's mastery level

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
| B5 | Mastery Surge | 1 | +1 mastery to 1 random hand card | +1 mastery to 2 cards | 11 | Strongest at mastery 4 (approaching max multiplier) |
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
| U1 | Scavenge | 1 | Shows CardPickerOverlay with up to 3 discard cards; picked card added directly to hand | Same; M2+: retrieved card gets +1 temporary mastery | 4 | REWORKED: player picks from discard via overlay instead of auto-retrieving |
| U2 | Sift | 1 | Look at top 3 draw, discard 1 | Look at top 5, discard 2 | 3 | Scry mechanic |
| U3 | Siphon Knowledge | 2 | Draw 2 + see quiz answers 3s | Draw 3 + see answers 5s | 9 | FLAGSHIP. Study in combat |
| U4 | Swap | 0 | Discard 1, draw 1 | Discard 1, draw 2 | 2 | 0-cost cycling |
| U5 | Tutor | 1 | Search deck, add any card to hand | +0 AP cost this turn | 11 | Always powerful |
| U6 | Recollect | 1 | Return 1 exhausted card to discard | Return 2 exhausted | 8 | Exhaust recovery |
| U7 | Synapse | 1 | Draw 2 | Draw 2 + wildcard chain link | 10 | Chain wildcard |
| U9 | Archive | 1 | Retain 1 hand card (doesn't discard) | Retain 2 cards | 5 | Combo setup |
| U10 | Reflex | 1 | Draw 2 | Draw 3 | 6 | Passive: +3 block when discarded from hand |
| U11 | Conjure | 1 | Shows CardPickerOverlay with 1 attack, 1 shield, 1 other card; selected card added to hand as temporary (removed at encounter end). Exhausts after use. | Same; M1: one option is T2a; M2: all T2a; M3: all T2b | 5 | NEW (Phase 2). Temporary card summon via picker. |
| U12 | Forge | 1 | Shows CardPickerOverlay with up to 3 hand cards; selected card gains +1 mastery for this encounter. Discards normally (reusable). | M2: +2 mastery to 1 card; M3: +2 mastery to 2 cards | 7 | NEW (Phase 2). Temporary mastery boost via picker. |

#### New Wild Mechanics (10)

| # | Name | AP | QP | CC | Unlock | Notes |
|---|------|----|----|-----|--------|-------|
| W1 | Chameleon | 1 | Copy last card at 1.0× | Copy at 1.3× + inherit chain type | 6 | Chain-aware copy |
| W2 | Phase Shift | 1 | Choose: 8 dmg OR 8 block | 12 dmg AND 12 block | 7 | Per-play modal |
| W3 | Knowledge Bomb | 2 | 4 dmg | 4 dmg per correct Charge this encounter | 13 | Scales with quiz performance |
| W4 | Dark Knowledge | 1 | 3 dmg per wrong answer this run | 5 dmg per wrong answer this run | 8 | Turns failures into a weapon (counts in-run wrong answers, not cursed facts) |
| W5 | Catalyst | 1 | Double all Poison on enemy | Double Poison + double Burn | 10 | STS classic |
| W6 | Chain Anchor | 1 | Draw 1 | Set chain to 2 + draw 1 | 9 | Chain starter |
| W7 | Sacrifice | 0 | Lose 5 HP, draw 2, gain 1 AP | Lose 5 HP, draw 3, gain 2 AP | 8 | STS Offering |
| W8 | Mimic | 1 | Shows CardPickerOverlay with 3 random discard cards; copies chosen at 0.8× (M0-1) or full power (M2-3) | Shows best 3 discard cards; copies at 1.0× (M2) or 1.2× (M3) | 11 | REWORKED: always shows picker overlay (M0-1: 3 random; M2-3: best 3). Discard pile toolbox. |
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
| 1 | The Shallows | 1–4 | 7–8 per path | Deck building, learn combat, adaptive mastery-0 difficulty eases players into the chosen deck |
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

Enemy pool: Page Flutter, Thesis Construct, Mold Puff. Teaches basic Quick Play rhythm, introduces Charge as optional power boost.

### Act 2: The Depths (Floors 5–8)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (medium) | 3–4 | Synergy testing, harder enemies |
| Elite | 1 | Quiz-focused encounter, guaranteed relic |
| Rest Site | 1 | Heal / Study / Meditate choices |
| Shop/Mystery | 0–1 | Deck refinement |
| Boss | 1 | Act gate with Quiz Phase at 50% HP |

Elite encounters force Charging via enemy special abilities (The Peer Reviewer gains Strength if you don't Charge). This is where quiz skill becomes non-optional.

**Boss Quiz Phase (The Algorithm at 50% HP):** Combat pauses. 5 rapid questions. Each correct = boss loses 10% remaining HP + player gains buff. Each wrong = boss gains +3 Strength. Then combat resumes.

### Act 3: The Archive (Floors 9–12)

| Node Type | Count | Purpose |
|-----------|-------|---------|
| Combat (hard) | 3–4 | Build-or-die encounters |
| Elite | 1 | Final relic opportunity |
| Rest Site | 1 | Last heal/upgrade chance |
| Shop | 0–1 | Final purchases |
| Final Boss | 1 | Extended fight with 2 Quiz Phases |

**Final Boss (The Final Lesson):** Quiz phases at 66% and 33% HP. The 33% phase is RAPID FIRE — 8 questions, 4-second timers, each correct = 5 direct damage, each wrong = boss heals 5 HP. The climactic test of everything learned.

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
| Common | 50g | 35g |
| Uncommon | 80g | 56g |
| Rare | 140g | 98g |

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

After each combat encounter, player chooses 1 of 3 card options. Each option is an actual card — showing the mechanic name, AP cost, short description, chain theme color + icon. Cards are selected from the run pool weighted by the run archetype (aggressive, defensive, control, hybrid, balanced).

**Reward screen (altar):** The post-combat reward screen uses a custom background with a stone altar and cloth surface where reward items float. Assets at `public/assets/reward_room/`:
- `reward_room_bg.webp` / `.png` — the full background (stone altar scene)
- `cloth_spawn_zone.json` — defines the cloth region where floating reward icons (cards, health vials, gold) are positioned

Art Studio tab: **Reward Rooms** (for regenerating this background).

Displays 3 mini-cards on the altar surface. Each mini-card shows:
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

Run state saved after each completed node. On resume, player returns to the map at their last completed position. Run state stores deck ID + in-run FSRS state.

**Active Run Guard Popup:** If the player clicks "Enter Dungeon" while a saved run exists, a modal popup appears showing the run's current stats (floor, gold, encounters won, facts correct). Two options are presented: "Continue Run" (resumes the existing run) and "Abandon & Start New" (clears the save and begins a fresh run). Clicking the backdrop dismisses the popup without action. The active-run banner is hidden while the popup is visible to avoid double UI.

### Deck Building Strategy

**Pool building:** Each run uses a single curated deck. The deck selection at run start determines the fact pool, chain themes (3 selected per run from the deck's available themes), and question templates available. Cards are concentrated on 3 chain themes enabling ~50% chain frequency per hand.

**Deck size:** Starts at 10 cards. Each card reward adds 1 card (no limit). Card removal at shops and Meditate at rest sites thin the deck. Optimal decks: 15–20 cards (tight and consistent).

---

## 8. Enemy Design (89 Quiz-Integrated Enemies)

### Design Philosophy

Single enemies only (no multi-enemy encounters at launch). Variety comes from enemy BEHAVIOR, not COUNT. Each enemy archetype creates different pressure on the Charge system.

**Trait legend:** `chargeResistant` = Quick Play deals 50% damage; `chainVulnerable` = chain attacks deal +50% damage; `quickPlayImmune` = Quick Play deals 0 damage; `quickPlayDamageMultiplier` = Quick Play deals that fraction of normal damage; `chainMultiplierOverride` = forces all chain multipliers to a fixed value; `immuneDomain` = cards of that domain deal 0 damage.

**Reactive hooks:** `onPlayerChargeWrong` = fires after a wrong Charge answer; `onPlayerChargeCorrect` = fires after a correct Charge; `onPlayerNoCharge` = fires at end of player turn if no Charge was made that turn; `onEnemyTurnStart` = fires at the start of each enemy turn.

**HP Source of Truth:** All enemy HP values live exclusively in `src/data/enemies.ts`. Effective HP = `baseHP × ENEMY_BASE_HP_MULTIPLIER × floorScaling`. The GDD documents enemy tiers and intent pools only — not specific HP numbers. See `balance.ts` for the current multiplier value.

---

### Act 1 — Shallow Depths

#### Common Enemies

**Page Flutter** (`page_flutter`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 3), Attack 2 (wt 2), Buff +1 Strength 2t (wt 1), Defend 1 (wt 1)
*Common cave predator. Fast and fragile. First thing you'll see down here.*

**Thesis Construct** (`thesis_construct`) — Common (standard, weight 10) | `chargeResistant` | Standard tier
Intents: Attack 2 (wt 2), Defend 2 (wt 2), Charge 4 bypass-cap (wt 1), Multi-attack 2×2 (wt 1)
*Crystal-encrusted and slow. Blocks on off-turns, then charges a heavy spike.*

**Mold Puff** (`mold_puff`) — Common (standard, weight 10) | Tanky tier
Intents: Attack 2 (wt 2), Debuff Poison 2/3t (wt 3), Debuff Weakness 1/2t (wt 1)
*Low HP fungus. Stacks poison fast. Kill it before it stacks.*

**Ink Slug** (`ink_slug`) — Common (standard, weight 10) | Tanky tier
Intents: Attack 2 (wt 2), Debuff Poison 2/2t (wt 3), Defend 1 (wt 1)
*Slug-shaped and wet. Poison seeps from its touch.*

**Bookmark Vine** (`bookmark_vine`) — Common (uncommon, weight 5) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×3 (wt 3), Debuff Poison 2/2t (wt 2), Attack 2 (wt 1)
*Roots that move on their own. Vines, poison, persistence.*

**Staple Bug** (`staple_bug`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 3), Attack 2 (wt 2), Multi-attack 2×2 (wt 1)
*Heavy carapace. Prefers to block and wait.*

**Margin Gremlin** (`margin_gremlin`) — Common (uncommon, weight 5) | Glass tier
Intents: Attack 2 (wt 3), Buff +1 Strength 2t (wt 2), Attack 2 (wt 1)
*Pale limestone imp. Quick, aggressive, annoying.*

**Index Weaver** (`index_weaver`) — Common (standard, weight 10) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×3 (wt 3), Debuff Poison 2/3t (wt 2), Attack 2 (wt 1)
*Venomous and fast. Multiple attacks per encounter.*

**Overdue Golem** (`overdue_golem`) — Common (standard, weight 10) | Tanky tier
Intents: Heal 6 (wt 2), Debuff Weakness 1/2t (wt 2), Attack 2 (wt 1)
*Bog water and peat, barely held together. Heals from the muck.*

**Pop Quiz** (`pop_quiz`) — Common (uncommon, weight 5) | Tanky tier
Intents: Debuff Poison 2/3t (wt 2), Debuff Weakness 1/2t (wt 2), Attack 2 (wt 1)
*Young fungus. Spores before strikes.*

**Eraser Worm** (`eraser_worm`) — Common (rare, weight 2) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×4 (wt 3), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*No eyes, hunts by vibration. Never stops biting.*

#### Mini-Boss Enemies

**The Plagiarist** (`plagiarist`) — Mini-Boss | Light tier
Intents: Attack 2 (wt 3), Attack 2 (wt 2), Debuff Vulnerable 1/2t (wt 1)
Reactive: `onEnemyTurnStart` — from turn 4 onward, gains +5 `enrageBonusDamage` every turn.
*Gets deadlier each turn. Survive to turn 4 and it permanently gains +5 damage per turn after that.*

**The Card Catalogue** (`card_catalogue`) — Mini-Boss | Medium tier
Intents: Heal 8 (wt 2), Multi-attack 2×3 (wt 2), Debuff Poison 2/3t (wt 1), Attack 2 (wt 1)
*The source of all those roots. Old, vast, and furious.*

**The Headmistress** (`headmistress`) — Mini-Boss | Medium tier
Intents: Defend 2 (wt 3), Charge 5 (wt 1), Buff +1 Strength 2t (wt 1), Attack 2 (wt 1)
*A colony of iron beetles, stacked and coordinated. Doesn't yield.*

**The Tutor** (`tutor`) — Mini-Boss | Light tier
Intents: Debuff Weakness 1/2t (wt 2), Debuff Vulnerable 1/2t (wt 2), Heal 6 (wt 1), Attack 2 (wt 1)
*Swamp hag. Curses and weakens before she bothers to hit.*

**The Study Group** (`study_group`) — Mini-Boss | Medium tier
Intents: Debuff Poison 3/3t (wt 2), Buff +2 Strength 2t (wt 1), Defend 2 (wt 1), Attack 2 (wt 1)
*Crowned fungus. Rules its colony through poison.*

#### Elite Enemies

**The Librarian** (`librarian`) — Elite
Phase 1: Attack 2 (wt 2), Defend 2 (wt 1), Charge 5 (wt 1), Buff +2 Strength 2t (wt 1)
Phase transition at 40% HP → Phase 2: Attack 3 (wt 2), Multi-attack 2×3 (wt 2), Charge 5 (wt 1)
*Thick hide, slow temper. Wound it and it stops being slow.*

#### Boss Enemies

**The Final Exam** (`final_exam`) — Boss
Phase 1: Attack 2 (wt 2), Multi-attack 2×4 (wt 1), Defend 2 (wt 1), Debuff Weakness 1/2t (wt 1)
Phase transition at 40% HP → Phase 2: Attack 4 (wt 2), Multi-attack 2×3 (wt 2), Defend 2 (wt 1), Charge 6 bypass-cap (wt 1)
*An old mining rig, still running. Nobody told it to stop.*

**The Burning Deadline** (`burning_deadline`) — Boss
Phase 1: Attack 2 (wt 1), Attack 2 (wt 1), Debuff Poison 3/3t (wt 1), Buff +2 Strength 3t (wt 1)
Phase transition at 40% HP → Phase 2: Attack 4 (wt 2), Multi-attack 2×4 (wt 1), Debuff Poison 4/3t (wt 1)
*Molten rock, given shape. The heat alone is a threat.*

---

### Act 2 — Deep Caverns & The Abyss

Act 2 spans two regions. Deep Caverns enemies appear in early Act 2; The Abyss enemies appear in late Act 2. Both pools are drawn from in the same act.

#### Common Enemies — Deep Caverns

**The Crib Sheet** (`crib_sheet`) — Common (standard, weight 10) | Glass tier
Intents: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 1)
Reactive: `onPlayerChargeWrong` — mirrors card's base damage back to player (`_mirrorDamage`).
*Mirrors your failures. Miss a Charge and it hits you back for the same damage.*

**The Citation Needed** (`citation_needed`) — Common (standard, weight 10) | Tanky tier
Intents: Attack 2 (wt 3), Heal 5 (wt 2), Defend 1 (wt 1), Debuff Weakness 1/2t (wt 1)
Reactive: `onPlayerChargeWrong` — steals up to 5 block from player; enemy heals for stolen amount.
*Steals your block when you miss a Charge. Build defenses before risking a quiz.*

**The Grade Curve** (`grade_curve`) — Common (standard, weight 8) | Tanky tier
Intents: Attack 2 (wt 3), Defend 1 (wt 2), Attack 2 (wt 1)
Reactive: `onPlayerChargeCorrect` — gains +2 `enrageBonusDamage` per correct Charge.
*Gains +2 Strength every time you Charge correctly. Kill fast or play safe.*

**The Crambot** (`crambot`) — Common (standard, weight 10) | `chargeResistant` | Standard tier
Intents: Defend 1 (wt 2), Attack 2 (wt 2), Attack 2 (wt 1)
*Basalt-skinned reptile. Attacks and blocks in equal measure.*

**The All-Nighter** (`all_nighter`) — Common (standard, weight 10) | Standard tier
Intents: Debuff Weakness 1/2t (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Salt crystals, loosely haunting. Saps strength on contact.*

**The Spark Note** (`spark_note`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 2), Debuff Poison 2/2t (wt 2), Attack 2 (wt 1)
*Carved from burning coal, still burning. Leaves poison behind.*

**The Watchdog** (`watchdog`) — Common (uncommon, weight 5) | `chargeResistant` | Glass tier
Intents: Multi-attack 2×3 (wt 3), Attack 2 (wt 1), Attack 2 (wt 1)
*Stone wolf. Hunts in the dark, bites multiple times.*

**The Red Herring** (`red_herring`) — Common (standard, weight 10) | Tanky tier
Intents: Debuff Poison 2/3t (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*Born from a vent. Toxic by nature, multiple debuffs.*

**The Anxiety Tick** (`anxiety_tick`) — Common (standard, weight 10) | Tanky tier
Intents: Attack 2 (wt 2), Buff +1 Strength 2t (wt 2), Heal 4 (wt 1)
*Feeds on magma. The heat heals it.*

**The Trick Question** (`trick_question`) — Common (uncommon, weight 5) | Standard tier
Intents: Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 2), Attack 2 (wt 1)
*Adapted to total darkness. Leaves you vulnerable.*

**The Dropout** (`dropout`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Crustacean in a geode shell. Stubborn and difficult to crack.*

**The Brain Fog** (`brain_fog`) — Common (uncommon, weight 5) | Tanky tier
Intents: Debuff Poison 2/3t (wt 2), Debuff Weakness 1/2t (wt 2), Attack 2 (wt 1)
*Gas that haunts. Poisons and weakens on contact.*

**The Thesis Dragon** (`thesis_dragon`) — Common (rare, weight 2) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×3 (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Hangs from the ceiling and drops on you. Fast attacker.*

**The Burnout** (`burnout`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 2), Debuff Poison 2/2t (wt 2), Attack 2 (wt 1)
*Moth on fire. Leaves scorch-poison on contact.*

#### Common Enemies — The Abyss

**The Writer's Block** (`writers_block`) — Common (standard, weight 10) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×4 (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Obsidian shard, floating and sharp. Attacks in volleys.*

**The Information Overload** (`information_overload`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 2), Debuff Poison 2/2t (wt 2), Attack 2 (wt 1)
*Lava that moves with purpose. Leaves burn-poison.*

**The Rote Memory** (`rote_memory`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 2), Attack 2 (wt 2), Buff +1 Strength 2t (wt 1)
*Pure crystal, animated. Blocks and attacks with equal comfort.*

**The Outdated Fact** (`outdated_fact`) — Common (uncommon, weight 5) | `chainVulnerable` | Glass tier
Intents: Multi-attack 2×3 (wt 3), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*Dinosaur skeleton, still furious. Fast and relentless.*

**The Hidden Gem** (`hidden_gem`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Crystalline shell. Nearly impossible to reach through all that block.*

**The Rushing Student** (`rushing_student`) — Common (standard, weight 10) | `chainVulnerable` | Standard tier
Intents: Debuff Poison 2/3t (wt 2), Multi-attack 2×3 (wt 2), Attack 2 (wt 1)
*Magma centipede. The trail it leaves burns.*

**The Echo Chamber** (`echo_chamber`) — Common (uncommon, weight 5) | Glass tier
Intents: Attack 2 (wt 3), Multi-attack 2×3 (wt 2), Attack 2 (wt 1)
*Crystal wings. Each swoop is a blade.*

**The Blank Spot** (`blank_spot`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 3), Defend 2 (wt 2), Heal 5 (wt 1)
Reactive: `onPlayerChargeWrong` — gains +8 block.
*Gains 8 block when you answer wrong on a Charge. Only Charge facts you know.*

**The Burnout Phantom** (`burnout_phantom`) — Common (standard, weight 10) | Standard tier
Intents: Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 2), Attack 2 (wt 1)
*Ash from old eruptions. Leaves you open to damage.*

**Prismatic Jelly** (`prismatic_jelly`) — Common (uncommon, weight 5) | Tanky tier
Intents: Debuff Weakness 1/2t (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*Iridescent and toxic. Stacks weakness and vulnerability.*

**Ember Skeleton** (`ember_skeleton`) — Common (rare, weight 2) | `chainVulnerable` | Standard tier
Intents: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Buff +1 Strength 2t (wt 1)
*Burning skeleton. Gets stronger while it burns.*

#### Mini-Boss Enemies

**The Tenure Guardian** (`tenure_guardian`) — Mini-Boss | Medium tier
Intents: Attack 2 (wt 3), Defend 1 (wt 3), Attack 2 (wt 1)
Reactive: `onPlayerNoCharge` — gains +1 permanent Strength per turn without a Charge.
*Crystal-armored golem. Blocks accumulate each turn.*

**The Proctor** (`proctor`) — Mini-Boss | Medium tier
Intents: Attack 2 (wt 2), Defend 2 (wt 3), Buff +1 Strength 3t (wt 1), Charge 5 (wt 1)
Reactive: `onPlayerNoCharge` — gains +1 permanent Strength per turn without a Charge.
*Old stone warrior. Very slow, very durable. A war of attrition.*

**The Harsh Grader** (`harsh_grader`) — Mini-Boss | Medium tier
Intents: Debuff Poison 3/3t (wt 2), Debuff Weakness 1/2t (wt 1), Multi-attack 2×3 (wt 1), Attack 2 (wt 1)
*Crystallized sulfur, given authority. Stacks poison fast.*

**The Textbook** (`textbook`) — Mini-Boss | Medium tier
Intents: Defend 2 (wt 2), Charge 5 (wt 1), Attack 2 (wt 1)
*Solid granite, enormous. Damage barely registers.*

**The Imposter Syndrome** (`imposter_syndrome`) — Mini-Boss | Medium tier
Intents: Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1), Attack 2 (wt 1)
*Deep cave predator. Patient, then very fast.*

**The Pressure Cooker** (`pressure_cooker`) — Mini-Boss | Medium tier
Intents: Attack 2 (wt 2), Debuff Poison 3/2t (wt 2), Defend 2 (wt 1), Attack 2 (wt 1)
*Lava-formed lizard. Bites and burns.*

**The Grade Dragon** (`grade_dragon`) — Mini-Boss | Medium tier
Intents: Attack 2 (wt 3), Attack 2 (wt 2), Debuff Poison 2/2t (wt 1)
*Small and vicious. Hits hard, breaks easy.*

**The Comparison Trap** (`comparison_trap`) — Mini-Boss | Light tier
Intents: Attack 2 (wt 3), Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 1)
*Copies your last card type. Nastier than The Crib Sheet.*

**The Perfectionist** (`perfectionist`) — Mini-Boss | Medium tier
Intents: Defend 2 (wt 2), Charge 5 (wt 1), Attack 2 (wt 2)
Reactive: `onPlayerNoCharge` — gains +1 permanent Strength per turn without a Charge.
*Obsidian glass forged into armor. Blocks well, then cuts.*

**The Hydra Problem** (`hydra_problem`) — Mini-Boss | Medium tier
Intents: Multi-attack 2×3 (wt 2), Defend 2 (wt 1), Heal 6 (wt 1), Attack 2 (wt 1)
*Three crystal heads. At least one is always healing.*

**The Ivory Tower** (`ivory_tower`) — Mini-Boss | Medium tier
Intents: Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 2)
*Ancient bones, reanimated and airborne. Drops fast.*

**The Helicopter Parent** (`helicopter_parent`) — Mini-Boss | Medium tier
Intents: Multi-attack 2×3 (wt 2), Debuff Poison 3/3t (wt 2), Defend 2 (wt 1), Attack 2 (wt 1)
*Lava spider, large. Floods the field with spawn and poison.*

#### Elite Enemies

**The Deadline Serpent** (`deadline_serpent`) — Elite
Phase 1: Attack 2 (wt 2), Debuff Poison 3/3t (wt 2), Multi-attack 2×2 (wt 1), Attack 2 (wt 1)
Phase transition at 50% HP → Phase 2: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Charge 5 (wt 1)
*Lava-formed cobra. Deadly at range and up close.*

**The Standardized Test** (`standardized_test`) — Elite
Intents: Defend 2 (wt 2), Charge 5 (wt 1), Buff +2 Strength 2t (wt 1), Attack 2 (wt 1)
*Basalt column, upright and hostile. Hits slowly, hits hard.*

**The Emeritus** (`emeritus`) — Elite
Phase 1: Defend 2 (wt 2), Heal 7 (wt 1), Attack 2 (wt 1), Buff +2 Strength 2t (wt 1)
Phase transition at 50% HP → Phase 2: Multi-attack 2×3 (wt 2), Charge 5 (wt 1), Attack 2 (wt 1)
*Crystal-built, hard to kill. Becomes far more dangerous at half HP.*

**The Student Debt** (`student_debt`) — Elite
Phase 1: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 1), Attack 2 (wt 1)
Phase transition at 40% HP → Phase 2: Attack 3 (wt 2), Multi-attack 2×4 (wt 2), Attack 2 (wt 1)
*Deep-abyss serpent. Wound it and it stops caring about defense.*

**The Publish-or-Perish** (`publish_or_perish`) — Elite | `immuneDomain: natural_sciences`
Intents: Debuff Weakness 1/2t (wt 2), Debuff Vulnerable 1/2t (wt 2), Heal 8 (wt 1), Attack 2 (wt 1)
*Crystal lich. Natural science cards do nothing to it. Debuffs everything.*

#### Boss Enemies

**The Algorithm** (`algorithm`) — Boss
Phase 1: Attack 2 (wt 2), Defend 2 (wt 1), Debuff Vulnerable 1/2t (wt 1), Heal 8 (wt 1)
Phase transition at 50% HP → Phase 2: Attack 2 (wt 2), Multi-attack 2×4 (wt 1), Debuff Weakness 2/2t (wt 1), Heal 10 (wt 1)
Quiz Phase at 50% HP: 5 questions.
*Old archive AI. Still running, still territorial. Triggers a quiz phase at half health.*

**The Curriculum** (`curriculum`) — Boss
Intents: Attack 2 (wt 4), Defend 2 (wt 3), Multi-attack 2×3 (wt 2), Heal 8 (wt 1)
*Living crystal. Status effects don't stick. It just keeps coming.*

**The Group Project** (`group_project`) — Boss
Phase 1: Attack 2 (wt 35), Multi-attack 2×3 (wt 30), Debuff Poison 3/3t (wt 20), Attack 2 (wt 15)
Phase transition at 50% HP → Phase 2: Multi-attack 2×2 (wt 3), Multi-attack 2×4 (wt 2), Debuff Poison 4/3t (wt 2), Attack 3 (wt 1)
*Shadow serpent with multiple heads. At half HP, a second head wakes up.*

**The Rabbit Hole** (`rabbit_hole`) — Boss
Intents: Attack 3 (wt 4), Multi-attack 2×3 (wt 2), Debuff Vulnerable 1/2t (wt 15), Debuff Weakness 1/2t (wt 15), Defend 2 (wt 1)
*Something from between spaces. Its attacks hit your hand as much as your health.*

---

### Act 3 — The Archive

#### Common Enemies

**The Thesis Djinn** (`thesis_djinn`) — Common (standard, weight 10) | `chargeResistant` | Standard tier
Intents: Attack 2 (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*Compressed air elemental. The pressure alone opens wounds.*

**The Gut Feeling** (`gut_feeling`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Attack 2 (wt 1)
*Iron-bodied worm from the core. Bites repeatedly.*

**The Bright Idea** (`bright_idea`) — Common (standard, weight 10) | Standard tier
Intents: Debuff Weakness 1/2t (wt 3), Attack 2 (wt 2), Attack 2 (wt 1)
*Bioluminescent jellyfish. Its sting saps strength.*

**The Sacred Text** (`sacred_text`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 2), Attack 2 (wt 2), Attack 2 (wt 1)
*Plated beetle, massive. Difficult to damage through that shell.*

**The Devil's Advocate** (`devils_advocate`) — Common (uncommon, weight 5) | Standard tier
Intents: Attack 2 (wt 2), Debuff Poison 2/2t (wt 2), Buff +1 Strength 2t (wt 1)
*Mantle-born demon. Burns, poisons, and gets stronger doing it.*

**The Institution** (`institution`) — Common (standard, weight 10) | `chargeResistant` | Tanky tier
Intents: Defend 2 (wt 3), Attack 2 (wt 2), Charge 4 (wt 1)
*Pure iron golem. Dense enough that most damage just doesn't register.*

**The Rosetta Slab** (`rosetta_slab`) — Common (uncommon, weight 5) | Standard tier
Intents: Defend 2 (wt 2), Debuff Weakness 1/2t (wt 2), Attack 2 (wt 1)
*Inscribed stone tablet, floating. Curses weaken on contact.*

**The Moth of Enlightenment** (`moth_of_enlightenment`) — Common (standard, weight 10) | Standard tier
Intents: Attack 2 (wt 2), Debuff Vulnerable 1/2t (wt 2), Attack 2 (wt 1)
*Eats books and scrolls. Leaves you vulnerable.*

**The Hyperlink** (`hyperlink`) — Common (uncommon, weight 5) | Standard tier
Intents: Multi-attack 2×3 (wt 2), Debuff Poison 2/3t (wt 2), Attack 2 (wt 1)
*Weaves runic webs. The threads poison.*

**The Unknown Unknown** (`unknown_unknown`) — Common (rare, weight 2) | Standard tier
Intents: Attack 2 (wt 2), Debuff Weakness 1/2t (wt 2), Debuff Vulnerable 1/2t (wt 2)
*Tendril from somewhere else. Weakens and exposes in equal measure.*

**The Fake News** (`fake_news`) — Common (standard, weight 10) | `chargeResistant` | Standard tier
Intents: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Defend 1 (wt 1)
*Shaped like a tome, moves like a predator.*

#### Mini-Boss Enemies

**The First Question** (`first_question`) — Mini-Boss | Medium tier
Phase 1: Attack 2 (wt 2), Multi-attack 2×3 (wt 2), Charge 5 (wt 1), Attack 2 (wt 1)
Phase transition at 50% HP → Phase 2: Attack 2 (wt 2), Multi-attack 2×4 (wt 2)
*Old enough to remember the world's formation. Wound it and you'll know.*

**The Dean** (`dean`) — Mini-Boss | Medium tier
Intents: Attack 2 (wt 2), Defend 2 (wt 2), Buff +2 Strength 2t (wt 1), Debuff Vulnerable 1/2t (wt 1)
Reactive: `onPlayerNoCharge` — gains +1 permanent Strength per turn without a Charge.
*Iron-forged and magnetic. Fights without favoring offense or defense.*

**The Dissertation** (`dissertation`) — Mini-Boss | Heavy tier
Intents: Defend 2 (wt 2), Charge 5 (wt 1), Attack 2 (wt 2)
*Ultra-dense golem under extreme pressure. Barely flinches.*

**The Eureka** (`eureka`) — Mini-Boss | Medium tier
Intents: Debuff Weakness 1/2t (wt 2), Debuff Vulnerable 1/2t (wt 2), Heal 7 (wt 1), Attack 2 (wt 1)
*Bioluminescent butterfly, vast and old. Curses you while healing itself.*

**The Paradigm Shift** (`paradigm_shift`) — Mini-Boss | Heavy tier
Intents: Attack 2 (wt 2), Charge 5 (wt 1), Multi-attack 2×3 (wt 2)
*A living earthquake. Stone given will and direction.*

**The Ancient Tongue** (`ancient_tongue`) — Mini-Boss | Medium tier
Intents: Defend 2 (wt 2), Heal 7 (wt 1), Attack 2 (wt 1), Buff +1 Strength 3t (wt 1)
Reactive: `onPlayerNoCharge` — gains +1 permanent Strength per turn without a Charge.
*Built from protective runes. Hard to chip down, keeps healing.*

**The Lost Thesis** (`lost_thesis`) — Mini-Boss | Medium tier
Intents: Debuff Weakness 1/2t (wt 2), Attack 2 (wt 2), Defend 2 (wt 1), Heal 6 (wt 1)
*The ghost of a librarian. Still cataloguing. Still territorial.*

#### Elite Enemies

**The Dunning-Kruger** (`dunning_kruger`) — Elite | `chainMultiplierOverride: 1.0`
Intents: Attack 2 (wt 3), Debuff Weakness 1/2t (wt 2), Attack 2 (wt 2), Defend 2 (wt 1)
*Chain multipliers don't work while this is alive. Knowledge Chains flatline at 1.0×.*

**The Singularity** (`singularity`) — Elite | `quickPlayDamageMultiplier: 0.3`
Intents: Attack 2 (wt 3), Buff +2 Strength 3t (wt 2), Attack 2 (wt 2), Defend 2 (wt 1)
*Resistant to Quick Play — only deals 30% damage. Charge for full effect.*

#### Boss Enemies

**The Omnibus** (`omnibus`) — Boss
Intents: Attack 2 (wt 35), Attack 3 (wt 25), Defend 2 (wt 20), Buff +2 Strength 3t (wt 20), Charge 5 (wt 1)
*Built from compressed books. Wrong answers feed it power.*

**The Final Lesson** (`final_lesson`) — Boss
Phase 1: Attack 2 (wt 3), Multi-attack 2×4 (wt 2), Debuff Weakness 2/2t (wt 2), Buff +2 Strength 3t (wt 2), Heal 12 (wt 1)
Phase transition at 33% HP → Phase 2: Attack 2 (wt 3), Multi-attack 2×4 (wt 2), Debuff Vulnerable 2/3t (wt 2), Heal 10 (wt 1), Buff +3 Strength 5t (wt 1)
Quiz Phase 1 at 66% HP: 5 questions. Quiz Phase 2 at 33% HP: 8 questions, 4-second timers, Rapid Fire.
*Final guardian. Quiz phases at 66% and 33% HP. The second one is Rapid Fire.*

---

### Deprecated Enemies (kept for save compatibility, not in active pools)

**The Bookwyrm** (`bookwyrm`) — *Deprecated Elite*
Phase 1: Attack 2 (wt 2), Attack 2 (wt 1), Defend 1 (wt 1) | Phase transition at 50%
*Pre-v2 roster. Not spawned in current runs.*

**The Peer Reviewer** (`peer_reviewer`) — *Deprecated Elite*
Intents: Attack 2 (wt 3), Buff +1 Strength 2t (wt 2), Attack 2 (wt 1)
Reactive: `onPlayerNoCharge` — gained +3 permanent Strength per no-Charge turn.
*Pre-v2 roster. Not spawned in current runs.*

---

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

- **Chain trigger:** Consecutive Charge plays of same `chainType` (same chain theme) in one turn
- **Chain break:** Quick Play, wrong Charge answer, different chain theme
- **Run chain selection:** Each run uses 3 of the deck's chain themes (selected deterministically by run seed). Knowledge decks use named thematic themes (e.g., "Civil War Era"); vocabulary decks use generic colors (Obsidian, Crimson, etc.). ~50% chain frequency per 5-card hand.
- **Multipliers:** 1.0× (no chain), 1.3× (2-chain), 1.7× (3-chain), 2.2× (4-chain), 3.0× (5-chain)
- **Stacks with:** Charge multiplier (multiplicative), Surge (free Charge, enabling more chains per turn)
- **Visuals:** Chain theme colored card border (3 active per run), in-hand pulse, connection line animation, chain display (bottom-left, format "Chain: X.x")

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
- **Enemy HP scales with floor depth:** `1.0 + (floor - 1) × 0.10` (10% per floor above floor 1). Multiplied by global `ENEMY_BASE_HP_MULTIPLIER = 4.0`, making floor 1 commons ~40–64 HP each (Act 1 commons baseHP 10–16 post-2026-04-03 rebalance)
- **Enemy HP Variance by Tier:** Commons are classified into 3 HP tiers based on their intent pools:
  - **Glass** (baseHP 10–11): Aggressive enemies with mostly attack intents — kill fast or take big hits. Floor 1 effective HP: 40–44
  - **Standard** (baseHP 11–13): Balanced intent mix — average encounters. Floor 1 effective HP: 44–52
  - **Tanky** (baseHP 14–16): Defensive enemies with defend/buff/heal intents — war of attrition. Floor 1 effective HP: 56–64
  - Elites: baseHP 12–16 (Act 1 librarian 16, Act 2 elites 12–16, Act 3 elites 10). Source of truth is `src/data/enemies.ts`.
  - `difficultyVariance` (0.85–1.15× random) applies to both commons AND elites. Mini-bosses and bosses have natural variance from varied `baseHP` values.
- **Enemy damage scales with floor depth** (+5% per floor above floor 6). Further modulated by Canary system (see below)
- Timer shortens with floor depth (12s → 9s → 7s → 5s → 4s)
- **Early mini-boss HP:** EARLY_MINI_BOSS_HP_MULTIPLIER = 1.0 (no reduction; floor 1–3 mini-bosses use standard HP scaling)

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

## 11. Cursed Card System — REMOVED

**The Cursed Card system has been fully removed.**

**Why it was removed:** Cursed cards required fact-card binding to have visual identity — a specific cursed fact had to be persistently attached to a card slot. With dynamic fact assignment (facts selected at charge time, not draw time), there is no persistent "cursed fact on a card" to display.

**Replacement:** Wrong answers are handled naturally by:
- Lower multiplier on wrong answer (0.6×/0.7× — unchanged)
- Higher in-run FSRS weight — the failed fact is prioritized for future selection this run
- Confusion matrix recording — the wrong answer pair is stored persistently and generates harder distractors in future runs
- Card slot mastery does not gain a level on wrong answer (no mastery progress for guessing wrong)

The educational intent is preserved: the system will present failed facts again more frequently (via in-run FSRS weighting) rather than letting the player avoid them.

---

## 12. Exploitation Prevention

| Method | How |
|--------|-----|
| Commit-before-reveal | Question hidden until irrevocable Charge commit |
| Action Points | 3 AP forces card selection; Charge surcharge forces tradeoffs |
| Wrong answer effect | Wrong Charge = 0.7× (always SOME effect, but always worse than QP) |
| Curated deck pool | Single focused deck (30–50+ facts); harder to game than a mixed 120-fact pool |
| No-repeat-until-cycled | STS draw pile model |
| Question template rotation | Never same template consecutively; mastery unlocks harder templates |
| Template escalation | Higher mastery = harder question variants (reverse, synonym pick, definition match) |
| Per-run mechanic randomization | Same chain theme, different specific fact each charge |
| In-run FSRS weighting | Wrong answers get higher selection weight — no avoiding problem facts |
| FSRS decay | Mastered facts return if not maintained globally |
| Pool-based adaptive distractors | Confusion matrix makes each player's questions uniquely challenging — pattern-matching distractors is your OWN confusion history |
| Synonym group exclusion | Prevents unfair questions where multiple answer options are correct |

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
- At mastery 0, quiz difficulty is lowest (easiest facts, easiest templates, only 2 distractors) — adaptive difficulty replaces the old "Free First Charge" penalty-free introduction
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
- **Not shown** on Surge turns or Chain Momentum turns where the charge surcharge is waived.
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

Wrong Charge resolves at **0.7× multiplier** (mastery 1+) or **0.6×** (mastery 0) — partial effect, not full fizzle. Card is never wasted. It resolves weakly.

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
- Downgrade card slot mastery by 1 level (once per encounter) — at mastery 0, no downgrade
- Record in confusion matrix: which answer the player chose instead of the correct one (persists across runs)
- Increase in-run FSRS weight for the failed fact — will appear more frequently this run

**Wrong answer does NOT:**
- Destroy the card
- Deal self-damage (unless relic effect, e.g., Volatile Core, Scholar's Gambit)
- End the turn

**Combo system removal note:** The combo multiplier system (`COMBO_MULTIPLIERS`, `COMBO_HEAL_*`, `COMBO_DECAY_*`, `comboCount`) has been fully removed from the game. Chains are the only streak mechanic. The `ComboCounter.svelte` component has been replaced by `ChainCounter.svelte` (chain-only display).

---

## 15.5. Damage Pipeline (Appendix E — Authoritative)

The exact order of damage calculation for all attack cards. **The combo multiplier is NOT in this pipeline** — the combo system has been fully removed.

1. `mechanicBaseValue` — for QP: `getMasteryStats().qpValue`; for CC: `getMasteryStats().qpValue × 1.75`; for CW: `FIZZLE_EFFECT_RATIO (0.25×) × baseEffectValue`
2. Note: stat table qpValue already encodes the full mastery level — there is no separate masteryBonus step
3. + Inscription of Fury flat bonus (if active — applied here as flat addition, attack cards only)
4. + relic flat bonuses (`barbed_edge`, etc.)
5. × `card.effectMultiplier` — always 1.0× for active tiers (T1/T2a/T2b); 0× for T3 (passive)
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
- **90 total relics** — 40 starter relics (available to all players, unlocked by level) + 50 unlockable relics (purchased in the Relic Archive via level gates).
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

### Complete Relic Catalogue (90 Relics — 40 Starter + 50 Unlockable)

Entries are grouped by archetype category. Each entry shows: **Name** — Rarity (Starter or Unlockable, unlock level). Curse/tradeoff note where applicable.

---

#### Chain Relics

**Tag Magnet** — Uncommon (Starter)
When drawing cards, +30% chance to draw cards sharing a chain type with your last played card.
*Makes chains more consistent. Excellent with Resonance Crystal and Chain Reactor.*

**Resonance Crystal** — Uncommon (Starter)
Each chain link beyond 2 draws +1 card at end of turn.
*Long chains refill your hand and enable longer chains next turn. Core chain snowball engine.*

**Chain Link Charm** — Uncommon (Starter, Level 1)
Earn +5 gold per chain link in a completed Knowledge Chain.
*Chains pay for themselves. Pairs well with chain-focused builds.*

**Chain Reactor** — Rare (Unlockable, Level 1)
Knowledge Chains of 2+ deal 6 splash damage per chain link.
*6 damage × chain length on every chain. Scales explosively. Core chain damage relic.*

**Chain Forge** — Rare (Unlockable, Level 8)
Once per encounter: a card that would break a chain continues it instead, gains current multiplier, and the chain count increments.
*One free chain extension per encounter. Prevents accidental chain breaks at the worst moment.*

**Chromatic Chain** — Rare (Unlockable, Level 11)
Completing a 3+ chain primes the next chain to start at length 2. Carries across turns. Once per encounter.
*Sustained chain pressure. Every long chain gives the next chain a head start.*

**Prismatic Shard** — Legendary (Unlockable, Level 20)
All chain multipliers +0.5×. 5-chains grant +1 AP.
*The chain capstone. 5-chain hits 3.5× and refunds an AP. Pairs with Chain Reactor for massive turns.*

**Singularity** — Legendary (Unlockable, Level 23)
Completing a 5-chain deals bonus damage equal to the total chain damage dealt (doubles 5-chain output).
*A finished 5-chain fires twice. Combined with Chain Reactor and Prismatic Shard, a single 5-chain can end a fight.*

**Chain Addict** — Rare (Unlockable, Level 6 — conditional)
Complete a 3+ chain: heal 5 HP.
*Sustain woven into chain play. Chains that deal damage also heal.*

---

#### Speed Relics

**Adrenaline Shard** — Uncommon (Starter)
Correct Charged answers in under 3 seconds refund 1 AP (once per turn).
*Fast answerers effectively get 4 AP per turn. Works with any Charge-heavy build.*

**Quicksilver Quill** — Rare (Unlockable, Level 5)
Charged quizzes answered in under 2 seconds get an additional 1.5× multiplier.
*3.0× × 1.5× = 4.5× for the fastest answers. Stacks with all other multipliers.*

**Time Warp** — Rare (Unlockable, Level 6)
On Knowledge Surge turns, quiz timer is halved but Charge multiplier increases to 5.0× and gain +1 AP.
*Extremely high-risk, high-reward on Surge turns. Best paired with speed practice.*

---

#### Glass Cannon Relics

**Volatile Core** — Uncommon (Starter) *(Cursed)*
All attacks +50% damage. Wrong Charged answers deal 3 damage to you AND the enemy.
*Curse: Wrong Charges deal 3 self-damage. Even failures deal enemy damage — pure aggression.*

**Reckless Resolve** — Uncommon (Starter)
Below 40% HP: all attacks +50% damage. Above 80% HP: attacks −15% damage.
*Forces edge-of-death play. The bonus activates when you need it most.*

**Obsidian Dice** — Uncommon (Starter, Level 5)
Each correct Charge: 60% chance +50% multiplier, 40% chance −25% multiplier.
*High-variance Charge payoff. Average positive, but variance is real.*

**Crit Lens** — Rare (Unlockable, Level 8)
Charged correct answers have 25% chance to DOUBLE the final damage (after all multipliers).
*25% crit on every correct Charge. Stacks devastatingly with high-multiplier turns.*

**Berserker's Oath** — Rare (Unlockable, Level 9) *(Cursed)*
Start run with −30 max HP. All attacks +40% damage.
*Curse: −30 max HP permanently this run. Very strong burst damage; fragile.*

**Bloodstone Pendant** — Rare (Unlockable, Level 11 — conditional)
Taking damage grants 1 Fury stack. Each Fury = +1 damage on next attack, then consumed.
*Convert incoming hits into stacked attack damage. Rewards tanking hits.*

---

#### Defense Relics

**Iron Shield** — Common (Starter) *(Tradeoff)*
Start each turn with 3 block. Draw 1 fewer card on turn 1.
*Tradeoff: lose a card on the opening draw. Reliable defense every turn.*

**Steel Skin** — Common (Starter)
Take 3 less damage from all sources (min 1).
*Flat damage reduction. Synergizes with all defensive builds.*

**Thick Skin** — Common (Starter) *(Tradeoff)*
Immune to the first debuff each encounter. Take +2 damage from all sources.
*Tradeoff: +2 damage taken permanently. Strong vs. enemy debuff-heavy encounters.*

**Worn Shield** — Uncommon (Starter, Level 2) *(Tradeoff)*
Every shield card grants 1 Thorns (this turn). All block values −20%.
*Tradeoff: −20% block on all shields. Converts defensive play into passive retaliation.*

**Scar Tissue** — Uncommon (Starter, Level 4)
Cursed cards use 0.85× Quick Play power instead of 0.70×.
*Softens the Quick Play penalty for cursed relics. Useful in cursed-heavy builds.*

**Aegis Stone** — Uncommon (Starter)
Block from shield cards carries between turns (max 15). At 15 block, gain Thorns 2.
*Completely changes shield card evaluation. Constant: `RELIC_AEGIS_STONE_MAX_CARRY = 15`*

**Regeneration Orb** — Uncommon (Starter)
Heal 3 HP at end of each turn where you played 2+ shield cards.
*Sustain through defensive play. Rewards stacking shield cards.*

**Thorn Crown** — Rare (Unlockable, Level 10)
When you have 15+ block at start of turn, reflect 5 damage per enemy attack received.
*5 reflected damage per hit at high block. Pairs with Aegis Stone.*

**Bastion's Will** — Rare (Unlockable, Level 11)
Charged shield cards gain +75% block. Quick Play shield cards gain +25% block.
*Makes Charging defensive cards worthwhile. Best defensive relic for Charge-focused play.*

**Thorn Mantle** — Rare (Unlockable, Level 6 — conditional)
End turn with 10+ block: deal 4 thorns damage when hit.
*Thorns 4 whenever you end a turn heavily shielded. Pairs with Aegis Stone.*

---

#### Poison / Bleed Relics

**Plague Flask** — Uncommon (Starter)
All poison ticks deal +2 extra damage. Poison lasts 1 extra turn.
*Amplifies every poison source in your deck. Hex goes from 9 total to 20 total damage.*

**Bleedstone** — Uncommon (Starter, Level 2)
Bleed you apply stacks +2 higher. Bleed decays 1 turn slower.
*+2 stacks and longer duration on every Bleed application.*

**Ember Core** — Uncommon (Starter, Level 3)
Burn you apply stacks +2 higher. Enemy with 5+ Burn stacks: +20% attack damage.
*Escalating Burn payoff. Doubles as an offensive amplifier at high Burn.*

**Festering Wound** — Rare (Unlockable, Level 13)
When enemy has 3+ poison stacks, all attacks deal +40% damage.
*+40% attack once poison is applied. Potent in any deck with even light poison.*

**Hemorrhage Lens** — Rare (Unlockable, Level 7)
Multi-hit attacks apply 1 Bleed per hit (on subsequent hits).
*Turns multi-hit cards into reliable Bleed applicators.*

**Toxic Bloom** — Uncommon (Unlockable, Level 24)
When an enemy dies from poison, your next attack applies +3 bonus poison.
*Reserved for future multi-enemy encounters. Poison kill feeds the next fight.*

---

#### Burst Relics

**Overflow Gem** — Uncommon (Starter)
When you spend 4+ AP in a single turn, the last card played gets +75% effect.
*Spend big, finish big. Rewards high-AP turns.*

**Surge Capacitor** — Uncommon (Starter, Level 5)
On Knowledge Surge turns: +1 AP and draw 2 extra cards.
*Surge turns become full-power turns. Strong with Time Warp.*

**Capacitor** — Rare (Unlockable, Level 14)
Unused AP at end of turn stores as Charge (max 3). Next turn, gain stored Charge as bonus AP.
*Enables deliberate "save up" turns. Constant: `RELIC_CAPACITOR_MAX_STORED_AP = 3`*

**Double Down** — Rare (Unlockable, Level 15)
Once per encounter: Charge same card twice. Both correct: 5× power. One correct: 1.5×. Both wrong: 0.3×.
*Ultimate high-stakes play. Use on your best card when confident.*

**Quiz Master** — Rare (Unlockable, Level 8 — conditional)
3+ Charge Corrects in one turn: +2 AP next turn.
*Strong turns generate stronger follow-up turns. Snowball engine.*

**Momentum Wheel** — Rare (Unlockable, Level 7 — conditional)
Play 4+ cards in a turn: last card +100% effect.
*The 4th card in a big turn doubles its output.*

**Entropy Engine** — Rare (Unlockable, Level 9 — conditional)
If you play 3+ different card types in one turn: deal 5 damage and gain 5 block.
*Rewards playing varied hands. Free 5 damage + 5 block for diverse turns.*

---

#### Knowledge Relics

**Memory Nexus** — Uncommon (Starter)
When you correctly Charge 3 cards in one encounter (cumulative), draw 2 extra next turn.
*3 correct Charges → a free draw next turn. Snowballs through long encounters.*

**Insight Prism** — Uncommon (Starter)
Wrong Charged answers reveal the correct answer AND next appearance of that fact auto-succeeds.
*Turns failures into future guaranteed wins. Strong in early runs with unfamiliar facts.*

**Scholar's Crown** — Rare (Unlockable, Level 16)
Tier 1 Charged facts get +10% power. Tier 2+ get +40%. Tier 3 auto-Charged get +75%.
*Rewards fact mastery. More mastered facts = larger multipliers.*

**Domain Mastery Sigil** — Rare (Unlockable, Level 18)
If deck has 4+ facts from same domain, all same-domain cards get +30% base damage (even Quick Play).
*Since all curated deck runs concentrate on one domain, this always activates. Effectively a permanent +30% damage.*

**Chronometer** — Rare (Unlockable, Level 6) *(Tradeoff)*
Quiz timer +3 seconds. All Charge multipliers −15%.
*Tradeoff: 3 more seconds to answer at the cost of 15% multiplier. For players who need more time.*

**Soul Jar** — Rare (Unlockable, Level 7)
Every 5 correct Charges stores 1 charge. Spend a charge to auto-succeed a quiz (GUARANTEED button).
*Saved correct answers bank into guaranteed future correct answers.*

**Archive Codex** — Rare (Unlockable, Level 8)
After combat: +1 flat damage per 10 total mastery levels across your deck.
*Mastery across the run translates to stacking flat damage.*

**Deja Vu** — Rare (Unlockable, Level 9)
Turn 1 of each encounter: 1 card from your discard appears in hand at −1 AP cost. Level 15+: 2 cards.
*Opens every fight with a familiar card at a discount.*

**Mind Palace** — Rare (Unlockable, Level 10)
Track correct Charge streak across the run. 1 wrong per 10 freezes instead of resets. At 10/20/30 streak: +3/+6/+10 to all effects.
*Long-run streak relic. Forgives occasional mistakes without collapsing progress.*

**Quick Study** — Common (Starter) *(Tradeoff)*
After 3+ correct Charges in an encounter, preview 1 answer. Wrong answers deal +2 self-damage rest of encounter.
*Tradeoff: knowledge preview once you're on a streak, but wrong answers sting harder.*

**Akashic Record** — Legendary (Unlockable, Level 22)
Tier 2b+ facts: previously-wrong answer is subtly highlighted. Tier 3 auto-Charge multiplier is 1.5× (not 1.2×).
*Uses your mistake history to help you learn. Tier 3 auto-Charges are 25% stronger.*

**Mirror of Knowledge** — Legendary (Unlockable, Level 22)
Once per encounter: after correct Charge, replay card at 1.5× (no quiz, no AP).
*One free card replay per encounter. Use on your most powerful card.*

**Omniscience** — Legendary (Unlockable, Level 20)
3 correct Charges in one turn → the 4th auto-succeeds.
*By the fourth answer, you don't need to answer. Strong with Knowledge Engine builds.*

---

#### Economy Relics

**Gold Magnet** — Common (Starter)
+30% gold from all sources.
*Flat gold multiplier for the entire run.*

**Merchant's Favor** — Common (Starter)
Shops offer 1 additional card and 1 additional relic choice.
*More options every visit. Compounds over a long run.*

**Lucky Coin** — Common (Starter)
Start each encounter with 1 random buff (Empower, +2 block, +1 AP, or Draw 1).
*Random but always useful. Effective as an opener.*

**Scavenger's Eye** — Common (Starter)
See 4 card choices after combat instead of 3.
*+1 card choice on every reward. More likely to find what you want.*

**Tattered Notebook** — Common (Starter, Level 0)
+5 gold on your first correct Charge each encounter.
*Free gold whenever you Charge anything. Stacks up over a full run.*

**Gambler's Token** — Uncommon (Starter, Level 3)
Wrong Charged answers grant +3 gold.
*Converts failures into income. Softens the cost of learning new facts.*

**Knowledge Tax** — Uncommon (Unlockable, Level 5) *(Tradeoff)*
Gain 10 gold per Charge Correct. Charge Correct values −10%.
*Tradeoff: every Charge Correct earns 10 gold at the cost of 10% power.*

---

#### Stat Stick / Sustain Relics

**Vitality Ring** — Common (Starter)
+20 max HP this run.
*Simple and reliable. Applied immediately on pickup.*

**Herbal Pouch** — Common (Starter)
Heal 8 HP after each combat encounter.
*Consistent out-of-combat healing. Scales well in long dungeons.*

**Swift Boots** — Common (Starter)
Draw 6 cards per turn instead of 5.
*+1 card draw every turn. One of the most consistent relics in the pool.*

**Whetstone** — Common (Starter) *(Tradeoff)*
All attacks +3 base damage. All shields −1 block.
*Tradeoff: offense over defense. A real choice.*

**Last Breath** — Uncommon (Starter)
Once per encounter: survive lethal at 1 HP, gain 8 block.
*One free death prevention per encounter. Can turn losing fights.*

**Living Grimoire** — Uncommon (Starter, Level 4)
After combat, if 3+ Charges correct, heal 3 HP.
*Healing tied to Charge performance. Consistent in any Charge-focused build.*

**Pocket Watch** — Uncommon (Starter, Level 1)
Draw 1 extra card on turns 1 and 5 of each encounter.
*Two free extra draws per encounter at predictable timings.*

**Gladiator's Mark** — Uncommon (Starter, Level 2)
Start each encounter with +1 Strength for 3 turns.
*Free Strength opener every fight. Strong in aggressive builds.*

**Thoughtform** — Uncommon (Starter, Level 4)
When ALL cards in a turn are Charged correctly, gain +1 permanent Strength.
*Permanent Strength accumulates through perfect turns. Long-run scaling relic.*

**Red Fang** — Rare (Unlockable, Level 6)
First attack each encounter deals +30% damage.
*Free 30% opener every fight. Simple but reliable.*

**Dragon's Heart** — Rare (Unlockable, Level 12)
Passive: +2 all attacks. Elite kill: +5 max HP + heal 30%. Boss kill: +15 max HP + full heal + random Legendary relic.
*Snowballs elite/boss kills into growing power and HP. Late-run payoff is enormous.*

**Phoenix Feather** — Rare (Unlockable, Level 18)
Once per run: on death, resurrect at 15% HP. All cards auto-Charge free for 1 turn.
*One free resurrection per run. Follow-up turn is free Charges on everything.*

---

#### Offensive / Tactical Relics

**Battle Scars** — Common (Starter, Level 0)
After taking a hit, your next attack deals +3 bonus damage (once per turn).
*Converts incoming damage into increased outgoing damage.*

**Brass Knuckles** — Common (Starter, Level 0)
Every 3rd attack card played deals +6 bonus damage.
*Consistent bonus on heavy attack rotation.*

**Null Shard** — Rare (Unlockable, Level 7)
Chain multipliers are locked at 1.0×. All attacks +25% damage.
*Anti-chain relic. Sacrifices all chain value for flat +25% attack. Use in non-chain decks.*

**Inferno Crown** — Rare (Unlockable, Level 10)
When the enemy has both Burn and Poison, all your damage +30%.
*Dual condition bonus. Pairs Plague Flask + Ember Core for a permanent +30% damage.*

**Bloodletter** — Rare (Unlockable, Level 7 — conditional)
When you take self-damage: next attack +3 damage.
*Synergizes with Volatile Core, Blood Price, Volatile Manuscript, and any cursed relic.*

**Exhaustion Engine** — Rare (Unlockable, Level 9 — conditional)
When a card is exhausted: draw 2 cards.
*Turns any exhaust effect into card advantage. Strong with exhaust-heavy decks.*

---

#### Cursed / Tradeoff Relics

**Blood Price** — Uncommon (Starter) *(Cursed)*
+1 AP per turn. Lose 2 HP per turn.
*Curse: −2 HP per turn. 4 AP is transformative. HP drain creates urgency.*

**Scholar's Gambit** — Rare (Unlockable, Level 20) *(Cursed)*
5 relic slots → 6. Wrong Charged answers deal 3 damage to you.
*Curse: wrong Charges deal 3 self-damage. One extra relic slot.*

**Volatile Manuscript** — Rare (Unlockable, Level 12) *(Cursed)*
All Charge multipliers +0.5×. Every 3rd Charge applies 4 Burn to yourself.
*Curse: every 3rd Charge gives you 4 Burn stacks. Powerful multiplier at a self-damage cost.*

**Paradox Engine** — Legendary (Unlockable, Level 21) *(Cursed)*
Wrong Charges resolve at 0.3× AND deal 5 piercing damage. Gain +1 AP every turn permanently.
*Curse: wrong Charges resolve worse than Quick Play AND deal 5 piercing damage. The +1 AP/turn is not a gift — it is bait.*

**Berserker's Focus** — Uncommon (Unlockable, Level 5) *(Tradeoff)*
Charge surcharge costs 0 AP. Max AP per turn reduced to 2.
*Tradeoff: free Charge surcharges, but capped at 2 AP. Locks you into Charge-heavy play.*

**Glass Lens** — Uncommon (Unlockable, Level 6) *(Tradeoff)*
Charge Correct values +50%. Take 3 damage on Charge Wrong.
*Tradeoff: 3 self-damage per wrong Charge. Enormous upside for accurate players.*

**Pain Conduit** — Uncommon (Unlockable, Level 8) *(Tradeoff)*
When you lose HP: deal that much damage to enemy. Healing is halved.
*Tradeoff: all healing halved. Converts every hit you take into reflected damage.*

**Ritual Blade** — Uncommon (Unlockable, Level 7) *(Tradeoff)*
First card each turn deals double damage. Other cards deal −25%.
*Tradeoff: −25% on all non-first cards. Rewards single big opening plays.*

**Hollow Armor** — Uncommon (Unlockable, Level 9) *(Tradeoff)*
Start each encounter with 20 block. Cannot gain new block.
*Tradeoff: no block gains during combat. Your 20 starting block is all you get.*

**Overclocked Mind** — Uncommon (Unlockable, Level 6) *(Tradeoff)*
Draw 2 extra cards per turn. Discard 2 cards at end of turn.
*Tradeoff: 2 random cards discarded each turn. More options to play, but you can't keep them all.*

**Mnemonic Scar** — Uncommon (Unlockable, Level 10) *(Tradeoff)*
Wrong on a previously-correct fact: resolves at CC power. Wrong on a new fact: take 5 damage.
*Tradeoff: wrong answers on unknown facts deal 5 self-damage. Rewards focusing on mastered facts.*

---

> **Removed relics (historical note):** Echo Lens, Echo Chamber, Phantom Limb were removed when the Echo system was removed. Combo Ring was removed with the combo system.

#### Relic Trigger Reference

| Trigger | Fires When |
|---------|-----------|
| `permanent` | Always active (passive stat change) |
| `on_run_start` | Once at the start of a run |
| `on_encounter_start` | At the start of each combat encounter |
| `on_encounter_end` | After combat ends |
| `on_turn_start` | At the start of each turn |
| `on_turn_end` | At the end of each turn |
| `on_card_play` | Whenever any card is played |
| `on_attack` | Whenever an attack card is played |
| `on_block` | Whenever a shield card is played |
| `on_charge_correct` | Charged quiz answered correctly |
| `on_charge_wrong` | Charged quiz answered incorrectly |
| `on_damage_taken` | Player takes damage |
| `on_hp_loss` | Player loses any HP (attacks, self-damage, cursed relic drain) |
| `on_lethal` | Player would be reduced to 0 HP |
| `on_chain_complete` | A Knowledge Chain finishes |
| `on_surge_start` | A Knowledge Surge turn begins |
| `on_multi_hit` | A multi-hit attack resolves |
| `on_exhaust` | A card is moved to the exhaust pile |
| `on_discard` | A card is discarded from hand |
| `on_chain_break` | An active chain breaks |
| `on_elite_kill` | An elite enemy is defeated |
| `on_perfect_turn` | All cards in a turn Charged correctly |

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
- **Mastery Ascension:** Scholar's Crown + 5 mastery-5 card slots in deck → flat damage bonus per mastered card slot
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
| Mastery 5 card | Gold glow aura, quiz uses hardest variant, gives highest multiplier |

### Enemy Intent Display

Enemy intent icon and damage preview shown above enemy sprite at all times. Three types:
- **Attack:** Sword icon + damage value
- **Defend:** Shield icon + block value
- **Buff:** Star icon + effect description

### Health Management Design Rules

**Healing must be scarce and strategic — never automatic or generous.**

- **Post-encounter healing vials** appear on the reward screen as small health potions (2-6% of max HP). They do NOT always appear — probability-based, not guaranteed.
- **POST_ENCOUNTER_HEAL_PCT is 7%** — passive recovery between encounters to sustain longer fights. Increased from 3% to support higher enemy HP (AR-259 rebalance). NOT a full heal.
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
- **First correct answer on a new fact:** "NEW!" text burst + full celebration (first time correctly answering a fact in the run)

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
| SFX Playback Engine | `src/services/audioService.ts` | File-first playback — 229 `.ogg` CC0 files in `public/assets/audio/sfx/`; Web Audio synthesis fallback for every SoundName |
| Card Audio Manager | `src/services/cardAudioManager.ts` | High-level cue layer (141 cues mapped to SoundNames) |
| Ambient Audio Service | `src/services/ambientAudioService.ts` | 15 layered atmosphere recipes using 33 looping `.ogg` files; crossfading, quiz ducking, music coexistence, boss overlay |
| BGM Service | `src/services/musicService.ts` | BGM playback — 43 tracks total (20 epic, 20 quiet, 3 stings); crossfade, shuffle, spectrogram visualiser |
| Settings UI | `src/ui/components/SettingsPanel.svelte` | SFX + Music volume sliders with localStorage persistence |

### Implementation Status Summary

| Priority | Count | Description | Status |
|----------|-------|-------------|--------|
| P0 (Ship-blocking) | 31 | Core feel — combat, encounters, run lifecycle, UI basics | DONE (file SFX) |
| P1 (Core Feel) | 100 | Status effects, chains, enemies, transitions | DONE (file SFX + ambient) |
| P2 (Polish) | 73 | UI interactions, NPC sounds, ambient details | Mostly wired |
| P3 (Nice-to-have) | 26 | Hover sounds, scroll feedback, environmental micro-detail | Partially wired |
| **Total** | **234** | **182 trigger calls across 32 files** | **SFX complete (229 files), ambient complete (33 loops), BGM 43 tracks** |

### Background Music (BGM)

43 BGM tracks are implemented across three modes. Files live in `public/assets/audio/music/` as `.mp3`.

| Mode | Count | Category | File path |
|------|-------|----------|-----------|
| EPIC | 20 | High-energy combat | `public/assets/audio/music/epic/*.mp3` |
| QUIET | 20 | Lo-fi ambient / exploration | `public/assets/audio/music/quiet/*.mp3` |
| Stings | 3 | One-shots (victory, defeat, boss-intro) | `public/assets/audio/music/stings/*.mp3` |

The user toggles EPIC/QUIET via `MusicWidget.svelte`. Stings fire from `musicService` at specific lifecycle events. Playback details (crossfade, shuffle, LRU cache, spectrogram) documented in `docs/architecture/services/platform-audio.md`.

### SFX Asset Sources

229 CC0 SFX files sourced from OpenGameArt and Kenney.nl are now in `public/assets/audio/sfx/` organised by folder (combat, status, quiz, turn, surge, relic, encounter, map, hub, shop, rest, reward, mystery, run, ui, reveal, mastery, keeper, transition, tutorial, progression, legacy). Synthesis fallbacks remain for every SoundName — the Sonniss GDC 2026 Bundle path (originally planned in AR-228) was superseded by this CC0 sourcing pass.

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

- **Slow Reader mode (Settings):** +3s to all invisible timer thresholds (no visible timer UI)
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

## 21. Daily Expedition (Per-Domain Trivia Leaderboards)

Daily Expeditions use **Trivia Mode mechanics** (no repeat facts, broad pool) with a shared seed so all players face identical questions. Each domain has its own Daily Expedition.

| Expedition | Pool Source | Audience |
|------------|-----------|----------|
| Geography Daily | All geography facts | "Best geographer today" |
| History Daily | All history facts | "Best historian today" |
| Science Daily | All science facts | "Best scientist today" |
| Japanese N5 Daily | Japanese N5 vocabulary | "Best Japanese student today" |
| ... (one per major domain) | ... | ... |
| **Ultimate Daily** | **ALL domains mixed** | "Best general knowledge today" |

**Scoring formula:** `score = correctAnswers × speedBonus × depthReached × chainBonus`

Where `speedBonus` is derived from the invisible internal timer — faster correct answers score higher.

**Rules:**
- One attempt per player per expedition per day
- Same seed = same enemy sequence, same card draws, same fact order for all players
- Timed via the invisible internal timer — response speed is a major scoring component
- Results submitted to per-domain leaderboard with `metadata.dateKey` (`YYYY-MM-DD`)
- Rewards: participation badge, bonus for top 10%/25%/50% per domain

Why critical: Wordle's entire viral success = one-a-day appointment. STS daily climb = most-played mode. "Did you beat today's History Expedition?" = organic marketing with genuine educational motivation.

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

### Run Pool (v3 — Single Curated Deck)

**100% from the selected curated deck.** The old multi-domain mix (30% primary + 25% secondary + 45% review queue) is replaced.

At run start, the selected deck's full fact pool is loaded. In-run FSRS state is seeded from global FSRS:
- Facts with low global stability (< 2 days) start with `wrongCount: 1` — treated as if already struggling
- Facts with high global stability (> 30 days) start with `correctCount: 1` — treated as somewhat known
- Everything else starts fresh

### What Global FSRS Still Does

- **Long-term knowledge tracking:** Every quiz result (correct/wrong, response time) updates global FSRS state for that fact
- **Run pool seeding:** Facts with low global stability are flagged as "needs practice" when initializing in-run state
- **Knowledge visualization:** Powers the cross-run knowledge map showing mastery across domains
- **Deck difficulty estimation:** "You know 73% of US Presidents well"

### What Global FSRS No Longer Does

- Does NOT drive card tier for combat power (that is now card slot mastery 0–5)
- Does NOT trigger Mastery Trials (removed)
- Does NOT determine auto-charge eligibility (removed)
- Does NOT set question format (that is now card mastery + deck templates)

### All Quiz Moments Update FSRS

Every quiz event — Charged plays, boss Quiz Phases, shop haggling, Rest Site Study — updates FSRS state for the tested fact:
- Difficulty (1–10)
- Stability (days)
- Retrievability (0–1)
- consecutiveCorrect
- nextReviewDate

Confusion matrix records also update on every wrong answer.

### New Player Funness Bias

Runs 0–9: funScore ≥ 7 facts are 2× more likely to appear per difficulty tier within a deck. Linear decay to zero over runs 10–99. Run 100+: no bias.

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

## 23.4. Two Game Modes: Trivia Dungeon vs Study Temple

The game ships with two distinct modes selectable at run start. They share the same combat engine but use completely separate fact pools with zero overlap.

| Aspect | Trivia Dungeon | Study Temple |
|--------|---------------|--------------|
| Fact source | Broad general-knowledge DB (`public/facts.db`) | Curated deck files (`data/decks/*.json`) |
| Pool size | 200+ facts, one or mixed domains | 30–2500+ facts per deck (vocab decks are large) |
| Repetition | Each fact at most once per run | FSRS-weighted repetition across encounters |
| Distractors | Pool-based, NOT confusion-adaptive | Pool-based, confusion-matrix weighted |
| In-run FSRS | Minimal (seen/unseen tracking only) | Full adaptive weighting |
| Learning intent | Broad exposure | Deep mastery of focused topic |
| Vocabulary content | None — all vocabulary lives exclusively here → | ALL vocab decks (Japanese, Korean, Spanish…) |
| FSRS update | Yes — updates global FSRS | Yes — updates global FSRS |

**Trivia Dungeon** is the casual entry point. **Study Temple** is the focused study mode for players who want to actually learn something. All curated decks (including all 8 language packs) are Study Temple only.

---

## 23.5. Dynamic Fact Assignment (Study Temple)

Facts are assigned to cards at **charge-commit time**, not draw time. Cards in hand carry mechanic + chain theme + mastery only — no quiz content is visible until the player commits to a Charge.

**Fact selection algorithm (`selectFactForCharge()`):**
1. Determine the card's chain theme sub-pool (knowledge decks) or full deck pool (vocabulary decks)
2. Filter by cooldown: facts seen in the last 3 encounters are excluded
3. Apply in-run FSRS weighting:
   - Struggling facts (wrong this run) → 3× weight
   - Known facts (correct multiple times this run) → 0.4× weight
   - At mastery 3+: struggling facts boosted further
4. Return a single fact via weighted random draw

**InRunFactState** (per-run, seeded from global FSRS at run start):

| Field | Purpose |
|-------|---------|
| `correctCount` | Correct answers this run |
| `wrongCount` | Wrong answers this run (struggling facts: start at 1 if global stability < 2d) |
| `lastSeenEncounter` | For cooldown enforcement (3-encounter window) |
| `confusedWith[]` | Facts chosen instead of this one (builds confusion pairs) |
| `averageResponseTimeMs` | Speed tracking |
| `streak` | Current consecutive-correct streak |

Facts with global FSRS stability > 30 days start with `correctCount: 1` (known). Facts with stability < 2 days start with `wrongCount: 1` (needs practice). Everything else starts fresh.

**Same-hand dedup:** No two cards in the same 5-card hand share the same fact (exact ID, base key, and root ID).

---

## 23.51. Pool-Based Adaptive Distractors (Study Temple)

Distractors are selected at charge time from the deck's `answerTypePools`. Distractor count is mastery-driven: 2 at M0, 3 at M1–2, 4 at M3–5.

**Selection priority:**
1. **Synonym group exclusion (mandatory first):** Any fact in the same `synonymGroupId` is excluded entirely.
2. **Known confusions:** Facts the player has previously confused with the correct answer (from the cross-run confusion matrix). Highest educational value.
3. **In-run struggles:** Facts the player answered wrong this run (`wrongCount > 0`).
4. **Same pool, similar difficulty:** Other facts in the same `answerTypePoolId` at ±1 difficulty.
5. **Same pool, any difficulty:** Remaining pool fill.

**Confusion matrix (persistent across runs):** Tracks "when asked about X, the player chose Y." These pairs are stored per-player and prioritized as distractors whenever X is the correct answer. Makes each player's questions uniquely challenging relative to their personal knowledge gaps. Updated on every wrong answer in both combat and non-combat quiz contexts.

---

## 23.52. Deck-Specific Question Templates (Study Temple)

Each deck defines its own `questionTemplates` array. Templates are gated by card mastery level and selected via a weighted algorithm that considers difficulty match, variety (avoids repeating the same template), and mastery.

**Vocabulary deck standard templates** (from `vocabularyTemplates.ts`):

| Template ID | Example | Available From |
|-------------|---------|---------------|
| `forward` | "What does '食べる' mean?" → "to eat" | Mastery 0+ |
| `reading` | "What is the reading of '食べる'?" → "たべる" | Mastery 1+ |
| `reverse` | "How do you say 'to eat' in Japanese?" → "食べる" | Mastery 2+ |
| `synonym_pick` | "Which word is closest in meaning to '食べる'?" | Mastery 3+ |
| `definition_match` | Full definition → match the word | Mastery 3+ |

Templates are selected via `questionTemplateSelector.ts` which returns a rendered `QuizData` object (question text + correct answer + distractor slots).

---

## 23.53. Non-Combat Quiz Contexts (Study Temple)

Shop haggling, rest-site study, boss quiz phases, and mystery event quizzes all trigger quizzes outside combat. In Study Temple, these use the full deck pool (not filtered by chain theme):

- Fact selection ignores chain theme and samples from the full deck pool, still cooldown-filtered and FSRS-weighted.
- Distractors are still pool-based and confusion-matrix weighted.
- Both in-run FSRS (`InRunFactState`) and global FSRS are updated after the result.
- Confusion pairs recorded to the run's `confusionEntries[]`.

Implemented in `nonCombatQuizSelector.ts`. Trivia Dungeon non-combat quizzes use the existing `factsDB` pool, unaffected.

For full spec, see `docs/RESEARCH/DECKBUILDER.md`.

---

## 23.54. Procedural Math Practice (Study Temple)

Math is the only domain where content is generated at runtime rather than drawn from a curated fact database. Problems are infinite in variety and always unique — there is no "pool" to exhaust.

### Concept

Study Temple adds a **Math tab** alongside the existing domain tabs. Players select a math deck (Arithmetic, Mental Math) and optionally a sub-deck (e.g., Addition only). Practice sessions are open-ended — the player controls when to stop. Session flow matches the curated study session UX without modification.

### Skill-Based FSRS Tracking

Each **skill** (e.g., Two-Digit Addition) functions as the tracked unit instead of a fact. `PlayerSkillState` has the same FSRS fields as `PlayerFactState`, so the existing FSRS scheduler and tier derivation are reused without modification.

Skills advance through the same four tiers as facts (1 → 2a → 2b → 3), with tier determining the difficulty envelope for generated problems rather than distractor difficulty. A player who has mastered Tier 1 addition (single-digit) automatically receives two-digit problems at Tier 2a.

Skill states persist in `PlayerSave.skillStates[]` across all sessions, separate from in-run progression.

### Adaptive Difficulty

Difficulty is controlled by the player's FSRS tier for each skill:

| Tier | Threshold | Example: Addition |
|------|-----------|------------------|
| 1 | New / early learning | 1–20 + 1–20 |
| 2a | stability ≥ 2, consecutiveCorrect ≥ 2 | 10–99 + 10–99 |
| 2b | stability ≥ 5, consecutiveCorrect ≥ 3 | 100–999 + 100–999 |
| 3 | stability ≥ 10, consecutiveCorrect ≥ 4, mastery trial passed | 1000–9999 + 1000–9999 |

### Phase 1 Scope

Phase 1 ships two decks, all multiple-choice (5 options):

- **Arithmetic** — Addition, Subtraction, Multiplication, Division, Mixed Operations (5 skills)
- **Mental Math** — Percentages, Fractions & Decimals, Estimation (square roots), Order of Operations / PEMDAS (4 skills)

Phase 1.5 adds free-text typed input. Later phases add Algebra, CS/Logic, Geometry, and Statistics.

For full implementation details, see `docs/mechanics/procedural-math.md`.

---

## 23.5. Trivia Mode

A separate mode where instead of a focused curated deck, facts are drawn from a broad domain pool with no repetition within a run. Every fact appears at most ONCE.

| Aspect | Standard Mode | Trivia Mode |
|--------|--------------|-------------|
| Deck | Curated, 30-50+ facts, one domain | Broad pool, 200+ facts, one or mixed domains |
| Repetition | Facts repeat across encounters (FSRS-weighted) | Each fact appears ONCE per run, never repeated |
| Distractors | Pool-based, confusion-adaptive | Pool-based but NOT confusion-adaptive (not enough repetition to build confusion data) |
| Fact-card binding | Dynamic at charge time | Dynamic at charge time (same) |
| In-run FSRS | Active (drives adaptive selection) | Minimal (just tracks seen/unseen) |
| Learning intent | Deep mastery of focused topic | Broad exposure to many facts |
| Chain themes | Deck-specific themed sub-groups | Generic or domain-based |
| FSRS update | Yes — results update global FSRS | Yes — results still update global FSRS |

**When to use Trivia Mode:**
- Casual sessions where variety is more fun than depth
- Exploring a new domain before committing to a curated deck
- Players who find focused repetition tedious
- Daily Expeditions (see §21)

---

## 24. Deck Selection (3-Screen System)

Players access deck selection via the hub's "Start Run" doorway, which leads to a **hero mode selector** (DeckSelectionHub) offering two paths:

**Trivia Dungeon ("The Armory")** — combat roguelite mode:
- Horizontal domain strip with toggleable domain cards (All, Science, History, Geography, etc.)
- Loadout cards per selected domain with subcategory chip filters
- Footer status bar with domain count and Start Run button
- Search bar filters domains and subcategories

**Study Temple ("The Library")** — focused learning mode:
- Category tabs (All, Languages, History, Science, Geography, etc.)
- 4-column responsive deck tile grid (DeckTileV2) with gradient art, progress bars, status badges
- Click a tile to open DeckDetailModal (centered, 640px) with sub-deck selection and Start Study Run
- Search, sort (A-Z, progress, fact count), and filter (in-progress, not-started, mastered) controls
- Custom playlist bar for mixing study decks
- Language tab groups vocabulary decks by language with LanguageGroupHeader

The selected deck's chain themes (knowledge decks) or generic chain types (vocabulary decks) are set for the run. Favorite decks can be bookmarked for quick access.

**Old Study Presets** (user-defined mixes of domains and subcategories) are replaced by curated deck selection. Saved presets become "favorite decks" — quick links to frequently played curated decks.

**Mixed Deck option (future consideration):** For advanced players who want variety, a "Mixed Deck" option could combine 2–3 curated decks — but only if their answer type pools don't overlap in confusing ways. NOT for initial implementation.

---

## 25. Monetization

### Mobile (F2P + Subscription)
- **Free:** All gameplay content. Full run loop. 2-3 base knowledge domains. No time gates. No pay-to-win.
- **Scholar Pass ($4.99/mo):** All domains, languages, study decks, cosmetics, multiplayer (future), daily challenges (future).

### Steam (Premium + DLC)
| Product | Price | Content |
|---------|-------|---------|
| Base Game (Early Access) | $9.99 | All curated decks included free, full roguelike, all card mechanics, all relics |
| Base Game (1.0 Release) | $14.99 | Same + post-EA polish + more curated decks |
| Language DLC (each) | $4.99 | Japanese N5-N3, Korean A1-B1, Spanish A1-B1, etc. |
| Curated Study Packs | $2.99 | SAT Prep, Medical Terminology, etc. |
| Cosmetic DLC | $1.99-3.99 | Card backs, particles, chain theme skins |

**All curated decks are free on Steam purchase.** Mobile (F2P) gates some decks behind Scholar Pass subscription. Core gameplay decks always free on mobile.

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
- Facts where global FSRS tier advanced (long-term tracking milestone)
- Card slots that reached mastery 5 this run

### Grade Badge

Displayed prominently on the Run End screen for `defeat` and `victory` results (hidden for `retreat`). A circular badge with a glowing border pops in 400ms after the screen loads, followed by a flavor text line.

| Grade | Condition | Color | Flavor |
|-------|-----------|-------|--------|
| S | Victory (defeated The Final Lesson) | Gold `#FFD700` | "Knowledge is power!" |
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

Ascension is the difficulty scaling system for experienced players. Each of 20 levels adds a permanent challenge modifier AND a compensating buff, creating interesting risk/reward tradeoffs. All modifiers are cumulative—Ascension 10 includes all challenges and buffs from levels 1–9.

Unlocks after first successful run completion (reach Act 3+ and retreat, or defeat The Final Lesson).

### Ascension Level Table

| Level | Name | Challenge | Buff |
|-------|------|-----------|------|
| 1 | First Trial | +1 elite per segment | Choose 1 of 3 starter relics |
| 2 | Aggressive Foes | Enemies +10% damage | +1 AP on first turn of each encounter |
| 3 | Scarce Healing | Rest heals 25% instead of 30% | Free card removal at rest |
| 4 | Quick Thinking | Timer −1s on all questions | Start with a random uncommon card |
| 5 | Lean Start | Start with 12 cards | One free card removal per shop visit |
| 6 | No Escape | Cannot flee encounters | Heal 5 HP on 3+ combo |
| 7 | Harsh Grading | Close distractors more common | Charged correct +15% damage |
| 8 | Elite Surge | Mini-bosses gain boss-tier attacks | Mini-boss victories always drop a relic |
| 9 | Undying Foes | Enemies regenerate 2 HP/turn | Start encounters with 3 shield |
| 10 | Cursed Start | Start with a Curse card in deck | Choose a 2nd starter relic + 1 free relic reroll per boss |
| 11 | Slim Pickings | Boss relics reduced to 2 choices | Relics trigger +50% more |
| 12 | Deep Knowledge | Tier 1 cards use 4-option MCQ | Tier 1 charged correct +20% damage |
| 13 | Fragile | Player max HP reduced to 80 | Start with Vitality Ring (+20 HP, takes slot) |
| 14 | Combo Breaker | Combo resets each turn | Perfect turns grant +1 AP next turn |
| 15 | Boss Rush | Bosses +25% HP | Boss defeat fully heals player |
| 16 | No Echo | Echo mechanic disabled | Discarding a card grants 1 shield |
| 17 | Scholar's Burden | Wrong answers deal 3 self-damage | Correct answers heal 1 HP |
| 18 | Minimalist | Start with 10 cards | Choose starting hand each encounter |
| 19 | True Test | All questions use hard formats | Charge plays cost 0 extra AP |
| 20 | Heart of the Archive | Final boss gains second phase | Start with 3 relics (choose from 7) |

### Design Philosophy

Each ascension level pairs a difficulty increase with a strategic benefit:

- **Levels 1–5:** Gentle difficulty ramp with strong compensations. Early buffs establish core strategies (starter relic choice, card removal, AP acceleration).
- **Levels 6–10:** Significant mechanical changes. Fleeing becomes impossible; regen and curses introduce persistent threats. Mid-tier buffs (relic guarantees, shield generation, combo healing) create adaptive playstyles.
- **Levels 11–15:** Deep system modifications. Relic pools shrink; question formats shift to 4-option; HP scaling changes. Buffs become specific to question difficulty (Tier 1 boosts, perfect turn synergy).
- **Levels 16–20:** Extreme challenge with powerful but narrow compensations. Echo disabled, damage self-infliction, strict hand-size constraints. Highest-tier buffs unlock (hand selection, free charging, three-relic starts).

### Implementation

- **File:** `src/services/ascension.ts`
- **Modifiers:** Applied via `getAscensionModifiers(level)` — all challenges and buffs are cumulative
- **Rule lookup:** `getAscensionRule(level)` returns the level name and description for UI display
- **Enemy adjustments:** `applyAscensionEnemyTemplateAdjustments()` handles mini-boss boss-tier attacks and final boss second phase
- **Max level:** `MAX_ASCENSION_LEVEL = 20`

---

## 28. Fact Database

### Scale

**The original 20,000+ general knowledge fact database has been deleted.** A smaller regenerated set of ~3,000 general domain facts exists. These serve as the base pool for Trivia Mode and the "Ultimate Daily" general knowledge expedition.

**Vocabulary facts (all languages) are intact.** Japanese (13,073), Korean (11,400), Chinese (13,472), and European languages. These must be restructured into the curated deck format — see §23 data migration note.

All new curated knowledge deck facts are created using the Deck Master skill (see Appendix).

### Curated Deck Fact Schema

Each fact in a curated deck contains: `id`, `correctAnswer`, `acceptableAlternatives[]`, `synonymGroupId?`, `chainThemeId`, `answerTypePoolId`, `difficulty` (1–5), `funScore` (1–10), FSRS fields, plus deck-specific fields (e.g., `japanese_word`, `reading`, `explanation` for vocabulary).

The old flat `distractors[]` field is removed — distractors are now selected at charge time from the answer type pool (pool-based adaptive selection), not pre-stored.

### Domain List (16 Knowledge Domains)

| Domain | Example Decks |
|--------|--------------|
| Geography | World Countries & Capitals, World Cities, Topography |
| History | US Presidents, World War II, Ancient Rome |
| Science | Periodic Table, Human Anatomy |
| Mathematics | Algebra Fundamentals, Geometry (programmatically generated) |
| Literature | Classic Literature |
| Art & Music | Art History, Classical Music |
| Technology | Computer Science Fundamentals |
| Nature | Animal Kingdom, Plants & Ecosystems |
| Culture & Society | World Religions, Major Mythologies |
| Philosophy | Great Philosophers, Schools of Thought |
| Food & Drink | World Cuisines |
| Sports | Olympics Records, Major Sports Rules |
| Film & TV | Classic Cinema |
| Languages (JLPT, TOPIK, HSK, CEFR) | Japanese N5, Korean TOPIK 1, Spanish A1-A2 |
| Mythology | Greek Mythology, Norse Mythology |
| Space | Solar System & Beyond |

### Distractor Generation (UPDATED RULE — v3)

**Distractors MUST come from the deck's own fact pool** (pool-based adaptive selection). The old rule "NEVER generate distractors from database pools" is reversed.

**Why:** Pool-based adaptive distractors are strictly superior to LLM-generated ones. They're contextually accurate (same answer format as the correct answer), adaptively difficult (weighted by confusion matrix), and don't require an LLM pipeline.

**Exception:** Bracket-number facts (years, counts, distances, etc.) still use runtime numeric generation rather than pool-based selection.

**LLM distractor generation is no longer required.** Post-generation validation (checking that a generated distractor doesn't accidentally match another fact's correct answer) still applies where relevant.

### Age Gating

Mature content (violence in history, adult literature themes) uses `ageGated: true` flag. Age gate lifted at first run completion if player confirmed adult, or skipped via `btn-age-adult` in onboarding.

---

## 29. Content Quality Pipeline

### Mandatory Processing (v3)

All curated deck facts must pass through:
1. **Fact generation** with `correctAnswer` + `acceptableAlternatives[]` fully populated
2. **Synonym group computation** — run `buildSynonymGroups()` algorithm (§3.5). MANDATORY for all decks before shipping
3. **Answer type pool assignment** — every fact assigned to an `answerTypePoolId`
4. **Pool size validation** — every pool must have ≥5 facts after synonym group exclusions
5. **Chain theme assignment** — every fact assigned to a `chainThemeId`; every theme must have ≥8 facts
6. **Difficulty rating** (1–5) and **funScore** (1–10) assigned
7. **QA gates:** question brevity (max 15 words), answer brevity (max 5 words/30 chars), no ambiguous answers (two facts in same pool with identical correct answers that aren't in the same synonym group)

### Distractor Pipeline (Pool-Based)

**No LLM distractor generation required.** Distractors are selected at charge time from the answer type pool, weighted by confusion matrix. This is strictly superior to pre-generated distractors.

**Exception — bracket-number facts:** Runtime numeric generation for years, counts, measurements. The `{8848}` bracket format triggers the numeric generation system.

### Quality Requirements Per Deck

- Every answer type pool ≥5 facts (after synonym exclusions)
- Every chain theme ≥8 facts (for knowledge decks)
- Total facts ≥30 (minimum) / 50+ (target)
- Synonym groups fully computed
- No duplicate answers within a pool
- `funScore` assigned (≥7 facts get funness bias in early runs)
- `visualization_description` for card art generation (optional but recommended)

### Confusion Matrix as Quality Signal

The confusion matrix (persisted across runs in player data) serves as an ongoing quality signal:
- If many players consistently confuse fact A with fact B, that confusion is a high-quality distractor pairing
- Confusion data surfaces real pedagogical blind spots, not just plausible-looking wrong answers
- Over time, the confusion matrix becomes the primary distractor source for well-played decks

---

## 29.5. Math Decks (Runtime Generation)

Math decks are unique: questions and answers are **generated from template rules at runtime** rather than stored as static facts. At charge time, the seed + encounter number + charge count produce deterministic coefficients.

```typescript
interface MathTemplate {
  id: string;                    // e.g., "linear_equation_1"
  category: string;              // "algebra", "geometry", "calculus"
  questionFormat: string;        // "Solve for x: {a}x + {b} = {c}"
  parameters: ParameterRange[];  // [{name: "a", min: 1, max: 10}, ...]
  solutionFunction: string;      // "(c - b) / a" — evaluates to correct answer
  commonMistakes: MistakeRule[]; // Distractor generation rules
  difficulty: number;            // 1-5
}

interface MistakeRule {
  label: string;                 // "sign_error", "forgot_distribute", "off_by_one"
  formula: string;               // "(c + b) / a" — the wrong answer a student would get
  weight: number;                // How commonly this mistake occurs
}
```

**Difficulty-level-driven consistency:**

| Card Mastery | Template Difficulty Pool | Parameter Range |
|-------------|------------------------|-----------------|
| 0-1 | Difficulty 1-2 (basic operations) | Small numbers (1-20) |
| 2-3 | Difficulty 2-3 (multi-step) | Medium numbers (1-100) |
| 4-5 | Difficulty 3-5 (complex, multi-variable) | Large numbers, decimals, negatives |

**Distractor generation for math:** Instead of pool-based distractors, math uses **common mistake distractors** — the wrong answers a real student would compute:

| Problem | Correct | Sign Error | Forgot Distribute | Off-by-One |
|---------|---------|-----------|-------------------|------------|
| Solve: 3x + 7 = 22 | 5 | -5 | 10 | 4 or 6 |
| d/dx of x³ | 3x² | x³ (no change) | 3x (wrong exponent) | 2x² |

**Confusion matrix for math:** Tracks mistake *types* rather than specific fact confusions. If the player consistently makes sign errors, the system generates sign-error distractors more frequently.

**Seed determinism:** Same run seed + encounter + charge count = same problem every time. Enables seeded Daily Expeditions for math where all players solve the same problems.

**Chain themes for math:** Group by operation type (Linear Equations, Quadratic Equations, Systems, Inequalities, etc.).

---

## 29.6. Deck Roadmap (Living Todo List)

Priority curated decks to build, organized by domain.

### Tier 1 — Launch Priority (Build First)

| Domain | Deck Name | Estimated Facts | Notes |
|--------|-----------|-----------------|-------|
| Geography | World Countries & Capitals | 196 | Flags, capitals, continents, populations. Chain themes by continent. |
| Geography | World Cities | 80+ | Major cities, countries, landmarks. |
| History | US Presidents | 46 | Names, years, parties, home states. Chain themes by era. |
| History | World War II | 60+ | Events, dates, figures, battles, countries. |
| Science | Periodic Table | 118 | Elements, symbols, atomic numbers, groups. Chain by element group. |
| Science | Human Anatomy | 50+ | Organs, bones, systems, functions. Chain by body system. |
| Language | Japanese N5 Vocabulary | 822 | Restructure from existing programmatic data. |
| Language | Japanese N4 Vocabulary | 774 | Restructure from existing programmatic data. |

### Tier 2 — High Demand

| Domain | Deck Name | Estimated Facts | Notes |
|--------|-----------|-----------------|-------|
| Math | Algebra Fundamentals | 50+ | **Programmatically generated.** Bracket-number heavy. |
| Math | Geometry | 50+ | **Programmatically generated.** Formulas, theorems, angle rules. |
| Math | Calculus | 50+ | **Programmatically generated.** Derivatives, integrals, rules. |
| Math | Statistics & Probability | 40+ | **Programmatically generated.** Distributions, formulas. |
| History | Ancient Rome | 50+ | Emperors, events, dates, locations. |
| History | Ancient Greece | 50+ | Philosophers, events, city-states, mythology. |
| History | AP US History | 80+ | Targeted at AP exam prep. Events, amendments, court cases. |
| Biology | AP Biology | 363 | **LIVE** — CED 2025-26 aligned, all 8 units. Exam tags, 8 chain themes, 13 answer pools. See `docs/content/deck-system.md`. |
| Geography | Topography | 60+ | Mountains, rivers, deserts, lakes. Measurements use bracket numbers. |
| Geography | World Flags | 196 | **Image-based questions.** Flag recognition → country name. |

### Tier 3 — Community Interest

| Domain | Deck Name | Estimated Facts | Notes |
|--------|-----------|-----------------|-------|
| Literature | Classic Literature | 60+ | Authors, titles, characters, quotes. |
| Art | Art History | 50+ | Artists, movements, periods, famous works. |
| Music | Classical Music | 40+ | Composers, periods, famous works. |
| Space | Solar System & Beyond | 50+ | Planets, moons, missions, distances. |
| Food | World Cuisines | 50+ | Dishes, countries of origin, ingredients. |
| Technology | Computer Science Fundamentals | 50+ | Algorithms, data structures, concepts. |
| Language | Korean TOPIK 1 | ~800 | Restructure from existing data. |
| Language | Chinese HSK 1-2 | ~600 | Restructure from existing data. |
| Language | Spanish A1-A2 | ~500 | Restructure from existing data. |

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

Timing: After defeating The Algorithm (Act 2 boss, first victory feeling) or after completing a Mastery Trial (emotional high). Never on failure, never mid-run.

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

1. **Curated deck library with quality facts** — structured deck design (answer type pools, chain themes, synonym groups) takes domain expertise to build correctly; rushed databases break the distractor system
2. **FSRS integration powering the knowledge visualization** — facts get stronger as players learn them; the knowledge map shows temporal decay and mastery across all decks
3. **Confusion matrix personalization** — the longer a player plays, the more their questions are uniquely calibrated to their personal knowledge gaps. No other educational game provides this level of personalized adversarial distractor generation
4. **Pool-based adaptive distractors** — each player faces the opponents they have personally confused, not generic wrong answers; this is not replicable without the confusion history
5. **Chains tied to deck-specific thematic sub-groups** — "Civil War Era" vs "Founding Fathers" chains have educational meaning; generic chain colors (Obsidian/Crimson/etc.) for vocabulary decks maintain pure mechanical strategy
6. **Knowledge Surge rhythm** — turns spaced repetition into gameplay rhythm
7. **Quiz as amplifier, not gate** — requires a fundamental rethink vs. "chocolate-covered broccoli" designs

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
| `struggling` | 40% declining | slow | random | Stress-tests Canary + confusion matrix accumulation |
| `impatient` | 70% volatile | normal | random, 25% skip | Tests skip/engagement patterns |

### Playtest Dashboard

- Start command: `npm run playtest:dashboard`
- URL: `http://localhost:5175/playtest`
- Campaign runner: `npm run playtest:campaign -- --runs 200 --parallel 5 --campaign-id <id>`

---

## 35. Future Todo (Post-Launch)

- **Knowledge Tree UI:** Dedicated tree-view progression screen visualizing `categoryL2` mastery across all domains, with zoom levels (forest → branch → leaf), overdue-state visual cues.
- **Extended Language Content:** Japanese Grammar deck (JLPT levels), Chinese Hanzi deck, Korean TOPIK grammar, European languages (ES/FR/DE) grammar decks.
- **Mastery Skins (Animated Card Backs):** Cards with FSRS Tier 2a+ (stability ≥ 2d) unlock looping animated card backs (WAN2.1 video diffusion). Card back reverts to static if FSRS retrievability drops below learned threshold — knowledge decay visualized.
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
| Charge correct multiplier | 2.5× (mastery 0), scaling up to 4.0× (mastery 5) |
| Charge wrong multiplier | 0.6× (mastery 0), 0.7× (mastery 1+) |
| Charge AP surcharge | +1 AP (0 during Surge, 0 during Chain Momentum) |
| Tier 3 auto-Charge | REMOVED — every charge always presents a quiz |
| Surge frequency | Every 4th turn, run-persistent counter (global turns 2, 6, 10, 14...) |
| Free First Charge | REMOVED — all charges cost normal AP surcharge |
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
| FSRS Tier 2a threshold | stability ≥ 2d, consecutiveCorrect ≥ 2 (long-term tracking only, decoupled from combat) |
| FSRS Tier 2b threshold | stability ≥ 5d, consecutiveCorrect ≥ 3 (long-term tracking only) |
| FSRS Tier 3 threshold | stability ≥ 10d, consecutiveCorrect ≥ 4, passedMasteryTrial (tracking only; no auto-charge) |
| Mastery Trial | REMOVED — no Tier 3 auto-charge to graduate into |
| Player start HP | 120 |
| Enemy pity timer (relics) | 4 consecutive Common drops → guaranteed Uncommon+ |

---

## Appendix: Agent Skills Catalog

> Complete list of Claude agent capabilities. For detailed descriptions, see `docs/CLAUDE_CAPABILITIES.md`.

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
| `deck-master` | `/deck-master discover`, `/deck-master architect`, `/deck-master generate`, `/deck-master full` | 3-phase curated deck creation: Discovery (research demand) → Architecture (design structure) → Generation (create facts). The primary content creation skill for all new curated decks. |
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
