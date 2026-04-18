# Card System Mechanics

> **Purpose:** Card entity, card types, tier system, damage formula, mastery system, and card creation pipeline.
> **Last verified:** 2026-04-12 (BATCH-2026-04-12-001 Bug A fix: Piercing now actually bypasses enemy block. Previously `damageDealtBypassesBlock` was assigned in `cardEffectResolver.ts` but never consumed in `turnManager.ts`, so enemy block still absorbed Piercing damage. Fix: added block-strip in `turnManager.ts` line 1993 before `applyDamageToEnemy`. See also gotchas.md 2026-04-12.) | 2026-04-12: Fixed mastery extras not reflected in descriptions and resolver — reckless selfDmg now reads extras.selfDmg (4, was 3); execute description/parts now read extras.execBonus and extras.execThreshold for per-level threshold display; double_strike now reads extras.hitMult (75% at L0, scales to 100% at L5); hemorrhage QP bleedMult now reads extras.bleedMult from stat table (L0=3, was hardcoded 4). See card-description-audit.md. | 2026-04-12: Description audit Wave 1-4 — 17 mechanics now read from mastery stat tables (multi_hit hitCount, thorns secondaryValue, chameleon extras qpMult/ccMult/cwMult, bash tag-based vuln duration, parry secondaryValue draw count, hex extras.turns, weaken extras.turns, expose extras.turns, block consecutive bonus tag, immunity extras.absorb, iron_wave/kindle/riposte/reactive_shield fallback defaults corrected, scout drawCount). 1 dead relic (toxic_bloom) excluded from pool.
> **Source files:** `src/data/card-types.ts`, `src/data/mechanics.ts`, `src/services/cardFactory.ts`, `src/services/cardUpgradeService.ts`, `src/services/cardEffectResolver.ts`, `src/services/damagePreviewService.ts`, `src/services/catchUpMasteryService.ts`, `src/data/balance.ts`

> **See also:** [`card-mechanics.md`](card-mechanics.md) — Complete table of all 50+ mechanics (attack, shield, buff, debuff, utility, wild).

---

## Card Entity (`Card` interface)

Each card is a runtime instance linked to a Fact. Key fields:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Per-run unique ID (`card_<counter>`) |
| `factId` | string | Source fact in the facts DB |
| `cardType` | `CardType` | Combat role |
| `domain` | `FactDomain` | Derived from `fact.category` |
| `tier` | `'1' \| '2a' \| '2b' \| '3'` | SM-2 review progression |
| `baseEffectValue` | number | Pre-multiplier damage/block amount |
| `mechanicId` | string? | Mechanic from the mechanic pool |
| `masteryLevel` | number? | In-run mastery level 0–5 (AR-113) |
| `apCost` | number? | AP cost to play |
| `isInscription` | bool? | Forgets on play, moves to forgetPile for the combat duration |
| `isRemovedFromGame` | bool? | Set by Inscription system when permanently consumed; card stays in forgetPile across encounters (never returned) |
| `isCursed` | bool? | Cursed fact penalty applies |
| `isLocked` | bool? | Locked by Trick Question enemy (AR-268) |

---

## Card Types

`CardType = 'attack' | 'shield' | 'utility' | 'buff' | 'debuff' | 'wild'`

Base effect values from `BASE_EFFECT` in `balance.ts`:

| Type | Base Value | Role |
|------|-----------|------|
| `attack` | 4 | Deal damage to enemy |
| `shield` | 3 | Gain block |
| `utility` | 0 | Draw, cycle, manipulate |
| `buff` | 0 | Enhance player or next card |
| `debuff` | 0 | Apply status effects to enemy |
| `wild` | 0 | Context-sensitive or copy effects |

---

## Card Tiers and Power Scaling

Tier is derived from SM-2 review state via `getCardTier()` in `tierDerivation.ts`.

**Tiers exist for FSRS tracking and quiz difficulty ONLY. They have NO effect on damage, visuals, or sell price.** All active tiers have `effectMultiplier = 1.0` — a no-op multiplier set in `cardFactory.ts` but not read by the damage resolver. Power scaling is driven exclusively by the mastery stat table system.

| Tier | Name | Quiz Format | Notes |
|------|------|------------|-------|
| `'1'` | Learning | 3 choices | `effectMultiplier` = 1.0 (deprecated, no gameplay effect) |
| `'2a'` | Proven | 4 choices, reverse allowed | `effectMultiplier` = 1.0 (deprecated, no gameplay effect) |
| `'2b'` | Deep Recall | 5 choices, fill-blank allowed | `effectMultiplier` = 1.0 (deprecated, no gameplay effect) |
| `'3'` | Mastered | Becomes `PassiveEffect` | `effectMultiplier` = 0 — card leaves active hand |

Tier 3 cards leave the active hand and become `PassiveEffect` entries. The `0×` multiplier at T3 reflects that they no longer deal direct damage as active cards. Values in `TIER3_PASSIVE_VALUE` (attack=+1 flat dmg all attacks, shield=+1 flat block, utility=+1 draw at turn start).

---

## Damage Formula

The resolver (`cardEffectResolver.ts`) computes CC damage as:

```
CC damage = getMasteryStats(mechanicId, level).qpValue
            × CHARGE_CORRECT_MULTIPLIER (1.50)
            × chainMultiplier
            × relicModifiers
            + inscriptionFuryBonus
```

`getMasteryStats(mechanicId, masteryLevel).qpValue` returns the explicit qpValue at that mastery level from `MASTERY_STAT_TABLES`. This value already encodes the full mastery progression — there is no separate "masteryBonus" added on top.

`chargeCorrectValue` on `MechanicDefinition` is **dead data** — resolver computes CC as `qpValue × 1.50`. Do not read it.

