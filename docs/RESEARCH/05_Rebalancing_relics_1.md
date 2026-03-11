# Recall Rogue — Relic Rebalancing Proposal v1

**Date:** 2026-03-11
**Based on:** 300-run headless playtest report + GAME_DESIGN.md analysis
**Design philosophy:** Ascension 0 floor 24 should be reliably achievable by expert players with *deliberate relic choices*. It should NOT be achievable with *any 3 random free starters*. Ascension levels 1–20 are the real difficulty scaling.

---

## Guiding Principles

1. **Relic selection must matter.** Config #74 proves that 3 arbitrary free starters (whetstone + flame_brand + war_drum) make experts immortal at 100% HP. This means relic choice screens are theater — anything works. Fix: no single relic should contribute >15% overall impact solo.

2. **The AP bottleneck is a systemic issue, not a relic bug.** 5 cards drawn, 3 AP to spend. Every draw-only relic (swift_boots, afterimage, blood_price) shows 0% impact because extra cards literally cannot be played. Either fix the system or redesign the relics. I recommend redesigning the relics (system change is too risky pre-launch).

3. **Defensive anti-synergy must be addressed.** Block stacking at -3.45x synergy means players who invest in defense get *punished*. This violates basic roguelite design — build identity should be rewarded, not penalized.

4. **Knowledge relics at 6x expert advantage is acceptable IF beginners have viable alternatives.** The game's core loop rewards correct answers. Knowledge relics *should* be better for players who know more. But they shouldn't be the *only* path to power.

5. **Cursed relics should feel dangerous for everyone**, not "free power for experts, death sentence for beginners."

---

## Tier 1: Critical Nerfs (S-Tier → A/B-Tier)

### flame_brand — "First attack each encounter +50% damage"

**Problem:** Resets every encounter. 72 encounters per full run = 72 procs. Measured at 74.6% overall impact — literally the most broken relic in the game. Three free starters including this one make experts unkillable.

**Current:** First attack each encounter +50% damage
**Proposed:** First attack each **floor** +40% damage

**Rationale:** 24 procs per run instead of 72 (3x reduction in frequency). Slightly lower multiplier. Still a strong "alpha strike" relic that rewards opening with a big hit, but can't carry a run solo. Expected impact drop: ~74% → ~18%.

---

### war_drum — "+1 damage per combo level this turn"

**Problem:** At combo 5 (2.0x), this adds +5 flat damage *per card played*. With 3 AP that's +15 damage/turn on top of everything else. Scales exponentially with accuracy — experts with 90% accuracy build combo 5 routinely.

**Current:** +1 damage per combo level this turn
**Proposed:** +1 damage per combo level, **capped at +3**

**Rationale:** Caps the runaway scaling. At combo 3 (1.3x) you get +3/card = +9/turn, which is strong but not game-breaking. Preserves the "reward accuracy" fantasy without making it an auto-pick. Expected impact drop: ~35% → ~12%.

---

### curiosity_gem — "Tier 1 (Learning) cards +20% effect"

**Problem:** On run 1-3, virtually 100% of your deck is Tier 1. This is a permanent +20% to everything. Even on later runs, new domains start at Tier 1. Measured at 33.1% overall impact.

**Current:** Tier 1 cards +20% effect
**Proposed:** Tier 1 cards +15% effect, **max 3 activations per encounter**

**Rationale:** Reduced multiplier + per-encounter cap. With 3 AP you play 3 cards max, so the cap only matters in edge cases (Quicken granting +1 AP), but it future-proofs against AP economy combos. Expected impact drop: ~33% → ~14%.

---

### combo_ring — "Combo starts at 1.15x instead of 1.0x"

**Problem:** 24.2% overall impact. The issue is that starting at 1.15x means your *first* correct answer already does bonus damage, and combo 5 reaches 2.15x instead of 2.0x. It's a multiplier on a multiplier system.

**Current:** Combo starts at 1.15x
**Proposed:** Combo starts at 1.10x

**Rationale:** Small numerical change but significant because it compounds across every card play. 1.10x is still a meaningful head start that rewards the "combo builder" archetype without being an auto-pick. Expected impact drop: ~24% → ~10%.

---

## Tier 2: Draw/AP Relic Redesigns (D-Tier → B-Tier)

The core problem: drawing more cards with the same AP is useless. These relics need secondary effects tied to unplayed cards.

### swift_boots — "Draw 6 cards per turn instead of 5"