**Play mode multipliers (as of 2026-04-03 stat table system):**

| Mode | Effect |
|------|--------|
| Quick Play (`quick`) | Uses `getMasteryStats().qpValue` directly |
| Charge Correct (`charge_correct`) | `getMasteryStats().qpValue × CHARGE_CORRECT_MULTIPLIER (1.50×)` |
| Charge Wrong (`charge_wrong`) | `FIZZLE_EFFECT_RATIO = 0.50×` of base effect — always resolves, never zero |
| Cursed QP | `CURSED_QP_MULTIPLIER = 0.7×` |
| Cursed CC | `CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0×` (reward is the cure) |
| Cursed CW | `CURSED_CHARGE_WRONG_MULTIPLIER = 0.5×` |

**Note:** `FIZZLE_EFFECT_RATIO = 0.50×`. Raised 0.25→0.40→0.50 in Balance Pass 4/4b (2026-04-09) — wrong charges are tempo costs, not punishment. Fizzle damage is still below Quick Play (1.0×) so wrong answers remain a setback, just a softer one. CW has a `Math.max(0, ...)` floor to prevent negative values.

---

## Card Descriptions

Card descriptions are generated by `src/services/cardDescriptionService.ts`:

- `getCardDescriptionParts()` — Returns typed `CardDescPart[]` for rich in-hand display (colored numbers, keywords). **Verb-first**; uses `\n` in `txt()` parts for line breaks — the renderer splits on `\n` into `.desc-line` divs. 2 lines max ideal.
- `getDetailedCardDescription()` — Returns plain text for tooltips/inspect panels. Verb-first prose, proper sentences.
- `getShortCardDescription()` — Returns terse verb-first text, ≤20 chars target.

**Coverage (as of 2026-04-09):** All 98 mechanics in `MECHANIC_DEFINITIONS` now have explicit cases in all three description functions. Previously, 62 mechanics fell through to the `default` branch and returned just `mechanic.name` (e.g. "Reinforce" for the reinforce mechanic), causing the "Re" truncation bug. Phase 4 added explicit descriptions for all 62. A regression test (`tests/unit/card-descriptions.test.ts`, 303 tests) enforces this coverage permanently.

**Power source (normalized 2026-04-11):** All three description functions now read `getMasteryStats(mechanic.id, masteryLevel)?.qpValue` as the canonical `power` variable, falling back to `card.baseEffectValue` only when no stat table entry exists. Previously all three used `Math.round(card.baseEffectValue)` which is `BASE_EFFECT[cardType]` (attack=4, shield=3, others=0) — a type-level constant that diverges from per-mechanic stat-table values. This fix resolved 22+ Severity B description/resolver drift findings from the 2026-04-11 four-source audit.

**Description style (as of 2026-04-08):** Verb-first. Lead with a verb. Numbers in `num()`/`numWithMastery()`. Keywords in `kw()`. Line breaks use `\n` not `. `. Examples:
- Attack: `Deal 8 damage`, `Deal 4 damage\n3 times`, `Deal 8 damage\nPierce`
- Shield: `Gain 5 Block`, `Gain 5 Block\nPersists`, `Block\n= enemy attack`
- Debuff: `Apply\n2 Drawing Blanks`, `Apply 3 Doubt\n4 turns`
- Buff: `Next card\n+15% damage`, `Next card −1 AP`, `Next attack\nhits twice`
- Utility: `Draw 3`, `Transform for\nencounter\nCharge: choose 1/3`, `Purge debuffs\nDraw 1`
- Wild: `Copy last card`, `Next card ×2`

**Short descriptions:** Verb-first, ≤20 chars. Examples: `Deal 8`, `Gain 5`, `3× 4 dmg`, `Doubt 3×4`, `Purge`, `2× effect`.

### Card description system (four-source rule)

Card behavior is defined by four sources that must stay in sync. When they diverge, this is the canonical priority order:

| Source | File | Runtime? | Authority |
|--------|------|----------|-----------|
| **Seed** (`MechanicDefinition`) | `src/data/mechanics.ts` | No | Authoring-time reference only. Fields like `quickPlayValue` on the seed are informational; they are NOT read by the resolver at runtime. |
| **Stat table** (`MASTERY_STAT_TABLES`) | `src/services/cardUpgradeService.ts` | YES | **Canonical source of truth** for all QP/CC values and mastery progression. |
| **Resolver** | `src/services/cardEffectResolver.ts` | YES | Must read from `getMasteryStats(id, level)` — never hardcode QP/CC literals. |
| **Description service** | `src/services/cardDescriptionService.ts` | YES | Must render from the same stat-table values the resolver reads. |

The 2026-04-11 four-source audit (`docs/content/card-description-audit.md`) found 22+ Severity-B drift findings from `cardDescriptionService.ts` using `card.baseEffectValue` (a type constant, not per-mechanic) as the `power` variable. Fixed in commit `69c3aa364` — all three description functions now read `getMasteryStats(mechanic.id, masteryLevel)?.qpValue`.

**Adding a new mechanic requires updating all four sources in one commit.** Updating the stat table without updating the description service creates silent drift.

### Canonical Values for Key Mechanics (post-audit, 2026-04-11)

The following mechanics were updated or verified in Phase 2 of the card-description audit. Values shown are stat-table L0 (canonical runtime behavior):

| Mechanic | L0 QP behavior | CC behavior | Notes |
|----------|----------------|-------------|-------|
| **Warcry** | +1 Clarity (this turn) | +`str` Clarity (permanent) + free next Charge | L0 `str=1`; L1=+2, L4–L5=+3. L3+ also grants free Charge on QP (`warcry_freecharge`). |
| **Gambit** | Deal 4 dmg, lose 4 HP | Deal 6 dmg, heal 3 HP | L0 from stat table: selfDmg=4, healOnCC=3. Risk decreases with mastery (L5: selfDmg=1, healOnCC=8). |
| **Fortify / Entrench** | Gain `floor(currentBlock × 0.50)` Block | Gain `floor(min(block,30) × 0.75) + qpValue` Block | NOT a flat "Gain 7 Block". QP=50%, CC=75% of current block. Capped at 30 to prevent snowball. |
| **Feedback Loop** | `qpValue=5` aura attack | 28 base dmg, +12 in Flow State (max 40) | Pass-8 values. Old stated 40 base / +16 flow. |
| **Overheal** | Gain 6 Block (×2 if HP < **60%**) | Standard CC pipeline | Threshold is **60%**, not 50%. (`healthPercentage < 0.6` in resolver) |
| **Smite** | 7 dmg scaled by aura | Standard CC pipeline | Reads stat table. L0 bumped 6→7 in L0 Balance Overhaul. |
| **Recall** | `qpValue` × discard pile size | Standard CC pipeline | Reads stat table. L3: also heals 3 HP; L5: heals 3 + draws 1. |
| **Precision Strike** | `psBaseMult=6` base | 6 × (distractor_count + 1) | Base multiplier reduced 8→6 in Pass 8. L5 bonus multiplier = 12. |
| **Hemorrhage** | 4 dmg + (4 per Lingering Doubt stack), consumes all Lingering Doubt | Standard CC pipeline | L0 qpValue bumped 2→4 in L0 Balance Overhaul. |

---

## Live Card Stats (AR-10.1)

Service: `src/services/liveCardStats.ts` — canonical single-source-of-truth for "what does this card do right now?".

**Hard rule:** All card UI rendering MUST call `selectLiveCardStats(card, ctx)` — never read `baseEffectValue` directly or compute damage inline.

```typescript
import { selectLiveCardStats } from '../services/liveCardStats';
const preview = selectLiveCardStats(card, turnState);
// preview.qpValue, preview.ccValue, preview.qpModified, preview.ccModified
```

`LiveCardTurnContext` is the required subset of `TurnState`. Full `TurnState` objects are also accepted (structural typing). `selectLiveCardStats` delegates to `computeDamagePreview` after building the `DamagePreviewContext` from the turn state.

Helper functions also exported:
- `getEffectiveDrawCount(card)` — returns `drawCount` from mastery stat table for draw cards (foresight, scout, etc.). Fixes the "Draw 0" display bug (AR-10.2).
- `getEffectiveAuraLevel(card)` — returns current aura level for aura-scaled cards (smite, feedback_loop).

---

## Effective Damage Preview

Service: `src/services/damagePreviewService.ts` — pure function, no side effects.

Cards in hand display **effective** QP and CC values rather than raw base values. Numbers are colored to signal modifier state:

- Green (`damage-buffed`) — effective value exceeds the unmodified base
- Red (`damage-nerfed`) — effective value is below the unmodified base

`CardCombatOverlay` builds a `DamagePreviewContext` from `turnState` and calls `computeDamagePreview` for every card in hand, passing the resulting `Record<string, DamagePreview>` to `CardHand` via the `damagePreviews` prop.

**Modifiers INCLUDED in preview:**

| Modifier | Effect |
|----------|--------|
| Relic % and flat bonuses | Applied per active relic |
| Cursed multiplier | `CURSED_QP_MULTIPLIER` / `CURSED_CHARGE_CORRECT_MULTIPLIER` |
| Empower buff (`buffNextCard`) | % bonus to next card's value |
| Overclock ready | 2× effective damage |
| Double strike ready | 2× effective damage |
| Enemy vulnerable | 1.5× damage |
| Enemy `quickPlayDamageMultiplier` | Partial QP reduction (e.g. Core Harbinger 0.3×) |
| Enemy charge-resistant | 50% QP damage |
| Enemy hardcover | Flat QP damage reduction |
| Relics: inscription_fury, bastion's_will, stone_wall, worn_shield, hollow_armor | Inline computation |

**Modifiers EXCLUDED (unknowable at preview time):**

Speed bonus, chain multiplier, chainVulnerable, factDamageBonus, crescendo streak, memory_palace streak.

---

## Mastery System (AR-113)

Cards gain mastery during a run by answering Charge correctly; lose mastery on wrong answers. Max once per encounter per card (`masteryChangedThisEncounter`). Resets each run.

- `MASTERY_MAX_LEVEL = 5`
- `MASTERY_BASE_DISTRACTORS = 2` (L0), `MASTERY_UPGRADED_DISTRACTORS = 3` (L1+)
- Colors: L0=none, L1=green `#22c55e`, L2=blue `#3b82f6`, L3=purple `#a855f7`, L4=orange `#f97316`, L5=gold `#eab308`

### Mastery Stat Table System (Phase 2 Complete, 2026-04-03)

**Every mechanic now has a full L0–L5 stat table** defining explicit values at each mastery level. This replaces the old flat `perLevelDelta` system.

```typescript
// MASTERY_STAT_TABLES in cardUpgradeService.ts — 96 mechanics with full tables
getMasteryStats(mechanicId, level): MasteryLevelStats | null
```

`getMasteryStats()` is the single unified lookup. It checks `MASTERY_STAT_TABLES` first; if the mechanic has no entry, it synthesizes from `MASTERY_UPGRADE_DEFS` (the legacy `perLevelDelta` bridge) so all callers work without behavior change.