**Current:** Draw 6 (0% impact — extra card sits in hand unused)
**Proposed:** Draw 6 cards per turn. At end of turn, each **unplayed card grants 1 block** before being discarded.

**Rationale:** Now the extra card has value even unplayed. With 3 AP you play 3, discard 3, gaining 3 block passively. This makes swift_boots a hybrid draw/defense relic — thematic (you're so fast you can partially dodge) and mechanically relevant. Stacks reasonably with defense builds without creating anti-synergy because the block is small and the DPS doesn't change.

---

### afterimage — "3+ cards played → +1 draw next turn"

**Current:** +1 draw next turn (0% impact — same AP problem)
**Proposed:** 3 cards played this turn → **+1 AP** next turn (not draw)

**Rationale:** This is what the relic *wants* to be. Playing 3 cards (spending all AP) is already what you do most turns, so this effectively grants 4 AP every other turn. Strong but conditional — you must spend all AP to trigger it, which means no "save AP" plays. Creates interesting tension with cards like Heavy Strike (2 AP) which prevent the trigger.

---

### blood_price — "+2 cards/turn, lose 2 HP/turn"

**Current:** +2 draw, -2 HP/turn (net negative — cards are useless, HP loss is real)
**Proposed:** +1 card/turn, **+1 AP/turn**, lose **3 HP/turn**

**Rationale:** Now it's genuinely cursed. You get 4 AP and 6 cards (play 4 of 6), which is a massive tempo boost. But 3 HP/turn is brutal — over a 5-turn encounter that's 15 HP, nearly a full heal card's worth. Creates real risk/reward: you're racing to kill the enemy before you kill yourself. The HP cost scales with encounter length, naturally punishing defensive/slow play.

---

### double_vision — "First card each encounter costs 0 AP"

**Current:** 0% solo impact (saves 1 AP once, not enough to matter)
**Proposed:** First card each encounter costs 0 AP **and deals +25% effect**

**Rationale:** The 0 AP is already there — adding a damage sweetener makes the "opening move" fantasy feel impactful. Synergizes with flame_brand conceptually (both reward openers) but since flame_brand is nerfed to per-floor, they won't stack oppressively.

---

### quicksilver — "Start encounters with +1 AP"

**Current:** 0% solo impact, but 2.79x synergy in AP combos
**Proposed:** No change to effect. **Reduce cost from 60 → 45 Mastery Coins.**

**Rationale:** The relic is actually well-designed — it's a combo enabler, not a solo carry. The problem is that at 60 coins (Rare), it's too expensive for what it does alone. Reducing cost makes it accessible earlier as a build-around piece. The 2.79x synergy with momentum_gem + double_vision is strong but requires 3 specific relics, which is fair for a build-defining combo.

---

## Tier 3: Defensive Relic Rework (Anti-Synergy Fix)

### The Block Problem

Block stacking (stone_wall + fortress_wall + iron_buckler) produces **-3.45x synergy** because more block = longer encounters = more total damage taken. The soft enrage at turn 15+ doesn't kick in fast enough to punish stalling.

### Systemic Fix: Soft Enrage Acceleration

**Current:** Turn 15+ → enemy +3 dmg/turn
**Proposed:** Turn 10+ → enemy +2 dmg/turn, Turn 15+ → enemy +5 dmg/turn

This puts a tighter clock on all encounters. Defensive builds can still tank for 10 turns comfortably but can't stall indefinitely. Offensive builds barely notice (they kill in 4-6 turns anyway).

### fortress_wall — "Block carries between turns"

**Current:** 1.3% impact, extends fights
**Proposed:** Block carries between turns. **At the start of each turn, convert 25% of carried block into damage dealt to the enemy** (rounded down).

**Rationale:** Now persistent block slowly converts into offense. A player who blocks 12 on turn 1 carries it and deals 3 passive damage on turn 2, then 2 on turn 3, etc. This gives defensive builds a damage outlet and prevents the "infinite stall" anti-synergy.

---

### iron_resolve — "Below 25% HP: block doubled"

**Current:** 0% impact (25% HP = usually dead already)
**Proposed:** Below **40% HP**: block +50% (not doubled)

**Rationale:** Higher threshold means it actually triggers before death. Reduced from 2x to 1.5x to compensate for the wider activation window. At 40 HP (40% of 100), your shield cards go from 6 → 9 block. Meaningful but not game-breaking.

---

### mirror_shield — "Full block absorb → reflect 50%"

**Current:** 0% impact (full absorb too rare)
**Proposed:** When block absorbs **any** damage, reflect **20%** of the absorbed amount back to the enemy.

**Rationale:** Always-on at a lower rate instead of conditional at a high rate. If you block 8 damage, you reflect 1.6 (rounded to 2). Small but consistent, makes blocking feel aggressive. Synergizes with thorned_vest (3 flat reflect) for a "thorns build" archetype.

---

## Tier 4: Cursed Relic Rebalancing

### glass_cannon — "+40% attack damage, take +15% more damage"

**Problem:** For experts (90% accuracy), enemies die so fast the +15% incoming damage barely matters. For beginners (55% accuracy), the curse is devastating. Config #90 shows experts survive at 88% HP with JUST this relic.

**Current:** Attacks +40% dmg, take +15% more damage
**Proposed:** Attacks +35% dmg, take +15% more damage. **Each wrong answer this encounter increases incoming damage by +5% (stacking, resets per encounter).**

**Rationale:** Expert at 90% accuracy might miss 0-1 per encounter: +15% or +20% incoming. Manageable. Beginner at 55% might miss 3+: +30% incoming on top of base +15% = +45% total. Now the curse actually scales with the downside the name implies — if you're a "glass cannon," you'd better not miss. This also directly addresses the 5x expert-favored skill fairness ratio.

---

### glass_cannon + phase_cloak interaction (4.05x synergy)

**Problem:** 20% dodge completely negates the +15% incoming damage penalty.

**Proposed:** Add an interaction rule: **When glass_cannon is active, phase_cloak's dodge chance is halved (20% → 10%).** Display tooltip: "Fragile body — harder to dodge."

**Rationale:** Doesn't kill either relic. Just prevents the full negation. 10% dodge with +35% attack and +15%+ incoming is still a valid risk/reward choice, just not a free lunch.

---

### blood_price (already redesigned above)

The new version (+1 card, +1 AP, -3 HP/turn) is inherently self-balancing: longer encounters = more HP lost. Experts who kill in 3 turns lose 9 HP. Beginners who take 7 turns lose 21 HP. The curse scales with performance naturally.

---

## Tier 5: Weak Relic Buffs (C/D-Tier → B-Tier)

### scholars_hat — "Correct answers heal 1 HP"

**Current:** 2.0% impact (1 HP is nothing)
**Proposed:** Correct answers heal **2 HP**. Wrong answers heal **1 HP**.

**Rationale:** Addresses the "knowledge relics punish beginners" finding. At 3 cards/turn, an average player (70% accuracy) heals ~5 HP/turn. A beginner (55%) heals ~4 HP/turn. An expert (90%) heals ~6 HP/turn. The gap exists but it's 1.5x, not 6x. The wrong-answer heal is thematically "learning from mistakes" — on brand for an educational game.

---

### memory_palace — "3 correct in a row → +3 damage to next attack"

**Current:** 6.8% impact, streak requirement too high for average players
**Proposed:** **2** correct in a row → +4 damage to next attack

**Rationale:** Lowering from 3→2 makes this triggerable for average players (70% accuracy = ~49% chance of 2 in a row vs ~34% for 3 in a row). Slightly higher damage reward (+4 vs +3) compensates for the easier trigger to maintain expert value.

---

### barbed_edge — "Strike-tagged mechanics +3 base damage"

**Current:** 0% impact (strike-tag condition too narrow)
**Proposed:** **Attack-type** cards +2 base damage

**Rationale:** Broadening from "strike-tagged" to "all attack cards" makes this a weaker but more consistent version of whetstone. With ~30% of the pool being attacks, you'll have 1-2 attack cards per hand. +2 each is solid without overlapping with whetstone's niche (whetstone is +2 to ALL attacks including non-attack-type cards that deal damage... actually whetstone is the same. Let me differentiate.)

**Revised proposal:** Strike and Heavy Strike mechanics deal +4 base damage (up from +3). **Additionally, Heavy Strike's AP cost is reduced to 1 when barbed_edge is active.**

**Rationale:** Now barbed_edge is the "Strike specialist" relic. Heavy Strike going from 2 AP → 1 AP is a massive efficiency gain (14 damage for 1 AP instead of 2), but it only applies to one specific mechanic. Creates a build-defining choice: "I want Heavy Strike cards in my deck." Narrow but powerful when it hits.

---

### phoenix_feather — "Once per run: resurrect at 30% HP"

**Current:** 0% impact (one save doesn't change run outcome)
**Proposed:** Once per **boss encounter**: resurrect at 30% HP. Resets at each boss fight. (Still max 1 trigger per encounter.)

**Rationale:** 8 boss encounters in a full run means up to 8 potential saves, but only during the hardest fights. Regular encounters and mini-bosses can still kill you permanently. This makes phoenix_feather the "boss insurance" relic — a distinct niche that no other relic fills. At 70 coins it should feel legendary.

---

### renewal_spring — "Heal 10% max HP on floor advance"

**Current:** 0% impact (8 HP every 3 encounters is negligible)
**Proposed:** Heal **15%** max HP on floor advance. If HP is above 80%, instead gain **5 temporary block** for the next encounter.

**Rationale:** 15 HP per floor is meaningful sustain (you already get 15% post-encounter heal from the base system, so this effectively doubles floor-transition healing). The >80% HP clause prevents waste — healthy players get a defensive bonus instead.

---

### chain_lightning_rod — "Multi-hit +2 extra hits"

**Current:** 0% impact (multi-hit cards too rare)
**Proposed:** Multi-hit attacks get +1 extra hit. **All attack cards have a 15% chance to proc an additional hit at 50% damage.**

**Rationale:** The +1 hit to multi-hit is reduced (from +2) but the 15% proc on ALL attacks makes this consistently useful. On average, 1 in 7 attacks does a bonus half-hit. With multi-hit cards it's even better. Creates exciting "lightning proc" moments.

---

## Tier 6: Untestable Relics — Manual Balance Targets

These 13 relics can't be validated in headless sim. Here are target power levels based on their design intent:

| Relic | Target Tier | Balancing Note |
|-------|-------------|----------------|
| cartographers_lens | B | Foresight is powerful in practice — seeing 2 intents lets you plan shield/attack. No change needed, trust that manual testing will show B-tier value. |
| brain_booster | C | Free hints are nice QoL but shouldn't be combat-relevant. Fine as a "comfort" relic. |
| venom_fang | B | 1 poison/2 turns is weak. **Buff to 2 poison/2 turns** — needs to be felt. |
| executioners_axe | B | 40% threshold (up from 30%) should be noticeable. No change, but verify execute mechanic works. |
| time_dilation | B | +3s is significant on 5-7s timers. No change. |
| echo_lens | B | Full-power echoes (1.0x vs 0.7x) is strong for players who answer wrong often. No change. |
| polyglot_pendant | B | +25% to secondary domain is well-scoped. No change. |
| eidetic_memory | A | +30% for facts answered 3+ times is very strong mid-to-late run. **Monitor** — may need reduction to +20%. |
| speed_reader | A | Speed bonus at 15% of timer is extremely aggressive. Only the fastest readers benefit. **Monitor** — may be too niche. |
| domain_mastery | A | +100% to next card after 5 same-domain correct is huge but hard to trigger. No change. |
| gold_magnet | C | Economy only. Fine. |
| lucky_coin | C | Economy only. Fine. |
| scavengers_pouch | C | Economy only. **Buff: +2 currency per skip** (up from +1) to make skip-heavy strategies viable. |

---

## Synergy Cap System (New Mechanic)

To prevent the 4.05x glass_cannon + phase_cloak situation from recurring with future relics, introduce a **synergy cap rule**:

> **No combination of relic effects can reduce incoming damage by more than 50% total** (after all modifiers). This applies to: dodge chance, flat reduction, percentage reduction, and damage reflection combined.

Implementation: `relicEffectResolver.ts` calculates total damage mitigation % from all active relics before applying to incoming damage. Cap at 50%.

This is a safety valve, not a visible mechanic. Players never see the cap number. It just prevents "immortal" configurations from emerging.

---

## Critical Bug: relicEffectResolver.ts Not Wired In

The report notes that `relicEffectResolver.ts` (28 pure functions for all 50 relics) is **never imported by any src/ file**. Only ~12 relics work via hardcoded checks in `turnManager.ts` and `cardEffectResolver.ts`.

**This must be fixed before any balance changes matter.** All 50 relics need to flow through the centralized resolver. Without this, 76% of relics are cosmetic.

Priority: Wire `relicEffectResolver.ts` into the combat loop BEFORE implementing the balance changes above.

---

## Summary Table: All Changes

| Relic | Current | Proposed | Expected Impact |
|-------|---------|----------|-----------------|
| flame_brand | +50%/encounter | +40%/floor | 74% → ~18% |
| war_drum | +1 dmg/combo (uncapped) | +1 dmg/combo, cap +3 | 35% → ~12% |
| curiosity_gem | +20% Tier 1 | +15% Tier 1, max 3/encounter | 33% → ~14% |
| combo_ring | Start 1.15x | Start 1.10x | 24% → ~10% |
| swift_boots | +1 draw | +1 draw, unplayed cards → 1 block each | 0% → ~6% |
| afterimage | +1 draw next turn | +1 AP next turn (if 3 cards played) | 0% → ~10% |
| blood_price | +2 draw, -2 HP/turn | +1 draw, +1 AP, -3 HP/turn | ~0% → ~12% |
| double_vision | 0 AP first card | 0 AP + 25% effect first card | 0% → ~8% |
| quicksilver | No effect change | Cost 60 → 45 coins | unchanged |
| fortress_wall | Block carries | Block carries + 25% → damage/turn | 1.3% → ~7% |
| iron_resolve | <25% HP: 2x block | <40% HP: 1.5x block | 0% → ~5% |
| mirror_shield | Full absorb: 50% reflect | Any absorb: 20% reflect | 0% → ~4% |
| glass_cannon | +40% atk, +15% taken | +35% atk, +15% + 5%/miss taken | stays strong |
| phase_cloak + glass_cannon | 4.05x synergy | Dodge halved when glass_cannon active | ~2x synergy |
| scholars_hat | Correct: 1 HP | Correct: 2 HP, Wrong: 1 HP | 2% → ~8% |
| memory_palace | 3 streak → +3 dmg | 2 streak → +4 dmg | 6.8% → ~10% |
| barbed_edge | Strike-tag +3 dmg | Strike/Heavy +4, Heavy costs 1 AP | 0% → ~8% |
| phoenix_feather | 1/run resurrect | 1/boss resurrect | 0% → ~6% |
| renewal_spring | 10% HP/floor | 15% HP/floor, >80%→5 block | 0% → ~4% |
| chain_lightning_rod | Multi-hit +2 | Multi-hit +1, all attacks 15% bonus hit | 0% → ~6% |
| venom_fang | 1 poison/2t | 2 poison/2t | untestable |
| scavengers_pouch | +1 currency/skip | +2 currency/skip | economy only |
| **Soft enrage** | Turn 15+ → +3/turn | Turn 10+ → +2, Turn 15+ → +5 | systemic |
| **Synergy cap** | none | 50% max damage mitigation | systemic |

---

## Ascension Interaction Notes

The playtest report didn't account for ascension levels. Here's how these changes interact with relevant ascension modifiers:

| Ascension | Interaction with Rebalance |
|-----------|---------------------------|
| A1 (+10% enemy HP) | Nerfs to flame_brand/war_drum mean A1 actually feels harder now — good |
| A3 (heals -25%) | scholars_hat buff (2 HP) is reduced to 1.5 HP under A3 — still better than current |
| A9 (combo resets on turn end) | war_drum cap at +3 still applies; combo_ring start at 1.10x is less wasted when combo resets |
| A14 (max HP 70) | blood_price's -3 HP/turn is even more dangerous — proper cursed feeling |
| A16 (no echo) | echo_lens becomes dead relic at A16 — consider adding "A16: echo_lens grants +10% effect to Tier 1 cards instead" as a fallback |
| A17 (wrong = 5 self-dmg) | glass_cannon's stacking +5%/miss incoming damage compounds with self-damage — very punishing, as intended |

---

## Retest Protocol

After implementing these changes, rerun the 300-sim playtest with the same profiles and configurations. Target metrics:

| Metric | Current (Broken) | Target (Balanced) |
|--------|-----------------|-------------------|
| Max solo relic impact | 74.6% (flame_brand) | <20% |
| 3-starter expert survival | 100% at 100% HP | <70% survival, <70% HP |
| Cursed expert survival | 100% at 88% HP | <80% survival, <60% HP |
| Block stack synergy | -3.45x (anti-synergy) | >0.5x (mild synergy) |
| Draw relic average impact | 0% | >5% |
| Knowledge relic expert:beginner ratio | 6x | <3x |
| Game-breaking configs (of 100) | 5 | 0 |