The old helpers (`getMasteryBaseBonus`, `getMasterySecondaryBonus`, `getMasteryAddedTag`, `getMasteryApReduction`) are marked `@deprecated`. All consumers (`cardEffectResolver.ts`, `damagePreviewService.ts`, `cardDescriptionService.ts`, `turnManager.ts`) now call `getMasteryStats()`.

**`MasteryLevelStats` interface:**

| Field | Type | Notes |
|-------|------|-------|
| `qpValue` | number | Quick Play base value at this level. CC = qpValue × 1.50 |
| `apCost` | number? | Override AP cost at this level; omit to inherit from `MechanicDefinition`. Read at runtime via `getEffectiveApCost(card)` in `cardUpgradeService.ts` — never read `card.apCost` directly |
| `secondaryValue` | number? | Secondary stat (block, bleed stacks, reflect, etc.) |
| `drawCount` | number? | Draw count override for draw/scry cards |
| `hitCount` | number? | Hit count override for multi-hit cards |
| `cwValue` | number? | Charge Wrong override; omit for mechanic default |
| `tags` | string[]? | Cumulative tags active at this level |
| `extras` | Record<string, number>? | Mechanic-specific fields (selfDmg, execBonus, execThreshold, etc.) |

**Stat table coverage (96 entries across 6 groups):**
- Attacks (20): core attacks, expansion attacks, flagship attacks, chase attacks
- Shields (20): core shields, expansion shields, phase 3 chase shields
- Buffs (10): empower, quicken, focus, double_strike, inscription_fury, inscription_iron, warcry, battle_trance, frenzy, mastery_surge
- Debuffs (10): weaken, expose, hex, slow, sap, corrode, curse_of_doubt, mark_of_ignorance, corroding_touch, entropy
- Utility (16): cleanse, scout, recycle, foresight, conjure, forge, transmute, immunity, sift, scavenge, swap, archive, reflex, recollect, synapse, siphon_knowledge, tutor
- Wild (20): mirror, adapt, overclock, phase_shift, chameleon, dark_knowledge, chain_anchor, unstable_flux, sacrifice, catalyst, mimic, aftershock, knowledge_bomb, ignite, war_drum, inscription_wisdom, aegis_pulse, siphon_strike, stagger, and more

### Design Philosophy — Cards Start Weak, Transform Through Mastery

**Cards start weaker than before.** L0 qpValues are deliberately modest — the power fantasy comes from mastery progression, not the opening hand.

| Design tier | L0 → L5 scaling | When to use |
|---|---|---|
| Modest (1.5–2×) | Side effect IS the value (tags, draws, AP reductions) | Cards where extra effects dominate |
| Solid (2–2.5×) | Standard bread-and-butter scaling | Reliable combat cards |
| Great (2.5–3×) | High-risk, high-cost, or thematic cards | Cards that earn elevated scaling |

### Example Stat Tables

**`strike`** — Standard reliable attack (Solid tier):

| Level | QP | CC (×1.50) | Notes |
|-------|-----|-----------|-------|
| L0 | 4 | 6 | Weak but reliable |
| L1 | 4 | 6 | |
| L2 | 5 | 7.5 | |
| L3 | 6 | 9 | Big jump |
| L4 | 7 | 10.5 | |
| L5 | 8 | 12 | Bread and butter, fully grown |

**`heavy_strike`** — High-base slow attack (Solid tier, WOW milestone at L5):

| Level | QP | AP | CC (×1.50) | Notes |
|-------|----|----|-----------|-------|
| L0 | 6 | 3 | 9 | Big but expensive |
| L1 | 8 | 3 | 12 | |
| L2 | 9 | 3 | 13.5 | |
| L3 | 10 | 3 | 15 | |
| L4 | 11 | 3 | 16.5 | |
| L5 | 12 | **1** | 18 | WOW: costs 1 AP now! |

**`scout`** — Utility draw card (Modest tier, WOW milestone at L5):

| Level | QP | AP | Draw | Tags | Notes |
|-------|----|----|------|------|-------|
| L0 | 0 | 1 | 1 | — | Draw 1 |
| L1 | 0 | 0 | 2 | — | Draw 2! |
| L2 | 0 | 0 | 2 | — | |
| L3 | 0 | 0 | 2 | scout_scry2 | Also scry 2 |
| L4 | 0 | 0 | 3 | — | Draw 3! |
| L5 | 0 | **0** | 3 | scout_scry2 | FREE! Draw 3 + scry 2 |

**`reckless`** — Ignores enemy block. Self-damage decreases as you master it (Great tier):

| Level | QP | CC (×1.50) | Self-Dmg | Notes |
|-------|-----|-----------|---------|-------|
| L0 | 4 | 6 | 4 | Hurts you a lot |
| L1 | 5 | 7.5 | 4 | |
| L2 | 6 | 9 | 3 | Self-damage drops! |
| L3 | 8 | 12 | 3 | |
| L4 | 10 | 15 | 2 | Mastering the recklessness |
| L5 | 10 | 15 | **0** | Zero flat self-dmg; chain-scaled instead (`reckless_selfdmg_scale3`) |

### "Wow Moment" Milestones

Several mechanics have designed creative milestones at key mastery levels that change card behavior (not just number scaling):

| Mechanic | Milestone | Effect |
|---|---|---|
| `heavy_strike` | L5 | Drops from 3 AP to **1 AP** |
| `scout` | L5 | Becomes **FREE** (0 AP). Draw 3 + scry 2 |
| `reckless` | L5 | Self-damage drops to **0** flat; scales with chain length instead (`reckless_selfdmg_scale3`) |
| `lifetap` | L5 | Drops from 2 AP to **1 AP** |
| `execute` | L3 | Execute threshold widens from 25% → **40% HP** |
| `execute` | L5 | Execute threshold widens to **50% HP** |
| `multi_hit` | L1 | Gains a **3rd hit** |
| `multi_hit` | L4 | Gains a **4th hit** |
| `twin_strike` | L3 | Gains a **3rd hit** |
| `double_strike` | L5 | Pierces block |
| `pierce_strip3` | L3 | Strips **3 enemy block** |
| `piercing` | L5 | Applies **Exposed 1t** |
| `power_strike` | L5 | qp=8; Applies **Exposed 2t** at 75% amp (`power_vuln2t`, `power_vuln75`) |
| `scout` | L3 | Gains **scry 2** |
| `foresight` | L3 | Reveals enemy's **next intent** |
| `conjure` | L2 | Upgrades to **uncommon** cards |
| `conjure` | L3 | Pick **2 cards** |
| `conjure` | L5 | Pick 2 **rare** cards |
| `multi_hit` | L3 | +1 **Lingering Doubt** per hit (`multi_bleed1` tag) |
| `multi_hit` | L5 | +1 **Lingering Doubt** per hit (`multi_bleed1` tag) |
| `piercing` | L3 | Strips **3 enemy block** before damage (`pierce_strip3` tag) |
| `piercing` | L5 | Strips 3 block + **Exposed 1t** (`pierce_strip3`, `pierce_vuln1` tags) |
| `lifetap` | L2 | Heal rises from **20% → 30%** of damage (`lifetap_heal30` tag) |
| `bash` | L3 | Vuln extended by **+1 turn** (`bash_vuln2t` tag) |
| `bash` | L5 | Vuln +1 turn AND **Drawing Blanks 1t** (`bash_vuln2t`, `bash_weak1t` tags) |
| `rupture` | L5 | Applied Lingering Doubt **never decays** (`rupture_bleed_perm` tag) |
| `lacerate` | L5 | Also applies **Exposed 1t** (`lacerate_vuln1t` tag) |
| `kindle` | L5 | Brain Burn triggers **TWICE** per play (`kindle_double_trigger` tag) |
| `overcharge` | L3 | Encounter scaling **doubled** (`overcharge_bonus_x2` tag) |
| `overcharge` | L5 | Scaling doubled + **draw 1** (`overcharge_bonus_x2`, `overcharge_draw1` tags) |
| `twin_strike` | L5 | Each hit applies **2 Brain Burn** (`twin_burn2` tag) |
| `precision_strike` | L3 | +**50% quiz timer** extension (`precision_timer_ext50` tag) |
| `precision_strike` | L5 | +50% timer + **difficulty bonus ×2** (`precision_timer_ext50`, `precision_bonus_x2` tags) — L5 multiplier 12 vs base 6 |
| `riposte` | L5 | qp=3, sec=5; deals **40% of block as bonus damage** (`riposte_block_dmg40` tag) |
| `smite` | L3 | Aura scaling **doubled** (`smite_aura_x2` tag) |
| `smite` | L5 | Aura scaling doubled (persists at L5) |
| `feedback_loop` | L3 | CW Aura crash **halved** (`feedback_crash_half` tag) |
| `feedback_loop` | L5 | CW crash halved + CW deals **50% QP damage** instead of 0 (`feedback_crash_half`, `feedback_cw_nonzero` tags) |
| `recall` | L3 | On review CC, also **heals 3 HP** (`recall_heal3` tag) |
| `recall` | L5 | Heal 3 HP + **draw 1** on review CC (`recall_heal3`, `recall_draw1` tags) |
| `eruption` | L5 | **Refunds 1 AP** after play (`eruption_refund1` tag) |
| `volatile_slash` | L5 | **No longer forgets** on CC (`volatile_no_exhaust` tag) |
| `chain_lightning` | L3 | Minimum chain count = **2** (`chain_lightning_min2` tag) |
| `chain_lightning` | L5 | Min chain = 2 (persists at L5) |
| `strike` | L5 | **+Tempo bonus** if 3+ cards played this turn (`strike_tempo3`) |
| `iron_wave` | L5 | Block component **doubles** on CC (`iron_wave_block_double`) |
| `twin_strike` | L5 | Each hit applies 2 Brain Burn + **chain extends Brain Burn duration** (`twin_burn2`, `twin_burn_chain`) |
| `block` | L5 | **+bonus block** when played 3+ consecutive turns (`block_consecutive3`) |
| `reinforce` | L5 | Draws 1 + gains **1 permanent block** (`reinforce_draw1`, `reinforce_perm1`) |
| `absorb` | L5 | CC draws 2 + **refunds 1 AP** when block absorbs damage (`absorb_draw2cc`, `absorb_ap_on_block`) |
| `empower` | L5 | 60% boost to 2 cards + applies **Drawing Blanks 2** to enemy (`empower_2cards`, `empower_weak2`) |
| `mastery_surge` | L5 | +2 mastery to 3 cards + **refunds 1 AP** (`msurge_choose`, `msurge_plus2`, `msurge_ap_on_l5`) |
| `weaken` | L5 | 3 stacks 3 turns + player gains **30 block** (`weaken_shield30`) |
| `expose` | L5 | 2 stacks 3 turns + 3 damage + **75% Vuln amplification** (`expose_dmg3`, `expose_vuln75`) |
| `warcry` | L3 | Grants **free next Charge** (waives +1 AP surcharge) on QP and CC (`warcry_freecharge`) |
| `warcry` | L5 | Clarity becomes **permanent** even on QP; CC: +3 Clarity permanent + free Charge |


### Pass 8 Balance Changes (2026-04-10)

| Mechanic | Change | Before | After |
|---|---|---|---|
| `eruption` | X-cost AP wiring: `eruptionXAp` now passed from `turnManager` to resolver. Card correctly drains all remaining AP on play. | Always dealt 0 damage (bug) | Deals `perAp × remainingAP` |
| `fortify` | Block scaling capped at 30 to prevent exponential snowball | `currentBlock × 0.75` unlimited | `min(currentBlock, 30) × 0.75` (max ~22 from shield scaling + baseValue) |
| `precision_strike` | CC difficulty multiplier reduced | base=8, L5=16 | base=6, L5=12 — new CC at 2 distractors: 18, at 4: 30 |
| `feedback_loop` | CC base damage and flow state bonus reduced | 40 base, +16 flow (max 56) | 28 base, +12 flow (max 40) |

### L0 Balance Overhaul (2026-04-10)

**Root cause fixed:** `MASTERY_STAT_TABLES` per-level `apCost` overrides (e.g. Heavy Strike L5→1 AP, Smite L5→1 AP) were dead data — `card.apCost` was seeded once at build time and never refreshed on mastery-up. Added `getEffectiveApCost(card)` helper in `src/services/cardUpgradeService.ts` that prefers `getMasteryStats(id, level).apCost` and falls back to `card.apCost`. All AP readers in `turnManager.ts`, `cardDescriptionService.ts`, and playtest tools now use this helper.

**Bulwark fix (`src/data/mechanics.ts`):** baseValue 18→9, apCost 3→2. Was a trap card at L0 (3 AP = entire turn budget). Now matches the MASTERY_STAT_TABLES L0 entry.

**9-card L0 qpValue bumps** (target: ≥2.0 damage/AP floor for 2-AP cards):

| Mechanic | L0 Before | L0 After | Key notes |
|---|---|---|---|
| `multi_hit` | qpValue=1, hitCount=2 | qpValue=2, hitCount=2 | L1 also bumped 1→2 for monotonic |
| `lifetap` | qpValue=3 | qpValue=5 | L1 bumped 4→5 for monotonic |
| `bash` | qpValue=3, apCost=2 | qpValue=4, apCost=2 | Unchanged L1+ |
| `chain_lightning` | qpValue=3, apCost=2 | qpValue=4, apCost=2 | L1+L2 bumped 4→5 for monotonic |
| `smite` | qpValue=6, apCost=2 | qpValue=7, apCost=2 | L1-L4 shifted +1; L5 kept at 12 |
| `hemorrhage` | qpValue=2 (L0-L2) | qpValue=4 (L0-L2) | L3-L5 also shifted up |
| `fortify` | qpValue=4, apCost=2 | qpValue=5, apCost=2 | L1-L4 shifted +1 |
| `overheal` | qpValue=5, apCost=2 | qpValue=6, apCost=2 | L1-L5 shifted; bug fix: L4 missing apCost:1 added |
| `ironhide` | qpValue=5, apCost=2 | qpValue=6, apCost=2 | Bug fix: L3 was non-monotonic (6→5); fixed L3-L4 to 7 |

**Latent monotonic bugs fixed (caught by regression tests):**
- `riposte` L5: qpValue was 3 (< L4=4) — fixed to 4
- `stagger` L5: qpValue was 0 (< L4=1) — fixed to 1

**New mastery tables added (`src/services/cardUpgradeService.ts`):**
- `burnout_shield`: full L0–L5 table (qpValue 5→13). L5 gains `burnout_no_exhaust` tag (wired as of 2026-04-10: L5 CC no longer forgets)
- `knowledge_ward`: full L0–L5 table (qpValue 6→12). L3+ gains `knowledge_ward_cleanse` tag (wired as of 2026-04-10: cleanses 1 debuff from player on any play mode at L3+)
- Both previously used legacy `getMasteryBaseBonus()` bridge; now have explicit `MASTERY_STAT_TABLES` entries

**Regression tests (`tests/unit/cardUpgradeService-apCost.test.ts`, 34 tests):**
- `mechanic.apCost` vs MASTERY_STAT_TABLES L0 entry agreement
- AP cost monotonically non-increasing with mastery
- qpValue monotonically non-decreasing with mastery
- Per-mechanic `getEffectiveApCost` checks for all mechanics with AP reductions
- Spot-checks for all 9 bumped cards and 2 new tables

### Foresight Mastery-Gated AP Cost (2026-04-11 — BATCH-ULTRA Cluster G)

**Problem:** Foresight was 0 AP at all mastery levels, making it strictly dominant — always played, never suboptimal. T3 strategic analysis confirmed it was always the first card played regardless of board state.

**Fix:** Mastery-gated cost in `MASTERY_STAT_TABLES` (src/services/cardUpgradeService.ts):
- **L0: 0 AP** — stays free for onboarding; new players should not be punished for drawing
- **L1-L5: 1 AP** — restores the tension between using Foresight vs spending AP on attacks/blocks

`getEffectiveApCost(card)` reads the stat table override, so even cards with old `card.apCost=0` seeds return 1 AP at mastery 1+.

**Tests:** `src/services/cardUpgradeService.test.ts` (10 tests) covers all 6 mastery levels, draw count progression, and stat-table-overrides-seed behavior.

### Tag System — How Tags Work in the Resolver

Tags in `MasteryLevelStats.tags` are cumulative — a mechanic at L5 inherits all tags from lower levels that define them.

In `cardEffectResolver.ts`, the resolver reads tags via:
```typescript
const activeTags = _masteryStats?.tags ?? [];
const hasTag = (tag: string) => activeTags.includes(tag);
```

Each case uses `hasTag('tag_name')` to gate behavior. New result fields added to `CardEffectResult` for tags:

| Field | Type | Set by tag | Purpose |
|-------|------|-----------|---------|
| `bleedPermanent` | `boolean?` | `rupture_bleed_perm` | Signals turnManager to skip bleed decay for this apply |
| `timerExtensionPct` | `number?` | `precision_timer_ext50` | Quiz system extends timer by this percent |
| `apRefund` | `number?` | `eruption_refund1` | AP to refund after card resolves |

### Catch-Up Mastery (New Card Acquisition)

Service: `src/services/catchUpMasteryService.ts` — called from `encounterBridge.addRewardCardToActiveDeck()`.

When the player picks a new card as a reward, it receives **starting mastery proportional to the deck's current average** so late-game picks are not dead on arrival:

- Avg mastery < 1 (run start) → L0 (no catch-up; early ramp feels natural)
- Avg mastery ≥ 1 → random roll 0.5×–1.5× the average, floored and capped at the mechanic's `maxLevel`
- Median new card lands at ~0.8× the deck average — slightly behind but immediately competitive

```
catchUpLevel = clamp(floor(rand(0.5–1.5) × avgMastery), 0, mechanic.maxLevel)
```

---

## Starter Deck Composition (2026-04-09)

The run starts with 10 cards: **5 Strike + 4 Block + 1 Transmute**. Transmute replaced Foresight (draw 2 utility) to immediately introduce deck-building as a mechanic. The starter deck is intentionally weak — interesting power comes from rewards and mastery.

| Card | Count | L0 QP value |
|------|-------|-------------|
| Strike | 5 | 3 dmg |
| Block | 4 | 3 block |
| Transmute | 1 | Transforms 1 deck card for the encounter |

**Transmute mechanic (encounter-only scope, 2026-04-09, draw-pile routing added 2026-04-11 Issue 5):**

Transmute transforms a source card into a new card for the current encounter only. At encounter end, `revertTransmutedCards()` restores all cards with `isTransmuted=true` back to their originals.

- **Quick Play (QP):** Auto-transforms the source card into 1 randomly chosen candidate. No picker shown. Resolves immediately via `applyTransmuteAuto` in the effect result. The source card is mutated **in-place** (stays in its current pile position).
- **Charge Correct (CC):** Opens the CardPickerOverlay. Player chooses 1 of 3 candidates (2 at mastery 3+). Resolved via `resolveTransmutePick()`. **The chosen card routes through the draw pile top** — see picker resolution flow below.
- **Charge Wrong (CW):** Same as QP — auto-picks 1 random candidate. Card still resolves; wrong answer is never a dead play. In-place mutation (same as QP).

**Picker resolution flow (CC path, Issue 5 — 2026-04-11):**

After the player selects a card in the CardPickerOverlay, `resolveTransmutePick()` in `turnManager.ts`:
1. Locates the source card across all four piles (hand/drawPile/discardPile/forgetPile).
2. **Splices** the source card out of its pile (does NOT overwrite in-place).
3. Builds the new transmuted card with a fresh unique id (`${oldId}-tx-${Date.now()}`).
4. **Pushes** the new card onto the TOP of `drawPile` (`push()` = top because drawPile is a stack — `pop()` draws from the end).
5. Returns the pushed card(s) as `Card[]` (`pickResolvedCards`).

The UI (CardCombatOverlay) then calls `drawHand(deck, 1)` once per element in `pickResolvedCards` to trigger the normal draw animation into hand. `drawHand` with an explicit count bypasses the hand-size cap (`count !== undefined` skips the HAND_SIZE clamp in deckManager.ts), so the draw succeeds even when the hand is full. Additionally, the **Hand Composition Guard** and **Tag Magnet Bias** in `drawHand` are scoped to `count === undefined` (start-of-turn only) — they must not fire for mid-turn explicit draws or the player's chosen card would be silently replaced. See `deckManager.ts` lines ~218–237.

This routing reuses the existing draw animation for free — the player sees their chosen card fly into their hand rather than teleporting.

**Draw pile ordering note:** `drawPile` is a stack — `pop()` draws from the END of the array. `push()` adds to the end (top). `unshift()` adds to the front (bottom, drawn last). Never confuse the two.

**Implementation details:**
- `applyTransmuteSwap()` internal helper handles both paths via `routeThroughDrawPile` parameter (default `false` for auto path).
- Source card's factId is preserved — the transmuted card keeps its fact binding.
- New unique id on the transmuted card so CardHand's `$effect` ID-tracking detects it as a new card entering the hand, firing the `card-drawn-in` animation.
- Original fields saved to `originalCard` snapshot. `isTransmuted=true` set on the new card.
- Mastery 3+ CC with 2 picks: primary card pushed first, extra card pushed second (becomes the topmost draw). Both returned in `pickResolvedCards`. UI draws both.
- Extra card (second pick) uses sentinel `originalCard.id` (`transmute_extra_remove_*`) so `revertTransmutedCards()` removes it entirely at encounter end.
- `revertTransmutedCards(deck)` walks hand/draw/discard piles. Cards with `isTransmuted && originalCard` are restored; those with sentinel ids are dropped.
- RNG safety: `push()` on an already-built drawPile is order manipulation only — it does NOT invoke `reshuffleDiscard()` or advance any RNG seed. Co-op seed is safe.

**Forget pile end-of-encounter lifecycle:**

At encounter end (`encounterBridge.ts` — all three victory paths and the defeat path), before `activeTurnState.set(null)` is called, all non-inscription cards in `deck.forgetPile` are moved to `deck.discardPile`. Cards with `isRemovedFromGame === true` (permanently consumed Inscriptions) remain in the forget pile indefinitely. This means forget-on-play cards (e.g. burnout mechanics, volatile at lower mastery) are returned to the player's deck at the end of every encounter.

---

## Card Creation (`createCard`)

`cardFactory.ts` builds cards via `createCard(fact, reviewState, cardTypeOverride?)`:

1. `domain` — `resolveDomain(fact)` from `fact.category`
2. `cardType` — `cardTypeOverride` or `deriveCardTypeForFactId(fact.id)`
3. `tier` — `getCardTier()` from `reviewState.stability + consecutiveCorrect + passedMasteryTrial`
4. `baseEffectValue` — `BASE_EFFECT[cardType]` (attack=4, shield=3, others=0)
5. `effectMultiplier` — `TIER_MULTIPLIER[tier]` — always 1.0 for active tiers (T1/T2a/T2b=1.0, T3=0) — **deprecated**: set on card struct but not read by the damage resolver; has no gameplay effect for active tiers
6. `isMasteryTrial` — `qualifiesForMasteryTrial()` checks `MASTERY_TRIAL.REQUIRED_STABILITY=30` + `REQUIRED_CONSECUTIVE_CORRECT=7`

Mechanics (`mechanicId`) and chain type (`chainType`) are assigned by the run pool builder, not `createCard`.

---

## Severity-A Resolver Normalization (2026-04-11)

**Context:** The 2026-04-11 four-source audit identified 11 mechanics whose resolvers in `cardEffectResolver.ts` used hardcoded literals instead of reading from `MASTERY_STAT_TABLES` via `getMasteryStats()`. This created drift risk: stat table edits would not propagate to the resolver runtime. These 11 were designated Severity A (resolver ignores stat table entirely).

### HARD STOP Rule

For mechanics where `CC ÷ QP ≠ 1.50`, CC normalization via the standard `qpValue × CHARGE_CORRECT_MULTIPLIER` formula would change the player-experienced value. Per the HARD STOP rule applied during this pass:

- **CC values for these mechanics are preserved as hardcoded literals** — do not "normalize" them.
- **QP and secondary values are normalized** to read from `getMasteryStats()` at L0.
- The stat table is updated to match the resolver runtime (not the other way around).

### Mechanics with HARD STOP (CC:QP ratio ≠ 1.5)

| Mechanic | QP (L0) | CC (L0) | CC:QP Ratio | Action |
|---|---|---|---|---|
| `execute` | 8 (execBonus) | 24 | 3.0× | CC stays hardcoded; QP reads `extras.execBonus` from stat table |
| `thorns` | 3 (secondaryValue) | 9 | 3.0× | CC stays hardcoded; QP reads `secondaryValue` from stat table |
| `hex` | 3 stacks / 3 turns | 8 stacks | 2.67× | CC stays hardcoded (8 stacks); QP reads `extras.stacks/turns` from stat table |
| `lacerate` | 4 (secondaryValue) | 8 | 2.0× | CC stays hardcoded; QP reads `secondaryValue` from stat table |
| `kindle` | 4 (secondaryValue) | 8 | 2.0× | CC stays hardcoded; QP reads `secondaryValue` from stat table |

**Stat table L0 corrections applied to align with resolver runtime:**
- `execute` L0: `extras.execBonus` 4→8
- `hex` L0: `extras.stacks` 2→3, `extras.turns` 2→3
- `thorns` L0: `secondaryValue` 1→3
- `lacerate` L0: `secondaryValue` 3→4
- `kindle` L0: `secondaryValue` 2→4

### Mechanics Fully Normalized (SAFE — CC:QP = 1.5)

| Mechanic | Change | Notes |
|---|---|---|
| `iron_wave` | QP and CW now read `_masteryStats.secondaryValue` (L0=3) | Removed deprecated `getMastarySecondaryBonus` call path |
| `riposte` | QP/CW now read `_masteryStats.secondaryValue` (L0=4) | CC (12) stays hardcoded; not a HARD STOP case — CC:QP=3:1 |
| `reactive_shield` | QP thorn value now reads `_masteryStats.secondaryValue` (L0=2) | CC (5) and CW (1) stay hardcoded |
| `siphon_strike` | `minHeal` now reads `_masteryStats.extras.minHeal` (L0=2, L3+=3) | Replaced direct `masteryLevel>=3` check |
| `corrode` | Already reading stat table via `finalValue` | Comment added only |
| `overcharge` | Already reading stat table via `finalValue` | Comment added only |

**Stat table L0 corrections applied:**
- `riposte` L0: `secondaryValue` 3→4
- `reactive_shield` L0: `secondaryValue` 1→2
- `siphon_strike` L0: `extras.minHeal` 1→2

### Warcry Cleanup

- `warcry_perm_str` tag removed from `MASTERY_UPGRADE_DEFS` in `cardUpgradeService.ts` — zero readers confirmed (grep: 0 callers outside definition). The L3+ permanent Clarity effect is implemented via a direct `masteryLevel >= 3` check in `turnManager.ts`. The tag was defined but never dispatched.
- Comment in `turnManager.ts` ~line 2368 updated to reflect the direct-check approach.
- Comment in `cardEffectResolver.ts` warcry case updated to match.

### Gambit Description Reframe

**Problem:** Gambit was framed as a risk card ("deal damage and lose HP"), deterring first-time players from using it. The CC heal upside was buried at the end of the description.

**Fix (L0 canonical values: power=4, selfDmg=4, healOnCC=3):**

| Field | Before | After |
|---|---|---|
| Full description | "Deal 4 damage and lose 4 HP (QP). CC: deal damage and heal 3 HP instead." | "CC: Deal 4 damage and heal 3 HP. QP: deal 4 damage, lose 4 HP. CW: deal damage and lose extra HP." |
| Short description | "4 dmg ±HP" | "CC:+4hp / QP:-hp" |
| Parts array order | QP shown first, CC appended | CC shown first, QP appended |

The CC heal upside is now the headline. New players see the reward before the risk.
