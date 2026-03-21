# Recall Rogue — Final Expansion Production Spec

> **Status:** Production-ready for alpha implementation. Solo dev, week 3 of development. Ship everything at once — headless Haiku agents handle balance testing.
> **Existing card mechanics:** 31 (7 attack, 7 shield, 4 buff, 4 debuff, 6 utility, 3 wild)
> **New card mechanics:** 60 (14 attack, 8 shield, 8 buff, 7 debuff, 9 utility, 10 wild, 3 inscription, 1 X-cost — includes 8 filler cards. Signal Flare cut. Reshape cut — duplicates existing Transmute #27.)
> **Total card mechanics after expansion:** 91
> **Existing relics:** 41 (Echo Chamber removed from game)
> **New relics:** 36
> **Total relics after expansion:** 77
> **New status effects:** 2 (Burn, Bleed)
> **New card state:** Cursed (replaces old Echo system)
> **New card keyword:** Inscription (persistent in-combat effect)
>
> **COMBO SYSTEM REMOVED:** The combo system (comboCount, COMBO_MULTIPLIERS, COMBO_HEAL, COMBO_DECAY) has been fully removed from the game. Chains are the only streak mechanic.
>
> **IMPORTANT — Focus clarification:** The existing `focus` card mechanic (ID: `focus`, "Next card costs 1 less AP") is UNCHANGED and stays in the game. What was killed is a DESIGN CONCEPT for a "Focus" status effect that would dim quiz answers — this was never implemented in code. Do not touch the existing focus card.

---

## IMPLEMENTATION INDEX — For Claude Code Agents

This index tells you EXACTLY what to build, in what order, with file-level guidance. Read the relevant section of this doc before writing any code.

**CRITICAL — Every new card MUST have a `MASTERY_UPGRADE_DEFS` entry.** When implementing any card, add its mastery definition from Part 3 §3I to `MASTERY_UPGRADE_DEFS` in `mechanicData.ts` (or equivalent). This includes `perLevelDelta`, `maxMasteryLevel` (cap), `secondaryPerLevelDelta`, `apCostReductionAtLevels`, and `addTagAtLevel`. A card without mastery scaling is a broken card — the upgrade system is wired everywhere.

### Phase 0 — System Changes (MUST be done first, blocks everything else)

These are changes to existing systems, not new content. Do these before adding any new cards or relics.

| Task | What Changes | Files Affected | Doc Section |
|------|-------------|----------------|-------------|
| **0.1 — Kill Echo system** | Remove Echo card spawning, Echo visual state, Echo-only play restriction, `echo_lens` relic, `phantom_limb` relic. Remove all Echo constants (`ECHO.*`). | `cardEffectResolver.ts`, `turnManager.ts`, `cardStates.ts`, `relicEffectResolver.ts`, `relicData.ts`, Echo UI components | Part 1 §1C, Part 6, Appendix A |
| **0.2 — Implement Cursed Card system** | Track cursed facts via `cursedFactIds: Set<string>` on RunState. Wrong Charge on mastery 0 card → fact ID added to cursed set. Free First Charge wrongs are EXEMPT. Any card drawn with a cursed fact = Cursed visual + multipliers (QP 0.7×, CW 0.5×, CC 1.0× + cure removes fact from set). Meditate/shop card removal is freely allowed — removing a card slot does NOT remove the cursed fact from the pool (it will appear on other cards). Auto-cure safety valve at 60% threshold across 2 consecutive draws. | `runState.ts`, `cardEffectResolver.ts`, `turnManager.ts`, `drawHand()`, `balance.ts` | Part 1 §1C |
| **0.3 — Implement Cursed Card visuals** | Purple tint, cracked border, "cursed" shimmer CSS animation. Cure animation (purple cracks shatter, card glows gold briefly). | `CardHand.svelte`, `CardExpanded.svelte`, card CSS, `chainVisuals.ts` | Part 1 §1C |
| **0.4 — Add Burn status effect** | New debuff type. On-hit: deal bonus damage = stacks, then halve stacks. Halving rounds down. At 0, expire. Additive stacking. | `statusEffects.ts`, `cardEffectResolver.ts`, `combatSystem.ts`, status effect UI | Part 1 §1A |
| **0.5 — Add Bleed status effect** | New debuff type. On-damage: add +1 per stack to incoming damage. Decay by 1 at end of enemy turn. Does NOT deal damage on its own. | `statusEffects.ts`, `cardEffectResolver.ts`, `combatSystem.ts`, status effect UI | Part 1 §1B |
| **0.6 — Add Inscription keyword** | New card play type. Inscriptions exhaust on play and create a persistent effect for rest of combat. Track active inscriptions in `EncounterState`. | `cardMechanics.ts`, `cardEffectResolver.ts`, `turnManager.ts`, `encounterState.ts` | Part 3 §3G |
| **0.7 — Add card unlock gating** | Cards are gated by character level. `getUnlockedMechanics(level)` returns available mechanic IDs. Card reward pool, shop pool, and run pool builder must filter by unlocked mechanics. | `characterLevel.ts`, `cardPool.ts`, `shopService.ts`, `cardRewardService.ts` | Part 5 |
| **0.9 — Kill Combo System** | Remove `COMBO_MULTIPLIERS`, `COMBO_HEAL_*`, `COMBO_DECAY_*` constants and all `comboCount` tracking from `cardEffectResolver.ts`, `turnManager.ts`, `deckManager.ts`, `balance.ts`, and the combo counter UI component. Chains remain the only streak mechanic. | `cardEffectResolver.ts`, `turnManager.ts`, `deckManager.ts`, `balance.ts`, combo counter UI | Appendix E |
| **0.10 — Build shared card browser UI component** | Mid-combat card browser used by Tutor, Mimic CC, Scavenge, and Siphon Knowledge. Shared component: scrollable list of deck/discard cards with select action. Mobile-friendly. | `CardBrowser.svelte` (new), `CardHand.svelte`, Tutor/Mimic/Scavenge/Siphon Knowledge implementors | Part 3 §3E |

**Testing:** Run existing test suite + manual verification: (1) Echo system fully removed — no ghost cards spawn on wrong Charge, (2) Cursed system working — wrong Charge on mastery 0 adds fact to `cursedFactIds`, card shows purple tint, correct Charge cures, (3) Free First Charge wrong does NOT curse, (4) Burn/Bleed apply and resolve with correct math, (5) Inscriptions persist and exhaust, (6) Card unlock gating filters pool correctly, (7) Combo system fully removed — no comboCount in runtime state.
**Registry:** Update `data/inspection-registry.json` with: Cursed system entry, Burn status entry, Bleed status entry, Inscription keyword entry, card unlock gating entry. Remove Echo system entry.

### Phase 1 — Core Expansion Cards (18 new cards + 8 filler)

**Prerequisite:** Phase 0 complete (Burn, Bleed, Cursed system all working).

| Task | Cards | Type | Doc Section |
|------|-------|------|-------------|
| **1.1 — Filler cards** | Power Strike, Twin Strike, Iron Wave, Reinforce, Shrug It Off, Bash, Guard, Sap | attack/shield/debuff | Part 3 §3H |
| **1.2 — Bleed cards** | Rupture (A2), Lacerate (D1) | attack/debuff | Part 3 §3A, §3D |
| **1.3 — Burn cards** | Kindle (A4), Ignite (B1) | attack/buff | Part 3 §3A, §3C |
| **1.4 — Basic new cards** | Overcharge (A8), Riposte (A10), Absorb (S1), Reactive Shield (S2), Sift (U2), Scavenge (U1), Precision Strike (A12), Stagger (D6) | mixed | Part 3 various |
| **1.5 — Inscriptions (level 0)** | Inscription of Fury (I1), Inscription of Iron (I2) | inscription | Part 3 §3G |

**Validation gate:** All 27 new cards playable. Burn/Bleed apply and resolve correctly. Cursed facts tracked on wrong Charge (mastery 0) and cured on correct Charge. Free First Charge wrongs do NOT curse. Inscriptions persist for rest of combat and exhaust on play. All 27 cards have `MASTERY_UPGRADE_DEFS` entries and scale correctly (verify L0→L3 stat display shows green bonus).
**Testing:** Run `/headless-playtest` with all 6 profiles × 50 runs. Verify no crashes, Burn/Bleed/Cursed state integrity.
**Registry:** Update `data/inspection-registry.json` with all new mechanic IDs, status effect IDs, and Inscription keyword.

### Phase 2 — Identity Cards (16 new cards)

**Prerequisite:** Phase 1 complete.

| Task | Cards | Type | Doc Section |
|------|-------|------|-------------|
| **2.1 — Flagship quiz cards** | Gambit (A5), Curse of Doubt (D3), Unstable Flux (W9) | attack/debuff/wild | Part 3 §3A, §3D, §3F |
| **2.2 — Chain cards** | Chain Lightning (A6), Chain Anchor (W6) | attack/wild | Part 3 §3A, §3F |
| **2.3 — Exhaust cards** | Volatile Slash (A9), Burnout Shield (S5) | attack/shield | Part 3 §3A, §3B |
| **2.4 — Buff/debuff** | Warcry (B2), Battle Trance (B4), Mark of Ignorance (D4), Corroding Touch (D7) | buff/debuff | Part 3 §3C, §3D |
| **2.5 — Utility/wild** | Knowledge Ward (S4), Phase Shift (W2), Chameleon (W1), Dark Knowledge (W4) | shield/wild | Part 3 §3B, §3F |

**Validation gate:** All flagship cards working. Chain Lightning scales with chain length. Gambit HP swing works. Dark Knowledge damage scales with cursed fact count.
**Testing:** Run `/headless-playtest` focusing on Chain, Quiz Master, and Curse Weaponizer builds. Verify chain multiplier stacking, Gambit HP swing, Dark Knowledge scaling.
**Registry:** Update `data/inspection-registry.json` with all Phase 2 mechanic IDs.

### Phase 3 — Advanced Cards (18 new cards)

**Prerequisite:** Phase 2 complete.

| Task | Cards | Type | Doc Section |
|------|-------|------|-------------|
| **3.1 — Scaling cards** | Smite (A7), Feedback Loop (A11), Recall (A14) | attack | Part 3 §3A |
| **3.2 — Advanced utility** | Synapse (U7), Tutor (U5), Recollect (U6), Reflex (U10), Archive (U9), Siphon Knowledge (U3) | utility | Part 3 §3E |
| **3.3 — Advanced wild** | Catalyst (W5), Mimic (W8), Aftershock (W10), Sacrifice (W7) | wild | Part 3 §3F |
| **3.4 — Big-cost cards** | Bulwark (S3), Conversion (S6), Ironhide (S7), Hemorrhage (A3), Entropy (D5) | shield/attack/debuff | Part 3 §3B, §3A, §3D |
| **3.5 — Inscription of Wisdom** | Inscription of Wisdom (I3) — unlocks at level 1. (Fury and Iron shipped in Phase 1.) | inscription | Part 3 §3G |
| **3.6 — Special** | Eruption X-cost (A13), Knowledge Bomb (W3), Frenzy (B3), War Drum (B6), Mastery Surge (B5) | mixed | Part 3 various |

**Validation gate:** X-cost Charge interaction works (surcharge deducts from X). Inscriptions persist for rest of combat and exhaust. Knowledge Bomb CC scales with encounter correct Charge count.
**Testing:** Run `/headless-playtest` full campaign 200 runs × 6 profiles. Verify X-cost, Inscription persistence, Knowledge Bomb scaling. Check for crashes on all new card interactions.
**Registry:** Update `data/inspection-registry.json` with all Phase 3 mechanic IDs.
**Mobile UI note:** Tutor, Mimic, and Siphon Knowledge require mid-combat list/deck browsing UI — use the shared `CardBrowser.svelte` component built in Phase 0.10. Functional > pretty at alpha stage.

### Phase 4 — New Relics (36 relics across 3 sub-phases)

**Prerequisite:** Phase 1 complete (relics can ship in parallel with Phase 2-3 cards).

| Task | Relics | Count | Doc Section |
|------|--------|-------|-------------|
| **4.1 — Common + basic Uncommon** | Quick Study, Thick Skin, Tattered Notebook, Battle Scars, Brass Knuckles, Pocket Watch, Chain Link Charm, Worn Shield, Gladiator's Mark, Gambler's Token, Living Grimoire | 11 | Part 7 §7A, §7B |
| **4.2 — Build-defining Uncommon** | Bleedstone, Ember Core, Thoughtform, Scar Tissue, Surge Capacitor, Obsidian Dice | 6 | Part 7 §7B |
| **4.3 — Rare relics** | Red Fang, Chronometer, Soul Jar, Null Shard, Hemorrhage Lens, Archive Codex, Berserker's Oath, Chain Forge, Deja Vu, Inferno Crown, Mind Palace, Entropy Engine, Bloodstone Pendant, Chromatic Chain, Dragon's Heart | 15 | Part 7 §7C |
| **4.4 — Legendary + Cursed** | Omniscience, Paradox Engine, Akashic Record, Singularity, Volatile Manuscript | 5 | Part 7 §7D, §7E |

**Validation gate:** All relic triggers fire. Soul Jar GUARANTEED indicator appears on CHARGE button. Mind Palace streak persists across encounters with forgiveness window. Dragon's Heart triggers on elite/boss kills.
**Testing:** Run `/headless-playtest` with relic-focused profiles. Verify all `on_*` triggers fire correctly. Test Dragon's Heart on elite kill. Test Scar Tissue cursed multiplier override.
**Registry:** Update `data/inspection-registry.json` with all new relic IDs and trigger types.

### Phase 5 — Unlock Schedule + Balance Pass

| Task | What | Doc Section |
|------|------|-------------|
| **5.1 — Card unlock schedule** | Wire `getUnlockedMechanics()` to character level table | Part 5 |
| **5.2 — Relic unlock schedule** | Wire new relics into character level rewards table | Part 10 |
| **5.3 — Balance pass** | Run `/headless-playtest` full campaign 500 runs × 6 profiles. Check degenerate combo scorecard. Verify Chain Lightning cap, Hemorrhage scaling, Inscription stacking. | Part 11 |
| **5.4 — Update GAME_DESIGN.md** | Change "26 Active Mechanics" to "31 Active Mechanics (27 Phase 1 + 4 Phase 2)". Remove all Echo mechanic documentation (§11). Replace with Cursed Card system docs. Remove combo system docs. Remove Focus STATUS EFFECT concept references (the Focus CARD MECHANIC — ID `focus`, AP reduction — is unchanged and stays). | `GAME_DESIGN.md` | This entire doc |

**Testing:** Final full regression. All 91 cards playable. All 77 relics functional. No crashes across 3000 simulated runs.
**Registry:** Final update to `data/inspection-registry.json` — verify all mechanic IDs, relic IDs, status effects, and card unlock levels are registered.

### Migration Checklist — Existing Systems That Change

| System | Change | Breaking? |
|--------|--------|-----------|
| `cardEffectResolver.ts` | Add Burn/Bleed damage hooks, Cursed multiplier, Inscription persistence | YES — core combat loop |
| `turnManager.ts` | Remove Echo spawning. Add Cursed card creation on wrong Charge. | YES — turn resolution |
| `statusEffects.ts` | Add Burn, Bleed types + their tick/trigger behaviors | YES — new effect types |
| `relicEffectResolver.ts` | Remove `echo_lens`, `phantom_limb`. Add `scar_tissue` + all 36 new relic effects | YES — relic system |
| `relicData.ts` | Remove Echo Lens, Phantom Limb, Echo Chamber entries. Add 36 new relics. | YES — data |
| `cardMechanics.ts` / `mechanicData.ts` | Add 60 new mechanic definitions with all AP/QP/CC/CW values | YES — card definitions |
| `characterLevel.ts` | Add card unlock schedule + new relic unlock levels | Additive only |
| `balance.ts` | Remove COMBO_MULTIPLIERS, COMBO_HEAL_*, COMBO_DECAY_*. Add CURSED_*, BURN_*, BLEED_*, INSCRIPTION_*, SIPHON_STRIKE_MAX_HEAL. Change CURSED_AUTO_CURE_THRESHOLD to 0.6. | YES — combo removal |
| `deckManager.ts` | Remove comboCount tracking. Add cursedFactIds weighting to drawHand() fact selection. | YES — combo removal + cursed priority |
| `MeditateOverlay.svelte` | No changes needed for Cursed system — card slot removal is freely allowed (curse is on the fact, not the slot) | No change |
| `shopService.ts` | No Cursed-related changes — card removal purchase is freely allowed | No change |
| `cardPool.ts` / `runPoolBuilder.ts` | Filter available mechanics by character level | Additive |
| `CardHand.svelte` + card CSS | Add Cursed card visual state (purple tint, cracked border, shimmer) | Additive CSS |
| `GAME_DESIGN.md` | Major update: correct card count, replace Echo with Cursed, remove Focus status, remove combo system, add all new content | Documentation |

### New UI Components Required

The following UI components must be built as part of this expansion:

1. **Cursed card visuals** — purple tint, cracked border, shimmer animation, cure animation (purple cracks shatter → card glows gold briefly)
2. **Burn status icon** — orange flame with stack number
3. **Bleed status icon** — red droplet with stack number
4. **Inscription persistence indicators** — active inscription bar/icons visible during combat, showing which inscriptions are currently active
5. **Mid-combat card browser** (`CardBrowser.svelte`) — shared component for Tutor, Mimic CC, Scavenge, and Siphon Knowledge; scrollable list of deck/discard cards with select action; mobile-friendly
6. **Multi-choice popup** — for Unstable Flux CC and Phase Shift QP; choose from 2-4 effect options
7. **Soul Jar "GUARANTEED" button state** — layered with existing "FREE" state on the CHARGE button
8. **Exhaust pile viewer** — inspect what's been exhausted; needed for Recollect decisions

### Constants to Add (in `balance.ts` or equivalent)

```typescript
// Cursed Card System
CURSED_QP_MULTIPLIER = 0.7
CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0
CURSED_CHARGE_WRONG_MULTIPLIER = 0.5
CURSED_FSRS_CURE_BONUS = 6.0
CURSED_AUTO_CURE_THRESHOLD = 0.6  // 60% of hand cursed across 2 consecutive draws → auto-cure kicks in
CURSED_AUTO_CURE_COUNT = 1        // cure 1 oldest per encounter end
FREE_FIRST_CHARGE_EXEMPT_FROM_CURSE = true  // wrong on never-seen fact does NOT curse

// Burn Status
BURN_HALVE_ON_HIT = true
BURN_ROUND_DOWN = true

// Bleed Status
BLEED_BONUS_PER_STACK = 1
BLEED_DECAY_PER_TURN = 1

// Inscription
INSCRIPTION_EXHAUST_ON_PLAY = true

// X-Cost
X_COST_CHARGE_SURCHARGE_DEDUCTS_FROM_X = true

// Conversion Cap
CONVERSION_MAX_BLOCK_QP = 10
CONVERSION_MAX_BLOCK_CC = 15
CONVERSION_MAX_BLOCK_CW = 5

// Siphon Strike
SIPHON_STRIKE_MAX_HEAL = 10  // overkill heal capped at 10 HP

// AP Cap
// AP_HARD_CAP = none — no hard AP cap. AP can exceed MAX_AP_PER_TURN via card/relic effects (Sacrifice, Blood Price, etc.)

// Combo System — REMOVED
// COMBO_MULTIPLIERS, COMBO_HEAL_*, COMBO_DECAY_* have been deleted. Do not re-add.
```

## PART 1: STATUS EFFECTS — Final Designs

### 1A. Burn (NEW — Hit Amplifier)

**Identity:** Burst damage amplifier. Front-loaded, consumed quickly.

| Property | Value |
|----------|-------|
| Type | Debuff (applied to enemy) |
| Application | Via Kindle, Ignite, Entropy cards |
| Behavior | When target is HIT by any attack, Burn deals bonus damage equal to current stacks, then halves (round down). At 0, Burn expires. |
| Stacking | Additive (6 Burn + 4 Burn = 10 Burn) |
| Icon | Orange flame with number |

**Example:** Enemy has 8 Burn. You hit with Strike (8 dmg) → 8 + 8 Burn bonus = 16 total. Burn halves to 4. Next hit triggers +4, halves to 2. Then +2 → 1 → 0 → gone. Total Burn damage from 8 stacks across 4 hits: 8+4+2+1 = 15.

**Why distinct from Poison:** Poison ticks passively (damage even if you don't attack). Burn requires you to ATTACK to trigger it. Burn rewards aggression. Poison rewards patience.

**Block interaction:** Burn bonus damage is added to the attack's total damage before block is applied. Block absorbs the combined total (base attack + Burn bonus). Burn works like Strength — it amplifies the hit, not a separate damage instance.

### 1B. Bleed (NEW — Persistent Amplifier)

**Identity:** Persistent damage amplifier. Stays around, small per-hit bonus.

| Property | Value |
|----------|-------|
| Type | Debuff (applied to enemy) |
| Application | Via Rupture, Lacerate, Hemorrhage cards |
| Behavior | Each time target takes damage from a card play, Bleed adds +1 bonus damage per stack. Stacks decay by 1 at end of enemy turn (like Poison timing). Bleed does NOT deal damage on its own. |
| Stacking | Additive |
| Icon | Red droplet with number |

**Example:** Enemy has 5 Bleed. You hit 3 times (Multi-Hit): each hit deals +5 bonus = +15 total Bleed damage. At enemy turn end, Bleed decays to 4. Next turn, each hit deals +4 per.

**Why distinct from Burn:** Burn is consumed by hits (big front-load, disappears fast). Bleed persists across turns (small per-hit, lasts longer). Burn = burst window. Bleed = sustained amplification.

**Block interaction:** Bleed bonus damage is added to the incoming damage total before block is applied. Block absorbs the combined total. Bleed only triggers on damage from CARD PLAYS — it does NOT trigger on passive damage sources (Poison ticks, Thorns reflect, Burn damage).

### 1C. Cursed Cards (Replaces Old Echo System)

**Identity:** Failed knowledge weakens your cards until you prove you've learned.

The old Echo system (ghost cards that exhaust on second fail) was broken in two ways: (1) players could intentionally fail cards they didn't want, exploiting it as free deck thinning, and (2) cards players struggled with got REMOVED, preventing them from ever learning. The Cursed Card system fixes both.

| Property | Value |
|----------|-------|
| Trigger | Wrong Charge answer on a mastery 0 card |
| What gets cursed | The **FACT** (not the card slot). Tracked via `cursedFactIds: Set<string>` on RunState. |
| Effect | Any card drawn with a cursed fact shows as Cursed — weakened visuals and multipliers |
| Cursed QP | 0.7× base power |
| Cursed Charge Correct | 1.0× (normal, not boosted — the "reward" is curing the curse) |
| Cursed Charge Wrong | 0.5× base power |
| Cure | Charge Correct on a card carrying the cursed fact → fact removed from `cursedFactIds` → card returns to normal |
| Removal | Card slots can be freely removed via Meditate or shop. Removing a slot does NOT remove the cursed fact from `cursedFactIds` — the fact stays in the pool and will appear on other card slots. Deck thinning doesn't help you escape curses. |
| FSRS | Normal FSRS tracking on all Cursed card interactions. Double FSRS credit on cure (correct Charge on Cursed fact). |
| Visual | Semi-transparent purple tint, cracked border, faint "cursed" shimmer. Clearly distinct from normal cards. |
| Max per run | No cap (you can have as many cursed facts as you fail) |

**Fact-based, not slot-based:** Because facts rotate per draw (the same card slot gets a different question each hand), curses follow the FACT, not the slot. If you fail "Capital of Peru?", then ANY card that gets assigned that fact on future draws will be Cursed. You cure it by answering "Lima" correctly on any card. This is educationally correct — the thing you failed is the thing that's weak.

**For mastery 1+ cards:** Wrong Charge does NOT create a cursed fact — it simply downgrades mastery by 1 level (existing system). You already invested in learning this fact; the downgrade IS the punishment.

**Why this works:**
- **Anti-exploit:** Intentionally failing a fact doesn't thin your deck — the fact stays in the pool AND weakens every card it touches. Intentional fails make your deck WORSE.
- **Pro-learning:** The fact you failed keeps appearing. You'll see it again. And again. Until you answer correctly. That IS spaced repetition.
- **Meaningful weakness:** 0.7× QP and 0.5× CW makes Cursed cards genuinely bad to have. Players feel the punishment and are motivated to cure them.
- **Cure is rewarding:** Charging a Cursed card and getting it right feels like redemption. The card snaps back to full power. Double FSRS credit makes the learning impact real.
- **Natural difficulty scaling:** Struggling players accumulate cursed facts → more cursed cards per hand → weaker deck → harder fights → but also more exposure to failed facts → eventual learning.

**Cursed card example flow:**
1. Player draws Strike paired with "What is the capital of Peru?"
2. Player Charges, answers "Santiago" (wrong). Fact is mastery 0 → "Peru" fact ID added to `cursedFactIds`.
3. Next draw, a Block card happens to get assigned the "Peru" fact → that Block shows Cursed visuals. QP deals 4.2 block instead of 6.
4. Player Charges the Cursed Block, answers "Lima" (correct). "Peru" removed from `cursedFactIds`. Card cured! Double FSRS credit.
5. Next time "Peru" appears on any card, it's normal again. Player has been tested twice under emotional stakes.

### Cursed Card Interactions with Other Mechanics

| Mechanic | Interaction |
|----------|------------|
| Mastery Upgrade System | Cards carrying cursed facts are at effective mastery 0 and cannot upgrade UNTIL the fact is cured. Cure restores normal mastery tracking. |
| Fact Rotation / Draw | Curse follows the fact. `drawHand()` checks each assigned fact against `cursedFactIds` and sets the card's cursed visual flag accordingly. Cursed facts have weighted priority — higher chance to appear in draws (not guaranteed). |
| Card Rewards / Shop | Cursed status is on the fact, not the card slot. Removing a card slot doesn't remove the cursed fact from the pool — it can appear on other cards. |
| Meditate / Card Removal | Freely allowed. Removing a card slot does NOT remove the cursed fact from `cursedFactIds` — the fact stays in the pool and will appear on other cards. Deck thinning doesn't help you escape curses. |
| Rest Site Study | Study CANNOT cure cursed facts (only raises mastery, and cursed facts can't gain mastery). You must cure in combat. |
| Recollect (exhaust recovery) | Cursed cards cannot be exhausted. Recollect doesn't interact. |
| Existing Transmute (#27) | Transmuting a card with a cursed fact replaces the card — but the cursed fact remains in the pool. It will appear on future draws. |
| Inscription cards | Inscriptions exhaust on play. If a Cursed Inscription is played (QP at 0.7×), the persistent effect is at 0.7× power for rest of combat. |
| Encounter cooldown | Cursed facts are EXEMPT from the 3-5 encounter cooldown. They can reappear sooner, giving more opportunities to cure. |

**Constants:** `CURSED_QP_MULTIPLIER = 0.7`, `CURSED_CHARGE_WRONG_MULTIPLIER = 0.5`, `CURSED_CHARGE_CORRECT_MULTIPLIER = 1.0`, `CURSED_FSRS_CURE_BONUS = 6.0`

---

## PART 2: QUIZ INTEGRITY AUDIT

Every mechanic that touches the quiz system, evaluated for whether it breaks learning:

| Mechanic | Quiz Impact | Verdict |
|----------|-------------|---------|
| **Cursed Cards** (system) | Failed facts stay in deck as weakened cards, cured by correct Charge | SAFE — reinforces learning, punishes failure, rewards redemption |
| **Siphon Knowledge** (card) | Draw cards + briefly see their quiz answers | SAFE — costs AP, temporary, requires memorization |
| **Insight Prism** (relic) | Wrong Charge → next same-fact auto-succeeds | SAFE — one-time per fact per run, corrective |
| **Soul Jar** (relic) | Bank auto-correct charges from streaks | SAFE — player chooses when, limited charges |
| **Omniscience** (relic) | 3 correct in turn → 4th auto-succeeds | SAFE — requires 3 genuine correct first |
| **Akashic Record** (relic) | Hints on Tier 2b+ facts | SAFE — only helps with already-learned facts |
| **Chronometer** (relic) | +3s timer, -15% Charge multiplier | SAFE — accessibility tradeoff, reduces power |
| **Time Warp** (relic) | Surge: timer halved, 5.0× multiplier | SAFE — makes quiz HARDER for bigger reward |
| **Frenzy** (card) | Next 2 cards cost 0 AP including Charge surcharge | SAFE — removes AP cost, not quiz. You still answer. |
| **Free First Charge** (system) | First Charge of any fact = 0 AP surcharge, wrong = 0.0× fizzle. **EXEMPT from cursing** — guessing wrong on an unknown fact should not corrupt your deck. The fizzle is punishment enough. | SAFE — encourages trying new facts |
| **Mastery Level 5** | Auto-play, no quiz | SAFE — requires extensive correct answering to reach |
| **Paradox Engine** (relic) | Wrong = 0.3× + 5 piercing | SAFE (after fix) — wrong is always worse than QP |

**Red flags found:** NONE after fixes. The quiz system's integrity is maintained because:
1. No mechanic removes the quiz entirely (except Tier 3 mastery, which is earned)
2. No mechanic makes wrong answers better than Quick Play (except Paradox Engine pre-fix)
3. NOTHING touches the quiz UI (no dimming, no removing answers, no hints on the question itself)

---

## PART 3: COMPLETE CARD CATALOGUE — All New Mechanics with AP Costs

### Legend
- **QP** = Quick Play (1.0× base, no quiz)
- **CC** = Charge Correct (multiplied, values shown at Tier 2a / mastery 0)
- **CW** = Charge Wrong (0.7× Tier 2a)
- **Pool** = max copies in any run's card pool
- **Unlock** = character level required (0 = always available)

---

### 3A. NEW ATTACK CARDS (14)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| A1 | **Siphon Strike** | 1 | 6 dmg, heal max(2, min(overkill, 10)) | 18 dmg, heal max(2, min(overkill, 10)) | 4 dmg | 2 | 3 | Heal = damage exceeding enemy's remaining HP, minimum 2, maximum 10. Always heals at least 2 even on non-lethal hits. Distinct from Lifetap (percentage heal). |
| A2 | **Rupture** | 1 | 5 dmg + 3 Bleed | 15 dmg + 8 Bleed | 3.5 dmg + 2 Bleed | 2 | 4 | Primary Bleed applicator. |
| A3 | **Hemorrhage** | 2 | 4 + (4 per Bleed stack), consume all | 4 + (6 per Bleed), consume all | 4 + (2 per Bleed) | 1 | 7 | Always has 4 base damage even at 0 Bleed. Bleed finisher. |
| A4 | **Kindle** | 1 | 4 dmg + 4 Burn (hit triggers 4 immediately, Burn→2) | 8 dmg + 8 Burn (triggers 8, Burn→4) | 3 dmg + 2 Burn | 2 | 5 | Burst + lingering. Self-triggering Burn applicator. |
| A5 | **Gambit** | 1 | 10 dmg, lose 2 HP | 30 dmg, heal 5 HP | 7 dmg, lose 5 HP | 1 | 6 | **FLAGSHIP.** HP swing based on knowledge. |
| A6 | **Chain Lightning** | 2 | 8 dmg | 8 × chain length (CC) | 5 dmg | 1 | 8 | Base 8 even without chain. At 5-chain CC: 8×5 = 40 × 3.0 chain mult = 120. THE chain payoff. |
| A7 | **Smite** | 2 | 10 dmg | 10 + (3 × avg hand mastery) | 7 dmg | 1 | 9 | Rewards broad mastery across deck. |
| A8 | **Overcharge** | 1 | 6 dmg | 6 + (2 per Charge played this encounter) | 4 dmg | 2 | 5 | Scales over encounter. Counts all Charges (correct or wrong). |
| A9 | **Volatile Slash** | 1 | 10 dmg | 30 dmg, EXHAUST | 7 dmg | 2 | 7 | Exhaust-on-Charge. Repeatable QP or one-shot burst. |
| A10 | **Riposte** | 1 | 5 dmg + 4 block | 15 dmg + 12 block | 3.5 dmg + 3 block | 2 | 3 | Hybrid attack/shield. Always draftable. |
| A11 | **Feedback Loop** | 1 | 5 dmg | 20 dmg | 0 dmg (total fizzle) | 1 | 10 | QP = weak but real. CW = complete fizzle. High-stakes Charge card. |
| A12 | **Precision Strike** | 1 | 8 dmg | 24 dmg | 5 dmg | 2 | 4 | **Passive: This card's Charge timer is +50% longer.** Reliable Charge card. Renamed "Deliberate Strike." |
| A13 | **Eruption (X-cost)** | X | 8 dmg per AP spent | 12 dmg per AP spent | 5 dmg per AP spent | 1 | 12 | X = all remaining AP. Charge surcharge reduces X pool. So 4 AP total → 1 surcharge + 3 AP into damage = 36 CC. |
| A14 | **Recall** | 1 | 1 dmg per card in discard pile | 2 per card in discard | 0.5 per card | 1 | 11 | Late-fight nuke. At 15 cards in discard = 30 CC damage. |

### 3B. NEW SHIELD CARDS (8)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| S1 | **Absorb** | 1 | 5 block | 5 block + draw 1 | 3 block | 2 | 4 | Defensive cantrip. Block + cycling on CC. |
| S2 | **Reactive Shield** | 1 | 4 block + 2 Thorns (1t) | 12 block + 5 Thorns (2t) | 3 block + 1 Thorns (1t) | 2 | 5 | Thorns-based, no new "counter" mechanic. |
| S3 | **Bulwark** | 3 | 18 block | 36 block, EXHAUST | 10 block | 1 | 9 | Emergency mega-block. Exhaust prevents spamming. |
| S4 | **Knowledge Ward** | 1 | 4 block per unique domain in hand | Same × 1.5 | Same × 0.7 | 1 | 6 | Domain diversity reward. 4 domains = 16 QP block. |
| S5 | **Burnout Shield** | 1 | 8 block | 24 block, EXHAUST | 5.6 block | 2 | 7 | Mirror of Volatile Slash. Exhaust-on-Charge for shields. |
| S6 | **Conversion** | 1 | Convert up to 10 block into damage | Convert up to 15 block | Convert up to 5 block | 1 | 10 | Cap = 15 (matches Aegis Stone). You lose converted block. |
| S7 | **Ironhide** | 2 | 6 block + 1 Strength (this turn) | 6 block + 1 Strength (permanent) | 4 block | 1 | 8 | Reduced from +2 permanent to +1. Still snowballs, just slower. |
| S8 | **Aegis Pulse** | 1 | 5 block | 5 block + all same-chain cards in hand gain +2 block value this turn | 3 block | 2 | 6 | Chain synergy for defense. Replaces cut Echo Guard. |

### 3C. NEW BUFF CARDS (8)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| B1 | **Ignite** | 1 | Next attack applies 4 Burn | Next attack applies 8 Burn | Next attack applies 2 Burn | 2 | 5 | Burn setup buff. |
| B2 | **Warcry** | 1 | +2 Strength (this turn) | +2 Strength (permanent) + next Charge this turn costs +0 AP | +1 Strength (this turn) | 1 | 6 | Absorbs cut Concentration's niche (free follow-up Charge). |
| B3 | **Frenzy** | 2 | Next 2 cards cost 0 AP (including Charge surcharge) | Next 3 cards cost 0 AP (including surcharge) | Next 1 card costs 0 AP | 1 | 10 | Explicitly: Charge surcharge waived on free plays. |
| B4 | **Battle Trance** | 1 | Draw 3, can't play more cards this turn | Draw 3, no restriction | Draw 2, can't play more | 1 | 7 | STS adaptation. Draw restriction removed on CC. Blocks both playing AND Charging for rest of turn on QP/CW. |
| B5 | **Mastery Surge** | 1 | +1 mastery to 1 random card in hand | +1 mastery to 2 random cards in hand | No mastery change | 1 | 11 | Reduced from "all cards" to 1-2. Still strong. Wasted on cursed cards — cursed facts are locked at effective mastery 0. |
| B6 | **War Drum** | 1 | All cards in hand +2 base effect this turn | All cards +4 base effect | All cards +1 base effect | 1 | 8 | Universal hand buff. Replaces cut Resonance. |
| B7 | **Inscription of Fury** | 2 | All attacks +2 dmg rest of combat | All attacks +4 dmg rest of combat | All attacks +1 dmg rest of combat | 1 | 0 | **INSCRIPTION (persistent).** Available from start. Build-defining crystallization moment. |
| B8 | **Inscription of Iron** | 2 | Start each turn with 3 block rest of combat | Start with 6 block | Start with 1 block | 1 | 0 | **INSCRIPTION (persistent).** Available from start. Defines defensive identity. |

### 3D. NEW DEBUFF CARDS (7)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| D1 | **Lacerate** | 1 | 4 dmg + 4 Bleed | 12 dmg + 8 Bleed | 3 dmg + 2 Bleed | 2 | 4 | Primary Bleed applicator with attack damage. |
| D2 | **Corrode** | 1 | Remove 5 enemy block + 1t Weakness | Remove all block + 2t Weakness | Remove 3 block + 1t Weakness | 1 | 5 | Anti-tank. |
| D3 | **Curse of Doubt** | 1 | Enemy takes +30% dmg from Charged attacks (2t) | +50% from Charges (3t) | +20% from Charges (1t) | 1 | 6 | **FLAGSHIP.** Quiz-specific debuff. |
| D4 | **Mark of Ignorance** | 1 | Enemy takes +3 flat dmg from Charged attacks only (2t) | +5 flat from Charges (3t) | +2 flat from Charges (1t) | 1 | 8 | Companion to Curse of Doubt. Flat + percentage = deadly combo. |
| D5 | **Entropy** | 2 | Apply 3 Burn + 2 Poison (2t) | Apply 6 Burn + 4 Poison (3t) | Apply 2 Burn + 1 Poison (1t) | 1 | 9 | Dual DoT. Cut Bleed from original (too many effects). |
| D6 | **Stagger** | 1 | Skip enemy's next action | Skip + 1t Vulnerable | Skip only | 1 | 3 | Tempo card. CC adds offensive setup. Enemy turn counter advances (enrage ticks) but the action is skipped. |
| D7 | **Corroding Touch** | 0 | Apply 2 Weakness (1t) | Apply 3 Weakness (2t) + 2 Vulnerable (1t) | Apply 1 Weakness (1t) | 2 | 7 | 0-cost debuff. Charge costs 1 AP (surcharge). |

### 3E. NEW UTILITY CARDS (9)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| U1 | **Scavenge** | 1 | Put 1 card from discard on top of draw pile | Put 2 on top | Put 1 on top | 2 | 4 | STS Headbutt style. Get the card next turn. |
| U2 | **Sift** | 1 | Look at top 3 draw pile, discard 1 | Look at top 5, discard 2 | Look at top 2, discard 1 | 2 | 3 | Scry mechanic. Renamed from "Foresee" to avoid collision with existing Foresight (#26). |
| U3 | **Siphon Knowledge** | 2 | Draw 2 + see their quiz answers for 3s | Draw 3 + see answers for 5s | Draw 1 + see answers for 2s | 1 | 9 | **FLAGSHIP.** "Study during combat." |
| U4 | **Swap** | 0 | Discard 1, draw 1 | Discard 1, draw 2 | Discard 1, draw 1 | 2 | 2 | 0-cost cycling. Charge costs 1 AP. |
| U5 | **Tutor** | 1 | Search deck for any card, add to hand | Search + that card costs 0 AP this turn | Search deck, add to hand | 1 | 11 | Tutoring is always powerful. |
| U6 | **Recollect** | 1 | Return 1 exhausted card to discard pile | Return 2 exhausted cards | Return 1 | 1 | 8 | Exhaust recovery. Enables Volatile Slash/Burnout Shield loops. Inscriptions are "remove from game" on exhaust — cannot be Recollected. |
| U7 | **Synapse** | 1 | Draw 2 | Draw 2, your next card play counts as matching previous card's chain type | Draw 1 | 1 | 10 | Wildcard chain link. Simplified from original. YES extends chain count by 1 (wildcard matches any chain type). |
| U9 | **Archive** | 1 | Retain 1 card in hand (doesn't discard at turn end) | Retain 2 cards | Retain 1 card | 2 | 5 | Combo setup. Save key cards for next turn. |
| U10 | **Reflex** | 1 | Draw 2 | Draw 3 | Draw 1 | 2 | 6 | **Passive: When discarded from hand (ANY discard — end of turn, Swap, Transmute, etc.), gain 3 block.** A card that rewards NOT playing it. 2 Reflex discarded in one turn = 6 block total, applied before enemy turn. |

### 3F. NEW WILD CARDS (10)

| # | Name | AP | QP | CC | CW | Pool | Unlock | Notes |
|---|------|----|----|----|----|------|--------|-------|
| W1 | **Chameleon** | 1 | Copy last card effect at 1.0× | Copy at 1.3× + inherit chain type | Copy at 0.7× | 1 | 6 | Chain-aware copy. Copies BASE mechanic values, applies own multipliers. Different from Mirror (generic copy). |
| W2 | **Phase Shift** | 1 | Choose: 8 dmg OR 8 block | 12 dmg AND 12 block | Choose: 4 dmg OR 4 block | 1 | 7 | Per-play modal. No stance system needed. QP intentionally lower than Iron Wave (12+12 vs 15+15) — choice mode is the tradeoff. |
| W3 | **Knowledge Bomb** | 2 | 4 dmg | 4 dmg per correct Charge made this encounter (single quiz) | 4 dmg | 1 | 13 | CC costs 3 AP total. Scales with cumulative quiz performance. At 6 correct Charges this encounter = 24 CC dmg. Knowledge Bomb's own correct Charge counts toward the total. No multi-quiz tedium. |
| W4 | **Dark Knowledge** | 1 | Deal 3 dmg per cursed fact you have | Deal 5 dmg per cursed fact | Deal 1 dmg per cursed fact | 1 | 8 | Counts cursed facts at play time (snapshot), not resolve time. Turns failures into a weapon WITHOUT curing them. More curses = bigger nuke. Unique decision: cure curses for healthier deck, or keep them for Dark Knowledge damage. |
| W5 | **Catalyst** | 1 | Double all Poison on enemy | Double Poison + double Burn | Double Poison only | 1 | 10 | STS classic. CC adds Burn doubling. |
| W6 | **Chain Anchor** | 1 | Draw 1 | Set chain to 2 + draw 1 | Draw 1 | 1 | 9 | Chain starter. QP = cycle (never dead). Chain Anchor itself is not a chain link — it sets the next same-chain card's starting length to 2. |
| W7 | **Sacrifice** | 0 | Lose 5 HP, draw 2, gain 1 AP | Lose 5 HP, draw 3, gain 2 AP | Lose 5 HP, draw 1, gain 1 AP | 1 | 8 | STS Offering. Always costs HP. AP gain from Sacrifice can push past MAX_AP_PER_TURN (no hard cap). |
| W8 | **Mimic** | 1 | Random card from discard pile at 0.8× | Choose card from discard at 1.0× | Random at 0.5× | 1 | 11 | Discard pile toolbox. CC = agency. Copies BASE mechanic values, applies own multipliers. |
| W9 | **Unstable Flux** | 1 | Random effect (dmg OR block OR draw OR debuff) at 1.0× | CHOOSE which effect at 1.5× | Random at 0.7× | 1 | 6 | **FLAGSHIP.** "Knowledge gives control over chaos." |
| W10 | **Aftershock** | 1 | Repeat last Quick Played card's effect at 0.5× | Repeat last Charged card's effect at 0.7× (no quiz) | Repeat last played at 0.3× | 1 | 10 | Mode-aware copy. Copies BASE mechanic values, applies own multipliers. Current turn only — does not remember across turns. Replaces cut Wildfire. |

### 3G. INSCRIPTION CARDS (Persistent — New Keyword) (3)

Inscriptions are played once and persist for the rest of combat. They exhaust on play (can't be re-drawn). They occupy the buff/power design space that was completely missing.

| # | Name | AP | QP Effect (rest of combat) | CC Effect (rest of combat) | CW Effect | Pool | Unlock |
|---|------|----|----|----|----|------|--------|
| I1 | **Inscription of Fury** | 2 | All attacks +2 dmg | All attacks +4 dmg | All attacks +1 dmg | 1 | 0 |
| I2 | **Inscription of Iron** | 2 | Start each turn with 3 block | Start with 6 block | Start with 1 block | 1 | 0 |
| I3 | **Inscription of Wisdom** | 2 | Charged correct answers draw 1 extra card | CC draws 1 extra + heals 1 HP | No inscription (fizzle) | 1 | 1 |

**Design note:** Inscriptions CW should always be dramatically worse than QP to create real stakes. Inscription of Wisdom specifically FIZZLES on wrong (0 persistent effect) — you waste 3 AP on nothing. High risk, high reward. Multiple same-type Inscriptions cannot stack (Pool = 1 per type, removed from game on exhaust).

**Inscription application points:** Fury flat bonus is applied in damage calc step. Iron block is added at player turn start. Wisdom triggers on CC resolution.

### 3H. "BORING BUT NECESSARY" FILLER CARDS (8)

These are slightly-upgraded basics. Not exciting. Not build-around. Just reliable cards that new players want to draft and experienced players take when nothing better shows up. Every roguelite needs these — STS has Iron Wave, Sword Boomerang, Twin Strike, Shrug It Off.

| # | Name | Type | AP | QP | CC | CW | Pool | Unlock | Why It Exists |
|---|------|------|----|----|----|----|----|--------|-------|
| F1 | **Power Strike** | Attack | 1 | 10 dmg | 30 dmg | 7 dmg | 3 | 0 | Strike but +2 base. The first "is this better than Strike?" decision. |
| F2 | **Twin Strike** | Attack | 1 | 5×2 (10 total) | 15×2 (30 total) | 3.5×2 | 2 | 2 | Two hits. Weaker per-hit but triggers Bleed/Burn twice. |
| F3 | **Iron Wave** | Attack | 1 | 5 dmg + 5 block | 15 dmg + 15 block | 3.5 dmg + 3.5 block | 2 | 0 | Hybrid. Worse than dedicated Strike or Block, but does both. Always pickable. |
| F4 | **Reinforce** | Shield | 1 | 8 block | 24 block | 5.6 block | 3 | 0 | Block but +2 base. Direct upgrade to starter Block. |
| F5 | **Shrug It Off** | Shield | 1 | 6 block + draw 1 | 18 block + draw 1 | 4 block | 2 | 2 | Block + cantrip. The "I need block AND I need to cycle" card. |
| F6 | **Bash** | Attack | 2 | 10 dmg + 1t Vulnerable | 30 dmg + 2t Vulnerable | 7 dmg + 1t Vulnerable | 2 | 1 | Attack + setup. Every run wants this card. |
| F7 | **Guard** | Shield | 2 | 14 block | 42 block | 10 block | 2 | 1 | Big block for 2 AP. Simple, efficient, boring, necessary. |
| F8 | **Sap** | Debuff | 1 | 3 dmg + 1t Weakness | 9 dmg + 2t Weakness | 2 dmg + 1t Weakness | 2 | 1 | Weak attack + defensive debuff. Always useful early game. |

---

### 3I. MASTERY UPGRADE DEFINITIONS — All New Cards

Every card needs a `MASTERY_UPGRADE_DEFS` entry. Mastery levels 0-5: each correct Charge in an encounter = +1 level, wrong = -1 level (once per encounter). Level 5 = auto-play, no quiz (except boss). Stat display shows "base+bonus" with bonus in green.

**Cap rules:**
- **Cap 5 (default):** Simple stat-scaling cards. Most attacks, shields, filler.
- **Cap 3:** Complex mechanics, snowball effects, 0-cost cards, anything that would be degenerate at +5 levels. These are capped because the level 3 bonus tag is their payoff — going further would break balance.

**Level 3 bonus tag:** Some cards gain a qualitative bonus at level 3 (extra draw, chain inheritance, etc.) instead of just more numbers. This is the "mastery reward" that makes leveling these cards feel meaningful beyond stat bumps.

#### ATTACKS

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `siphon_strike` | Siphon Strike | 5 | +1 dmg | — | Min heal → 3, max heal cap 10 | 6→11 dmg |
| `rupture` | Rupture | 5 | +1 dmg, +1 Bleed | — | — | 5+3→10+8 |
| `hemorrhage` | Hemorrhage | 5 | +1 base dmg | — | — | 4 base→9 base (+ Bleed scaling unchanged) |
| `kindle` | Kindle | 5 | +1 dmg, +1 Burn | — | — | 4+4→9+9 |
| `gambit` | Gambit | 5 | +2 dmg | — | Self-damage reduced by 1 | 10→20 dmg (self-dmg: 2→1 at L3) |
| `chain_lightning` | Chain Lightning | 5 | +1 base dmg (multiplied by chain) | — | — | 8→13 base (×chain length on CC) |
| `smite` | Smite | 5 | +2 dmg | — | — | 10→20 base (+ mastery avg bonus unchanged) |
| `overcharge` | Overcharge | 5 | +1 dmg | — | — | 6→11 base (+ per-Charge scaling unchanged) |
| `volatile_slash` | Volatile Slash | 5 | +2 dmg | — | — | 10→20 dmg (still exhausts on CC) |
| `riposte` | Riposte | 5 | +1 dmg, +1 block | — | — | 5+4→10+9 |
| `feedback_loop` | Feedback Loop | 3 | +2 dmg (QP), +4 dmg (CC) | — | QP also applies 1 Weakness | 5→11 QP, 20→32 CC |
| `precision_strike` | Precision Strike | 5 | +2 dmg | — | Timer bonus increases to +75% | 8→18 dmg |
| `eruption` | Eruption (X) | 3 | +1 per-AP dmg | — | — | 8/AP→11/AP (QP), 12/AP→15/AP (CC) |
| `recall` | Recall | 5 | +0.2 per-discard dmg | — | L3: also draws 1 | 1/card→2/card QP |

#### SHIELDS

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `absorb` | Absorb | 5 | +1 block | — | CC also draws 2 instead of 1 | 5→10 block |
| `reactive_shield` | Reactive Shield | 5 | +1 block | +1 Thorns at L3 | L3: +1 Thorns base | 4+2→9+3 |
| `bulwark` | Bulwark | 3 | +3 block | — | — | 18→27 block (still exhausts) |
| `knowledge_ward` | Knowledge Ward | 5 | +1 per-domain block | — | — | 4/domain→9/domain |
| `burnout_shield` | Burnout Shield | 5 | +2 block | — | — | 8→18 block (still exhausts on CC) |
| `conversion` | Conversion | 3 | +2 cap | — | — | 10 cap→16 cap QP, 15→21 CC |
| `ironhide` | Ironhide | 3 | +1 block | — | L3: QP also gives +1 permanent Str | 6→9 block |
| `aegis_pulse` | Aegis Pulse | 5 | +1 block | — | L3: chain buff = +3 instead of +2 | 5→10 block |

#### BUFFS

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `ignite` | Ignite | 5 | +1 Burn applied | — | — | 4→9 Burn on next attack |
| `warcry` | Warcry | 3 | — | — | L3: QP also gives +1 permanent Str | +2 Str (this turn) unchanged, L3 tag is the reward |
| `frenzy` | Frenzy | 3 | — | — | L3: QP frees 3 cards instead of 2 | No stat scaling, tag-based |
| `battle_trance` | Battle Trance | 3 | +1 draw at L3 | — | L3: QP draws 4 (still restricted) | 3 draw→4 draw |
| `mastery_surge` | Mastery Surge | 3 | — | — | L3: QP upgrades 2 cards instead of 1 | Tag-based |
| `war_drum` | War Drum | 5 | +1 base effect buff | — | — | +2→+7 to all cards in hand |
| `inscription_fury` | Inscription of Fury | 5 | +0.5 atk bonus (rounded) | — | — | +2→+4 atk rest of combat (QP) |
| `inscription_iron` | Inscription of Iron | 5 | +0.5 block bonus (rounded) | — | — | +3→+5 block/turn rest of combat (QP) |

#### DEBUFFS

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `lacerate` | Lacerate | 5 | +1 dmg, +1 Bleed | — | — | 4+4→9+9 |
| `corrode` | Corrode | 5 | +1 block removal | — | L3: Weakness duration +1t | 5→10 block removed |
| `curse_of_doubt` | Curse of Doubt | 5 | +5% Charge damage bonus | — | — | +30%→+55% from Charges |
| `mark_of_ignorance` | Mark of Ignorance | 5 | +1 flat Charge bonus | — | — | +3→+8 flat from Charges |
| `entropy` | Entropy | 3 | +1 Burn | — | L3: +1 Poison on QP too | 3+2→6+3 Burn+Poison |
| `stagger` | Stagger | 3 | — | — | L3: QP also applies 1t Weakness | Tag-based |
| `corroding_touch` | Corroding Touch | 3 | +1 Weakness duration | — | — | 2→5 turns Weakness (0-cost, cap 3 for balance) |

#### UTILITY

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `scavenge` | Scavenge | 3 | — | — | L3: QP puts 2 on top instead of 1 | Tag-based |
| `sift` | Sift | 5 | +1 cards looked at | — | — | Look at 3→8, discard 1 |
| `siphon_knowledge` | Siphon Knowledge | 3 | +1 draw at L3 | — | L3: QP draws 3 + see time 4s | Tag-based, mostly |
| `swap` | Swap | 3 | — | — | L3: CC draws 3 instead of 2 | Tag-based |
| `tutor` | Tutor | 3 | — | — | L3: tutored card costs 0 on QP too | Tag-based |
| `recollect` | Recollect | 3 | — | — | L3: QP returns 2 exhausted | Tag-based |
| `synapse` | Synapse | 3 | +1 draw at L3 | — | L3: QP draws 3 | Tag-based |
| `archive` | Archive | 3 | — | — | L3: QP retains 2 cards | Tag-based |
| `reflex` | Reflex | 3 | +1 draw at L3 | +1 passive block at L3 | L3: draws 3, passive block 4 | Tag-based |

#### WILD

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `chameleon` | Chameleon | 3 | — | — | L3: QP also inherits chain type | Tag-based |
| `phase_shift` | Phase Shift | 5 | +2 dmg/block | — | — | 8→18 (choose) or 12→22 (both on CC) |
| `knowledge_bomb` | Knowledge Bomb | 5 | +1 per-correct dmg | — | — | 4/correct→9/correct |
| `dark_knowledge` | Dark Knowledge | 5 | +1 per-curse dmg | — | — | 3/curse→8/curse QP |
| `catalyst` | Catalyst | 3 | — | — | L3: also doubles Bleed on QP | Tag-based |
| `chain_anchor` | Chain Anchor | 3 | — | — | L3: sets chain to 3 instead of 2 on CC | Tag-based |
| `sacrifice` | Sacrifice | 3 | +1 draw at L3 | — | L3: QP draws 3 | Tag-based |
| `mimic` | Mimic | 3 | — | — | L3: QP also lets you choose (not random) | Tag-based |
| `unstable_flux` | Unstable Flux | 3 | — | — | L3: QP lets you choose 1 of 2 (not full random) | Tag-based |
| `aftershock` | Aftershock | 3 | +0.1× power per level | — | — | 0.5×→0.8× repeat |

#### INSCRIPTIONS (remaining)

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `inscription_wisdom` | Inscription of Wisdom | 3 | — | — | L3: CC also heals 2 per correct | Tag-based |

#### FILLER

| ID | Name | Cap | perLevelDelta | Secondary | L3 Bonus Tag | L0→L5 (QP) |
|----|------|-----|---------------|-----------|-------------|-------------|
| `power_strike` | Power Strike | 5 | +2 dmg | — | — | 10→20 dmg |
| `twin_strike` | Twin Strike | 5 | +1 per hit | — | — | 5×2→10×2 |
| `iron_wave` | Iron Wave | 5 | +1 dmg, +1 block | — | — | 5+5→10+10 |
| `reinforce` | Reinforce | 5 | +2 block | — | — | 8→18 block |
| `shrug_it_off` | Shrug It Off | 5 | +1 block | — | L3: draws 2 instead of 1 | 6→11 block |
| `bash` | Bash | 5 | +2 dmg | — | L3: Vuln duration +1t | 10→20 dmg |
| `guard` | Guard | 5 | +2 block | — | — | 14→24 block |
| `sap` | Sap | 5 | +1 dmg | — | L3: Weakness duration +1t | 3→8 dmg |

---

## PART 4: AP COST DISTRIBUTION AUDIT

### Existing 31 Mechanics (confirmed from codebase)

**0 AP:** Quicken, Foresight = 2
**1 AP:** Strike, Block, Thorns, Emergency, Brace, Piercing, Reckless, Execute, Weaken, Expose, Hex, Scout, Recycle, Cleanse, Mirror, Adapt, Empower, Focus, Parry, Immunity = 20
**2 AP:** Multi-Hit, Fortify, Overheal, Slow, Double Strike, Lifetap, Overclock = 7
**3 AP:** Heavy Strike = 1
**0 AP (starter):** Surge = 1 (starter card, not in reward pool)

**Existing total: 2+20+7+1+1 = 31**

Note: Transmute (1 AP, Phase 2) is already counted in the 1 AP row above. Phase 2 cards (Parry, Transmute, Immunity, Overclock) are included in the count.

### New Cards Distribution (60 total)

| AP | New Cards | Count |
|----|-----------|-------|
| 0 | Swap, Sacrifice, Corroding Touch | 3 |
| 1 | Siphon Strike, Rupture, Kindle, Gambit, Overcharge, Volatile Slash, Riposte, Feedback Loop, Precision Strike, Absorb, Reactive Shield, Knowledge Ward, Burnout Shield, Conversion, Aegis Pulse, Ignite, Warcry, Battle Trance, Mastery Surge, War Drum, Lacerate, Corrode, Curse of Doubt, Mark of Ignorance, Stagger, Scavenge, Sift, Tutor, Recollect, Synapse, Archive, Reflex, Chameleon, Phase Shift, Dark Knowledge, Catalyst, Chain Anchor, Mimic, Unstable Flux, Aftershock, Power Strike, Twin Strike, Iron Wave, Reinforce, Shrug It Off, Sap | 46 |
| 2 | Hemorrhage, Chain Lightning, Smite, Ironhide, Frenzy, Entropy, Siphon Knowledge, Knowledge Bomb, Inscription of Fury, Inscription of Iron, Inscription of Wisdom, Bash, Guard, Recall | 14 |
| 3 | Bulwark | 1 |
| X | Eruption | 1 |

### Combined Distribution (31 Existing + 60 New = 91 Total)

| AP | Existing | New | Total | % | Target | Status |
|----|----------|-----|-------|---|--------|--------|
| 0 | 3 | 3 | 6 | 6.6% | 5-10% | GOOD |
| 1 | 20 | 46 | 66 | 72.5% | 55-70% | SLIGHTLY HIGH but acceptable — 1 AP cards are the bread and butter |
| 2 | 7 | 14 | 21 | 23% | 20-30% | GOOD |
| 3 | 1 | 1 | 2 | 2.2% | 2-5% | GOOD |
| X | 0 | 1 | 1 | 1.1% | 1-2% | GOOD |

**Heavy Strike (3 AP) + Bulwark (3 AP) = 2 cards at 3 AP.** STS Ironclad has 3 out of ~75 at 3 energy (4%). We're at 2.2% — fine. Adding more 3-AP cards risks dead hands (drawing two 3-costs = one unplayable with 3 AP base).

### Turn Feel Analysis

With 3 AP, typical turns play out as:
- **Three 1-AP cards:** Most common. Fast, flexible.
- **One 2-AP + one 1-AP:** Common. One big play + one support.
- **One 3-AP card:** Rare. All-in on one card.
- **One 2-AP + Charge (1+1 surcharge):** Charges a 1-AP card + plays one 1-AP card. The core Charge turn.
- **Quicken (0 AP) → Charge (1+1) → 1-AP card:** The "Quicken enables Charge" turn. 4 effective AP.

This feels right. The 1-AP dominance means most turns have 3 meaningful decisions, and Charging always costs a card slot.

---

## PART 5: CARD UNLOCK PROGRESSION

Cards unlock as character level increases. New players start with all 31 existing mechanics + 5 new cards (3 filler + 2 Inscriptions) at level 0 = 36 total. Exotic mechanics unlock gradually.

| Level | New Cards Unlocked | Total Available | Design Intent |
|-------|-------------------|-----------------|---------------|
| 0 | 31 existing + Power Strike, Iron Wave, Reinforce, Inscription of Fury, Inscription of Iron (filler + 2 Inscriptions) | 36 | Core game. All existing mechanics + basic upgrades + build-defining Inscriptions from day 1. |
| 1 | Bash, Guard, Sap (filler), Inscription of Wisdom | 40 | First upgrades + final Inscription. |
| 2 | Twin Strike, Shrug It Off, Swap | 43 | Cycling and multi-hit. |
| 3 | Stagger, Sift, Riposte | 46 | Tempo and scry tools. |
| 4 | Rupture, Lacerate, Scavenge, Absorb, Precision Strike | 51 | Bleed archetype introduced. |
| 5 | Kindle, Ignite, Corrode, Overcharge, Archive | 56 | Burn archetype + combat persistence. |
| 6 | Gambit, Curse of Doubt, Knowledge Ward, Aegis Pulse, Reflex, Unstable Flux, Chameleon | 63 | Quiz-reward cards + wild cards. Knowledge-is-power identity solidifies. |
| 7 | Burnout Shield, Battle Trance, Volatile Slash, Corroding Touch, Phase Shift | 68 | Exhaust archetype + advanced utility. (Reshape removed — already exists as Transmute #27.) |
| 8 | Ironhide, War Drum, Chain Lightning, Dark Knowledge, Mark of Ignorance, Sacrifice | 74 | Chain archetype + curse-as-weapon emerge. |
| 9 | Smite, Entropy, Bulwark, Conversion, Chain Anchor | 79 | Build-defining specialists. |
| 10 | Feedback Loop, Frenzy, Aftershock, Synapse, Catalyst | 84 | High-skill ceiling cards. |
| 11 | Recall, Mastery Surge, Tutor, Mimic, Siphon Strike | 89 | Discard/mastery scaling + toolbox cards. |
| 12 | Eruption (X-cost) | 90 | X-cost introduced. |
| 13 | Knowledge Bomb, Siphon Knowledge | 92 | Final quiz cards. Encounter-scaling spectacular + study-during-combat. |

**Note on total 92 vs 91:** The card catalogue lists Inscription of Fury and Inscription of Iron in BOTH the buff section (B7, B8) and the inscription section (I1, I2). These are the same cards, not duplicates. The 92 in this table counts each unique card unlock once — the slight discrepancy with the header's "60 new" is because the header deduplicates the inscription/buff overlap. For implementation: 91 unique mechanic IDs total.

**Pacing:** Levels 0-3 (first ~5 runs) focus on basics. Levels 4-6 (runs 6-15) introduce the game's unique mechanics. Levels 7-10 (runs 15-30) open up advanced archetypes. Levels 11-15 (runs 30-60) are chase unlocks for dedicated players.

---

## PART 6: CURSED CARD SYSTEM — Replaces Echoes

### Why Echoes Were Killed

The old Echo system had two fatal flaws:
1. **Exploit:** Intentionally wrong-answer a card you don't want → it exhausts on second fail → free deck thinning. Players WILL abuse this.
2. **Anti-learning:** The fact a player most needs to practice gets REMOVED from their deck forever. The mechanic punished struggling players by taking away their learning opportunities.

### Why Cursed Cards Work

Cursed cards are the opposite philosophy: wrong answers make a card WORSE, not gone. The card stays in your deck, weakened, until you prove you've learned by answering correctly. You can't escape it. You can't exploit it. You can only cure it through knowledge.

See Part 1 Section 1C for full mechanical specification.

### Cursed Card Interactions with New Cards and Relics

| Card/Relic | Cursed Interaction | Notes |
|------------|-------------------|-------|
| **Free First Charge** (system) | First Charge of unknown fact: wrong = 0.0× fizzle. **Does NOT curse.** | Guessing wrong on a never-seen fact shouldn't corrupt your deck. Fizzle is punishment enough. |
| **Dark Knowledge** (card) | Deals damage per cursed fact you have. Does NOT cure. Counts at play time (snapshot). | Turns curses into a weapon. More curses = bigger nuke. "Keep curses or cure them?" decision. |
| **Scar Tissue** (relic) | Cursed cards deal 0.85× QP instead of 0.7×. Does NOT cure. | Living with curses becomes slightly less painful. |
| **Insight Prism** (relic) | Wrong Charge reveals correct answer. Next same-fact auto-succeeds = auto-cure of that cursed fact. | Player SAW the correct answer. Borderline bypass but educational. Keep — limited to one fact. |
| **Deja Vu** (relic) | On turn 1 of an encounter, adds 1 random card from discard pile to hand at 1 less AP cost. The card carries a fact you've previously answered correctly this run. Cursing only happens at mastery 0 — Deja Vu facts begin with positive association and are less likely to be mastery 0. | Cross-run knowledge has built-in positive framing via fact selection. |
| **Volatile Slash / Burnout Shield** | These exhaust on Charge. A card carrying a cursed fact exhausts at 0.7× QP or 0.5× CW. Cure via Charge still works (resolves at 1.0× then exhausts, fact cured). | Exhaust + Curse = extra bad. Draft exhaust cards carefully. |
| **Inscription cards** | Cursed Inscription QP = 0.7× persistent effect for rest of combat. Worth curing before playing. | High-stakes: do you Charge to cure first, or settle for 0.7× persistent? |
| **Soul Jar** (relic) | Auto-correct charge can be used on a cursed fact's quiz to guarantee the cure. | Strategic use of banked success. |
| **Conversion** (card) | Cursed Conversion converts block at 0.7× cap (7 instead of 10 QP, 10.5 instead of 15 CC). | Weaker but still functional. |
| **Mastery Surge** (card) | Wasted on cursed cards — cursed facts are locked at effective mastery 0. | Don't target cursed cards with Mastery Surge. |

### Balance: How Many Cursed Facts Is Too Many?

At 70% accuracy (average player), roughly 30% of Charge attempts fail. With ~45-70 Charges per run, that's 13-21 wrong answers. Not all create cursed facts (only mastery 0 facts), but early in a run most facts ARE mastery 0.

Worst case: 10-15 cursed facts in a pool of 80-120 = ~10-15% of facts cursed. Since facts rotate per draw, you'll see 1-3 cursed cards per 5-card hand on average. This is noticeable but not overwhelming — unlike slot-based cursing which would affect fixed deck percentage.

**Safety valve:** If 60%+ of facts currently in hand are cursed across 2 consecutive draws, the oldest cursed fact auto-cures at end of encounter. This prevents complete death spirals while preserving the mechanic's bite for normal play.

Constants: `CURSED_AUTO_CURE_THRESHOLD = 0.6`, `CURSED_AUTO_CURE_COUNT = 1`

---

## PART 7: COMPLETE RELIC CATALOGUE — All 36 New Relics

### 7A. NEW COMMON RELICS (5)

| # | ID | Name | Trigger | Effect | Category |
|---|-----|------|---------|--------|----------|
| R1 | `quick_study` | Quick Study | on_encounter_end | After combat, if 3+ Charges correct, see quiz answer for 1 random deck fact (3s) | knowledge |
| R2 | `thick_skin` | Thick Skin | permanent | First debuff each encounter has duration reduced by 1 turn | defensive |
| R3 | `tattered_notebook` | Tattered Notebook | on_charge_correct | +5 gold on first correct Charge per encounter | economy |
| R4 | `battle_scars` | Battle Scars | on_damage_taken | Next attack deals +3 damage after taking a hit (once/turn) | offensive |
| R5 | `brass_knuckles` | Brass Knuckles | on_attack | Every 3rd attack card played deals +6 bonus damage | offensive |

### 7B. NEW UNCOMMON RELICS (12)

| # | ID | Name | Trigger | Effect | Category |
|---|-----|------|---------|--------|----------|
| R6 | `pocket_watch` | Pocket Watch | on_turn_start | +1 draw on turns 1 and 5 of each encounter | tactical |
| R7 | `chain_link_charm` | Chain Link Charm | on_chain_complete | +5 gold per chain link in completed chains | economy |
| R8 | `worn_shield` | Worn Shield | on_block | Every 2nd shield card played gains +3 block | defensive |
| R9 | `bleedstone` | Bleedstone | permanent | Bleed stacks applied by you are +2 higher. Bleed decay is 1 slower (lose 1 less per turn) | poison |
| R10 | `ember_core` | Ember Core | permanent | Burn applied by you starts with +2 extra stacks. Enemy with 5+ Burn: your attacks deal +20% damage | offensive |
| R11 | `gambler_s_token` | Gambler's Token | on_charge_wrong | Wrong Charge = +3 gold. That's it. | economy |
| R12 | `thoughtform` | Thoughtform | on_perfect_turn | +1 permanent Strength when ALL cards played in a turn were Charged correctly | offensive |
| R13 | `scar_tissue` | Scar Tissue | permanent | Cards carrying cursed facts deal 0.85× QP instead of 0.7× (softens curse penalty). Does NOT cure — just makes living with curses less painful. | defensive |
| R14 | `surge_capacitor` | Surge Capacitor | on_surge_start | On Surge turns: +1 AP and draw 2 extra cards | burst |
| R15 | `obsidian_dice` | Obsidian Dice | on_charge_correct | 60% chance: +50% Charge multiplier. 40% chance: -25% Charge multiplier | glass_cannon |
| R16 | `living_grimoire` | Living Grimoire | on_encounter_end | If 3+ Charges correct in encounter, heal 3 HP | sustain |
| R17 | `gladiator_s_mark` | Gladiator's Mark | on_encounter_start | Start each encounter with +1 Strength for 3 turns | offensive |

### 7C. NEW RARE RELICS (15)

| # | ID | Name | Trigger | Effect | Category |
|---|-----|------|---------|--------|----------|
| R18 | `red_fang` | Red Fang | on_encounter_start | First attack each encounter deals +30% damage. Resets per encounter. | offensive |
| R19 | `chronometer` | Chronometer | permanent | All quiz timers +3 seconds. All Charge multipliers -15%. | knowledge |
| R20 | `soul_jar` | Soul Jar | on_charge_correct | Accumulates 1 charge per 5 correct Charges. CHARGE button shows "GUARANTEED" when charges available. Player taps to consume and auto-succeed a quiz. | knowledge |
| R21 | `null_shard` | Null Shard | permanent | All chain multipliers = 1.0× (chains disabled). All attack cards +25% base damage. Chain Lightning floors at chain length 1 and works as a basic 8-damage attack. | offensive |
| R22 | `hemorrhage_lens` | Hemorrhage Lens | on_multi_hit | Multi-Hit attacks apply 1 Bleed per hit. Bleed triggers on subsequent hits only (not the applying hit). | poison |
| R23 | `archive_codex` | Archive Codex | on_encounter_end | Tracks total mastery levels across all cards in your deck. Grants bonus damage scaling with total mastery: +1 damage per 10 total mastery levels across deck. Exact tuning via headless sim. | knowledge |
| R24 | `berserker_s_oath` | Berserker's Oath | on_run_start | -30 max HP. All attacks +40% damage. | glass_cannon |
| R25 | `chain_forge` | Chain Forge | on_chain_complete | Once per encounter: when a card would break a chain, it continues instead (automatic, no gesture). | chain |
| R26 | `deja_vu` | Deja Vu | on_turn_start | Once per encounter, on turn 1: add 1 random card from your discard pile to your hand. That card costs 1 less AP this turn. The card is assigned a fact you've previously answered correctly this run. Scaling: at character level 15+, spawns 2 cards instead of 1. | knowledge |
| R27 | `inferno_crown` | Inferno Crown | permanent | When enemy has BOTH Burn and Poison, all your damage +30%. | offensive |
| R28 | `mind_palace` | Mind Palace | permanent | Track consecutive correct Charges across the run. Forgiveness: 1 wrong per 10 freezes progress (doesn't reset). At 10/20/30 streak: +3/+6/+10 to all effects. | knowledge |
| R29 | `entropy_engine` | Entropy Engine | on_turn_end | If you played 3+ different card types this turn: deal 5 damage + gain 5 block | tactical |
| R30 | `bloodstone_pendant` | Bloodstone Pendant | on_damage_taken | Each time you take damage, gain 1 Fury stack. Each Fury = +1 damage to next attack, consumed on attack. | glass_cannon |
| R31 | `chromatic_chain` | Chromatic Chain | on_chain_complete | Once per encounter: completing a 3+ chain makes your NEXT chain start at length 2 instead of 1. Carries across turns — completing 3+ chain makes next turn's chain start at 2. | chain |
| R37 | `dragon_s_heart` | Dragon's Heart | on_elite_kill / on_boss_kill | Elite kill: +5 max HP + heal 30%. Boss kill: +15 max HP + full heal + random Legendary relic. Passive: +2 damage to all attacks (always active, even without kills). | offensive |

### 7D. NEW LEGENDARY RELICS (4)

| # | ID | Name | Trigger | Effect | Category |
|---|-----|------|---------|--------|----------|
| R32 | `omniscience` | Omniscience | on_charge_correct | 3 correct Charges in one turn → 4th Charge this turn auto-succeeds | knowledge |
| R33 | `paradox_engine` | Paradox Engine | on_charge_wrong | Wrong Charges resolve at 0.3× AND deal 5 piercing damage. +1 AP per turn. | cursed |
| R34 | `akashic_record` | Akashic Record | on_charge_correct | Tier 2b+ facts: one wrong answer subtly highlighted. Tier 3 auto-Charge power = 1.5× (up from 1.2×). | knowledge |
| R35 | `singularity` | Singularity | on_chain_complete | Completing a 5-chain deals BONUS damage equal to total chain damage dealt. Effectively doubles 5-chain output. | chain |

### 7E. NEW CURSED RELICS (2)

These relics carry a meaningful downside that defines the run. They are separate from the Dragon's Heart (moved to Rare) and Paradox Engine (listed in Legendary above for reference).

| # | ID | Rarity | Power | Curse |
|---|-----|--------|-------|-------|
| R33 | `paradox_engine` | Legendary | +1 AP/turn, wrong = 5 piercing | Wrong Charges resolve at 0.3× (worse than QP). Volatile Manuscript self-Burn works identically — enemy hits trigger player's Burn stacks. |
| R36 | `volatile_manuscript` | Rare | All Charge multipliers +0.5× | Every 3rd Charge applies 4 Burn to yourself |

---

## PART 8: FULL SYNERGY MAP

### 8A. Card-to-Card Synergies (Major Combos)

| Combo | Cards | Why It Works | Power Level |
|-------|-------|-------------|-------------|
| **Bleed Burst** | Rupture/Lacerate → Hemorrhage | Stack Bleed then consume for burst. 10 Bleed = 64 Hemorrhage CC damage. | High |
| **Burn Burst** | Kindle/Ignite → Multi-Hit (existing) | Apply Burn, then trigger it 3× with Multi-Hit. 8 Burn → +8+4+2 = 14 bonus across 3 hits. | High |
| **Burn + Poison Convergence** | Entropy → Catalyst | Entropy applies both. Catalyst doubles both. | Very High |
| **Chain Nuke** | Chain Anchor → Chain Lightning → any chain cards | Anchor starts at 2, Lightning scales with length. | Very High |
| **Inscription + Overcharge** | Inscription of Fury → Overcharge | Fury adds flat damage; Overcharge scales per Charge. Combined = snowball. | High |
| **Absorb into Gambit** | Absorb (CC) → Gambit (CC) | Absorb CC draws 1 card, potentially finding Gambit. Play Absorb for block + draw, then Gambit for the HP swing. | Medium |
| **Exhaust Loop** | Volatile Slash → Recollect → Volatile Slash | Slash exhausts on Charge. Recollect returns it. Repeat. | Medium |
| **Quiz Debuff Stack** | Curse of Doubt + Mark of Ignorance | +50% from Charges (percentage) + +5 flat from Charges. Stacked, a 24 CC Strike = 24×1.5+5 = 41 damage. | High |
| **Discard Scaling** | Reflex + Recall | Reflex gives block when discarded, growing discard pile. Recall nukes based on discard size. | Medium |
| **AP Economy** | Warcry (CC, free next Charge) → any Charge card | Warcry gives Strength + enables a free follow-up Charge. 2 Charges for 3 AP. | High |
| **Draw Engine** | Battle Trance (CC) + Shrug It Off + Reflex | Draw tons of cards. Unplayed Reflex = free block. | Medium |
| **Persistent Stacking** | Inscription of Fury + Inscription of Iron + Inscription of Wisdom | All three Inscriptions active = +4 atk, +6 block/turn, +1 draw on CC. Requires 6 AP investment. | Very High (but expensive) |

### 8B. Card-to-Relic Synergies

| Combo | Card + Relic | Effect |
|-------|-------------|--------|
| Bleedstone + Rupture | Rupture applies 3+2=5 Bleed on QP, 8+2=10 on CC | Bleed archetype core |
| Ember Core + Kindle | Kindle applies 4+2=6 Burn on QP. Enemy at 5+ Burn = +20% attacks | Burn archetype core |
| Hemorrhage Lens + Multi-Hit | Multi-Hit applies 1 Bleed per hit AND triggers existing Bleed | Bleed + Multi-Hit archetype |
| Inferno Crown + Entropy | Entropy applies both Burn + Poison. Crown gives +30% all damage | DoT convergence archetype |
| Chain Forge + Chain Lightning | Chain Forge prevents one chain break. Lightning scales with chain length | Chain consistency |
| Null Shard + any attack | No chains but +25% base damage on all attacks. Draft pure attacks. Chain Lightning works as basic 8-damage attack with Null Shard. | Anti-chain aggro archetype |
| Soul Jar + Gambit | Bank auto-correct → use on Gambit to guarantee the heal swing | Insurance for risky quiz cards |
| Omniscience + Knowledge Bomb | 3 correct → 4th auto. Knowledge Bomb CC scales with correct Charge count, so Omniscience's auto-success counts as another correct. | Legendary quiz synergy |
| Capacitor + Eruption | Store AP → dump into X-cost | Burst archetype core |
| Volatile Core + Feedback Loop | CW on Feedback = 0 dmg + Volatile's 3 enemy dmg. Even a fizzle deals SOME damage | Glass cannon consistency |
| Archive Codex + Siphon Knowledge | Siphon draws cards, expanding opportunities to answer more facts correctly, increasing total mastery levels → faster Codex damage scaling | Breadth-of-knowledge engine |
| Mind Palace + Soul Jar | Soul Jar banks auto-correct. Use it to protect Mind Palace streak on hard facts | Streak protection combo |
| Prismatic Shard + Chain Anchor + Chain Lightning | Shard +0.5 to multipliers, Anchor starts chains, Lightning scales | THE chain dream setup |
| Dragon's Heart + Elite-heavy builds | Kill elites for stacking max HP + heal. Boss kill adds a Legendary relic. Passive +2 damage is always on. | Scaling archetype core |
| Paradox Engine + Gambit | Wrong Gambit: 0.3× dmg (2.1) + 5 piercing + lose HP. Not great but 5 piercing cushions | Cursed interaction (interesting, not broken) |

### 8C. Relic-to-Relic Synergies

| Combo | Relics | Effect |
|-------|--------|--------|
| Bleedstone + Hemorrhage Lens | More Bleed applied + Multi-Hit applies Bleed | Full Bleed package |
| Ember Core + Inferno Crown | Burn threshold reached faster + Crown bonus when Poison present | DoT empire |
| Volatile Core + Reckless Resolve | +50% from Volatile + +50% below 40% HP. Multiplicative = 2.25× attacks at low HP | Glass cannon extreme |
| Chain Reactor + Prismatic Shard | Splash damage per link + all multipliers +0.5. 5-chain = 6 splash × 5 links + 3.5× multiplier | Chain apocalypse |
| Blood Price + Capacitor | +1 AP from Blood Price. Unused AP stored by Capacitor. 4 AP/turn with banking | AP abundance |
| Swift Boots + Surge Capacitor | +1 draw always + +2 draw on Surge. Surge turns = draw 8 cards | Hand flooding |
| Crit Lens + Quicksilver Quill | 25% double damage + 1.5× speed bonus. Crit on speed answer = 9× damage | Lottery win damage |
| Soul Jar + Mind Palace | Soul Jar banks auto-correct. Use it to protect Mind Palace streak | Streak protection combo |
| Aegis Stone + Thorn Crown | Block carries (max 15) + 15 block = reflect 5 per attack | Turtle with teeth |
| Thoughtform + Omniscience | Perfect turns give Strength. Omniscience auto-succeeds 4th card → easier perfect turns | Consistent Strength gain |

---

## PART 9: SYNERGY GUIDE — Emergent Combos (No Hidden Bonuses)

There are **NO hardcoded hidden synergy bonuses** in Recall Rogue. All synergies are emergent — they work because of how individual card and relic effects naturally interact. Players discover them through play, not through wiki-reading. If a combo seems powerful, it's because the individual pieces are doing exactly what they say on the tin.

This section documents the most notable emergent synergies for design reference and balance testing. These are NOT special-cased in code — they're just what happens when you combine these pieces.

### Tier 1 — Obvious Combos (new players discover within 5-10 runs)

| Name | Pieces | What Happens (Emergently) |
|------|--------|--------------------------|
| **Block Fortress** | Aegis Stone (block carries, max 15) + Thorn Crown (15+ block = reflect 5) + shield cards | Stack block over multiple turns → hit the 15 cap → reflect 5 damage per enemy attack passively. Just draft lots of shield cards. |
| **Poison Pile-On** | Plague Flask (+2 per tick, +1 turn) + Hex cards + Festering Wound (+40% attacks at 3+ poison) | Hex applies more poison, Flask makes it tick harder and last longer, Wound makes your attacks hit harder while poison is up. Each piece independently good, together they're a DoT machine. |
| **Burn Burst** | Kindle/Ignite (apply Burn) + Multi-Hit (3 hits) | Apply Burn, then trigger it 3× with Multi-Hit. Burn halves per hit: 8→4→2 = +14 bonus across 3 hits. Each piece does what it says. |
| **Draw Engine** | Swift Boots (+1 draw) + Resonance Crystal (+1 draw per chain link past 2) + chain cards | 6 base draw + chain bonus draws. Build chains, draw more cards, find more chain cards. Self-reinforcing cycle. |
| **Lifetap + Reckless** | Lifetap (deal dmg + heal 20%) + Reckless (12 dmg, 3 self-dmg) | Reckless damages you, Lifetap heals you. Alternate between them. Not a combo — just two cards that cover each other's weaknesses. |

### Tier 2 — Build-Defining Combos (experienced players, runs 10-30)

| Name | Pieces | What Happens (Emergently) |
|------|--------|--------------------------|
| **Glass Berserker** | Volatile Core (+50% atk, wrong=3 self-dmg) + Reckless Resolve (+50% below 40% HP) | Both are percentage damage boosts. They multiply. At low HP: 1.5× × 1.5× = 2.25× attacks. You're constantly flirting with death. No hidden bonus — just two multipliers stacking. |
| **Chain Nuke** | Chain Anchor (start chain at 2) + Chain Lightning (8 × chain length CC) + Prismatic Shard (+0.5 to all chain mults) | Anchor gives you a head start, Lightning scales with length, Shard makes every chain hit harder. At 5-chain with Shard: 40 × 3.5 = 140 damage. Just math. |
| **Quiz Debuff Stack** | Curse of Doubt (+50% from Charges) + Mark of Ignorance (+5 flat from Charges) | Percentage + flat. A 24 CC Strike becomes 24×1.5+5 = 41. Both reward Charging. Both useless with Quick Play. Draft both = commit to Charging. |
| **Exhaust Loop** | Volatile Slash (exhaust on Charge) + Recollect (return exhausted card) | Slash deals 30 CC then exhausts. Recollect brings it back. Repeat. Two cards doing exactly what they say, just in a cycle. |
| **Speed Machine** | Quicksilver Quill (correct <2s = 1.5× extra) + Adrenaline Shard (correct <3s = refund 1 AP) | Both reward fast answers. Fast enough for Quill = definitely fast enough for Shard. You get bonus damage AND an AP refund. Just two independent speed rewards stacking. |
| **Inscription Foundation** | Inscription of Fury (+4 atk CC rest of combat) + Inscription of Iron (+6 block CC rest of combat) | Play both early → every subsequent turn your attacks hit +4 harder and you start with 6 block. 4 AP investment (2 turns) that pays off every remaining turn. |
| **Curse as Weapon** | Dark Knowledge (dmg per cursed fact) + Scar Tissue (0.85× instead of 0.7× QP on cursed) | More cursed facts = more DK damage. Scar Tissue makes cursed cards less painful to play. You WANT some curses. Natural tension: cure them for a healthier deck, or keep them for DK nukes. |
| **AP Economy** | Blood Price (+1 AP, -2 HP/turn) + Capacitor (store unused AP, max 3) | 4 AP base. Don't spend it all? Bank it. Next turn = 4 + stored. Massive burst turns possible. Each relic does its own thing, together they enable 7+ AP turns. |

### Tier 3 — Mastery Combos (dedicated players, runs 30+)

| Name | Pieces | What Happens (Emergently) |
|------|--------|--------------------------|
| **Phoenix Glass** | Phoenix Feather (resurrect at 15% once/run) + Volatile Core + Berserker's Oath (-30 HP) | Berserker's Oath drops your max HP. Volatile Core adds damage. Phoenix Feather is your safety net. You're building a glass cannon with a single insurance policy. If Phoenix fires, you're at low HP = Reckless Resolve territory. |
| **Knowledge God** | Scholar's Crown (tier-based Charge bonuses) + Mind Palace (streak bonuses) + Archive Codex (total mastery damage scaling) | All three independently reward correct Charging and mastery growth. Crown boosts power, Palace adds scaling bonuses, Codex adds damage from total mastery levels. A player who knows their facts gets rewarded by all three simultaneously. |
| **Chain Singularity** | Singularity (5-chain doubles total damage) + Prismatic Shard (+0.5 to mults, +1 AP on 5-chain) + Chain Reactor (splash per link) | The ultimate chain payoff. Each relic makes chains independently better. Together, a 5-chain is catastrophic. Requires 5 correct Charges of same chain type in one turn — only possible on Surge or with AP generation. |
| **Triple Inscription** | All 3 Inscriptions + cheap 1-AP cards | Play all 3 Inscriptions over 2 turns (6 AP). For the rest of combat: +4 atk, +6 block/turn, +1 draw on CC. Now every cheap card you play benefits from all three. The setup cost is real (2 full turns of low output) but the payoff is permanent. |

### Design Philosophy — Why No Hidden Bonuses

STS doesn't have "if you hold Shuriken + Kunai, gain a secret bonus." It has Shuriken (+1 Strength per 3 attacks) and Kunai (+1 Dexterity per 3 attacks) which independently trigger on the same condition. The "combo" is that you drafted lots of attacks to trigger both. No hidden code. No wiki advantage. No information asymmetry.

Recall Rogue follows the same principle. Every synergy in this list is just "these things do what they say, and together that's powerful." The discovery moment comes from the player realizing the interaction, not from the game secretly activating a bonus.

## PART 10: RELIC UNLOCK SCHEDULE (Character Level)

Integrating with existing 41 relics (Echo Chamber removed; 24 starter + 17 level-gated) plus 36 new:

| Level | New Relic Unlocked | Total Available |
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

**Note:** Echo Chamber has been removed from the game entirely and is not in this unlock table. The final count is 77 relics (41 existing + 36 new), all accessible through the character level unlock schedule.

---

## PART 11: BALANCE SCORECARD

### Power Curve Check

| Build Archetype | Core Cards | Core Relics | Estimated Power (1-10) | Notes |
|-----------------|-----------|-------------|----------------------|-------|
| **Chain Master** | Chain Lightning, Chain Anchor, Synapse | Prismatic Shard, Chain Reactor, Chain Forge | 9 | Highest ceiling. Requires setup + correct answers. |
| **Bleed Assassin** | Rupture, Lacerate, Hemorrhage, Twin Strike | Bleedstone, Hemorrhage Lens | 7 | Reliable, not flashy. Good consistency. |
| **Burn Burst** | Kindle, Ignite, Entropy, Multi-Hit | Ember Core, Inferno Crown | 8 | Front-loaded damage. Falls off in long fights. |
| **Glass Cannon** | Gambit, Reckless, Volatile Slash | Volatile Core, Reckless Resolve, Berserker's Oath | 9 | Highest risk. One wrong answer = death spiral. |
| **Iron Fortress** | Reinforce, Guard, Bulwark, Conversion | Aegis Stone, Thorn Crown, Bastion's Will | 6 | Safest. Slowest kills. Boring but consistent. |
| **Quiz Master** | Curse of Doubt, Mark of Ignorance, Gambit | Scholar's Crown, Mind Palace, Omniscience | 8 | Rewards knowledge directly. THE educational build. |
| **Poison Control** | Hex, Catalyst, Entropy | Plague Flask, Festering Wound | 7 | Set-and-forget. Low interaction but reliable. |
| **AP Burst** | Frenzy, Sacrifice, Eruption | Blood Price, Capacitor, Overflow Gem | 8 | Save-then-explode. High APM turns. |
| **Inscription Engine** | All 3 Inscriptions, cheap cards | Scholar's Crown, Swift Boots | 7 | Slow start (6 AP to set up). Dominant late-fight. |
| **Curse Weaponizer** | Dark Knowledge, Gambit, Volatile Slash | Scar Tissue, Paradox Engine | 6 | Niche. Embraces curses as fuel for Dark Knowledge. Scar Tissue keeps cursed cards usable. Self-correcting: more failures = more DK damage. |
| **Filler Basics** | Power Strike, Iron Wave, Reinforce, Bash | Whetstone, Iron Shield | 5 | The "I didn't find anything fancy" run. Viable through Act 2, struggles Act 3. |

**Assessment:** No build exceeds 9/10. Chain Master and Glass Cannon are the highest ceiling but require the most from the player (chain management + quiz accuracy, or HP management). Iron Fortress is the safest but the slowest. Good spread.

### Degenerate Combo Check

| Potential Problem | Severity | Mitigation |
|-------------------|----------|------------|
| Chain Lightning + 5-chain + Singularity = 240+ damage in one card | Medium | Requires 5 consecutive correct Charges of same chain type in one turn. That's 5+ AP (need Blood Price or Surge). Rare and earned. |
| Inscription of Fury + Inscription of Iron + Inscription of Wisdom all active | Low | Costs 6+ AP to set up (2 turns minimum). Encounter may be half over before all active. |
| Mind Palace 30-streak + all bonuses | Low | One wrong answer in 30+ Charges. Only achievable by players who genuinely know the material. Working as intended. |
| Paradox Engine + Gambit = wrong Gambit deals 2.1 dmg + 5 piercing + lose 5 HP | None | 7.1 total damage for 5 HP self-damage is terrible. Not exploitable. |
| Conversion + Aegis Stone carry = free damage from block | Low | Capped at 15 (Aegis max). 15 damage per turn from block is strong but not broken — requires shield cards AND Conversion in hand. 1:1 conversion ratio (block converts to equal damage). |
| Frenzy (3 free cards) + Charge everything | Medium | 3 free Charges = 3 quizzes = ~15-20 seconds of quiz. Pacing concern more than balance concern. Timer still applies. |

---

## PART 12: IMPLEMENTATION PHASING

### Phase 1 — Core Expansion (target: 2 weeks)

**Cards:** All 8 filler cards (F1-F8) + Rupture, Lacerate, Kindle, Ignite, Absorb, Reactive Shield, Overcharge, Riposte, Sift, Scavenge
**Relics:** Quick Study, Thick Skin, Gladiator's Mark, Bleedstone, Ember Core, Worn Shield
**Status effects:** Burn, Bleed
**New system:** Cursed Cards
**Card unlock levels 0-4**

This gives you 2 new status archetypes (Burn, Bleed), the Cursed Card system, and 18 new cards with reliable basics.

### Phase 2 — Identity Cards (target: 2 weeks)

**Cards:** Gambit, Chain Lightning, Chain Anchor, Curse of Doubt, Mark of Ignorance, Knowledge Ward, Unstable Flux, Phase Shift, Chameleon, Dark Knowledge, Volatile Slash, Burnout Shield, Battle Trance, Warcry, Sap, Corroding Touch
**Relics:** Chain Forge, Chromatic Chain, Soul Jar, Thoughtform, Scar Tissue, Surge Capacitor, Red Fang
**Card unlock levels 5-8**

This adds the quiz-reward identity cards that make Recall Rogue unique.

### Phase 3 — Advanced & Chase (target: 2 weeks)

**Cards:** All remaining (Inscription of Wisdom, Knowledge Bomb, Eruption, Catalyst, Feedback Loop, Frenzy, Smite, Entropy, Bulwark, Conversion, Recall, Mimic, Aftershock, Synapse, Tutor, Mastery Surge, Siphon Knowledge, etc.)
**Relics:** All remaining (Legendaries, Mind Palace, Archive Codex, Singularity, Dragon's Heart, etc.)
**Card unlock levels 9-14**

---

## APPENDIX A: CARDS THAT WERE CUT (with reasons)

| Card | Reason |
|------|--------|
| Concentration | Redundant with Quicken. Niche absorbed by Warcry CC. |
| Echo Guard | Spawned ghost cards from correct answers — confused system identity. Replaced by Aegis Pulse. |
| Wildfire | Swiss army knife = bad at everything. Replaced by Aftershock. |
| Verdict | Redundant with redesigned Phase Shift. Replaced by Paradox concept (merged into other cards). |
| Resonance | Incomprehensible on mobile (chain multiplier snapshotting). Replaced by War Drum. |
| Reshape (U8) | Duplicates existing Transmute (#27). Cut entirely. |
| Signal Flare (U11) | Cut for scope. Enemy intent reveal is a niche effect that doesn't interact with any build archetype. The 0-cost + Charge structure (Corroding Touch handles 0-cost better). Removed to bring new card total to 60. |
| Fortitude status | Just weaker Block. Cut entirely — no replacement status. |
| Focus STATUS EFFECT (design concept) | Was a proposed status that would dim quiz answers. Never implemented in code. Killed as a concept because dimming = effectively disabling. **The existing `focus` CARD MECHANIC (ID: `focus`, AP reduction) is completely unrelated and unchanged.** |
| Echo system | Exploitable as deck thinning (fail on purpose) + anti-learning (removes cards you need to practice). Replaced by Cursed Card system. |
| Echo Weave card | Originally replaced Echo system with Purify (curse curing). Purify killed because it bypasses learning loop. Replaced by Dark Knowledge (curse-as-weapon). |
| Echo Lens relic | Originally replaced by Curse Breaker (chain-curing). Curse Breaker killed because it bypasses learning loop. Replaced by Scar Tissue (softens curse penalty). |
| Phantom Limb relic | Replaced by Scar Tissue. |
| Purify card | Cured cursed facts without answering them — learning bypass. Replaced by Dark Knowledge. |
| Curse Breaker relic | Chain-cured cursed facts without answering them — learning bypass. Replaced by Scar Tissue. |

## APPENDIX B: RELICS THAT WERE CUT (with reasons)

| Relic | Reason |
|-------|--------|
| Echo Chamber | Removed from game entirely. Was an existing relic that reinforced the old Echo mechanic. With Echoes killed, Echo Chamber has no meaningful effect. |
| Cracked Monocle | Zero gameplay benefit. Info with no power. Replaced by Quick Study. |
| Warming Flask | Too narrow (anti-Burn only) + doesn't work with Burn redesign. Replaced by Thick Skin. |
| War Paint | Stances were cut. Replaced by Gladiator's Mark. |
| Prismatic Lens | Too system-invasive (changes run seed behavior). Replaced by Chromatic Chain. |

## APPENDIX C: X-COST CHARGE INTERACTION RULES

**Eruption (X AP):**
- X = all remaining AP at time of play
- If Quick Played: X = current AP. All AP consumed. Deals 8 × X damage.
- If Charged: Charge surcharge (+1 AP) is deducted FIRST, then remaining AP = X. Deals 12 × X damage.
- Example: 4 AP available. QP = 4×8 = 32 dmg. Charge = 1 surcharge + 3 AP into damage = 3×12 = 36 dmg.
- During Surge (surcharge = 0): Charge = 4×12 = 48 dmg. Surge + Eruption is a big deal.
- Free First Charge: surcharge = 0. Same as Surge interaction.
- Chain Momentum (surcharge waived): Same as Surge.
- Frenzy waives the play cost; the X still drains all remaining AP after the surcharge (if any).

## APPENDIX D: REFLEX DISCARD TRIGGER RULES

**Reflex triggers when discarded from hand by ANY source:**
- End of turn (unplayed cards discarded) — YES
- Transmute (discard to transform) — YES
- Swap (discard 1, draw 1) — YES
- Enemy effects that force discard — YES
- Choosing to discard for other card effects — YES

**Reflex does NOT trigger:**
- When shuffled from discard into draw pile (it's not IN hand)
- When exhausted (exhaust ≠ discard, different pile)
- When removed from deck (Meditate rest site)

Block gained from Reflex discard is applied immediately, before any other end-of-turn effects resolve. 2 Reflex cards discarded in a single turn = 6 total block (3 each), applied before enemy turn.

## APPENDIX E: DAMAGE PIPELINE

The exact order of damage calculation for all attacks:

1. `mechanicBaseValue` (from QP/CC/CW lookup)
2. + mastery bonus (perLevelDelta × mastery level)
3. + Inscription of Fury flat bonus (if active, applied here as flat addition)
4. + relic flat bonuses (barbed_edge, etc.)
5. × card.effectMultiplier (tier-derived)
6. × chainMultiplier (1.0–3.0, based on chain length)
7. × speedBonus (from quiz timer — only applies on CC)
8. × buffMultiplier (from Empower/buff cards active this turn)
9. × relic percent bonuses (Volatile Core, Reckless Resolve, etc.)
10. × overclockMultiplier (if Overclock active)
11. + Burn bonus (= current Burn stacks, then halve Burn stacks — round down)
12. + Bleed bonus (= Bleed stacks per card-play hit; does NOT decay on hit — only decays end of enemy turn)
13. + relic flat attack bonus applied post-multiply (Bloodstone Pendant Fury stacks, etc.)
14. If enemy has Vulnerable: × 1.5
15. Block absorbs final total
16. Remaining damage after block hits HP

**Notes:**
- **Combo multiplier is NOT in this pipeline** — the combo system has been removed from the game entirely.
- Burn and Bleed bonuses (steps 11-12) are added to the attack total BEFORE block is applied. Block absorbs the combined total, not separately.
- Chain Anchor sets next chain's starting length to 2; Chain Anchor itself is not a chain link and does not contribute to step 6.
- AP gain from Sacrifice/Blood Price can push past MAX_AP_PER_TURN — there is no hard AP cap.

## APPENDIX F: CONFIRMED INTERACTION RULINGS

All confirmed edge-case rulings for the expansion. These must be implemented exactly as written — no exceptions.

| Ruling | Decision |
|--------|----------|
| Burn triggers through block | YES — Burn bonus is added to attack damage; block absorbs combined total |
| Bleed triggers on Poison ticks | NO — Bleed only triggers on card-play damage |
| Mastery 1→0→fail again | YES — curses at mastery 0, no grace period |
| Cursed facts in draws | Weighted priority — higher chance to appear in draws, not guaranteed every turn |
| Chain Lightning counts itself | YES — extends chain then uses new length for its own damage calculation |
| Null Shard + Chain Lightning | Chain length floors at 1; Chain Lightning works as basic 8-damage attack (Null Shard disables chain multiplier) |
| Frenzy + Eruption X-cost | Frenzy waives play cost; X still drains all remaining AP after surcharge (if any) |
| AP gain exceeds MAX_AP_PER_TURN | YES — no hard cap on AP; Sacrifice/Blood Price can push past 5 |
| Siphon Strike overkill heal | CAPPED at 10 HP max (heal = max(2, min(overkill, 10))) |
| Chameleon/Mimic/Aftershock copy | Copy BASE mechanic values, then apply their own multipliers |
| Battle Trance restriction | On QP/CW: blocks both playing AND Charging for the rest of that turn |
| Recollect + Inscriptions | Inscriptions are "remove from game" on exhaust — they cannot be Recollected |
| Stagger + enrage | Enemy turn counter advances (enrage ticks), but the action is skipped |
| Inscription of Wisdom CW | Intentional — 3 AP spent, card removed from game, zero persistent effect (complete fizzle) |
| Volatile Manuscript self-Burn | Works identically to enemy Burn — enemy hits trigger player's own Burn stacks on player |
| Mastery Surge on cursed card | Wasted — cursed facts are locked at effective mastery 0; surge has no effect |
| Dark Knowledge timing | Counts cursed facts at play time (snapshot), not at resolve time |
| Chain Anchor sets chain to 2 | Next same-chain card starts at chain length 2; Anchor itself is not a chain link |
| Synapse chain wildcard | YES — extends chain count by 1; wildcard matches any chain type |
| Chain Forge "continues" | Chain-breaking card gets current chain multiplier, chain count increments; once per encounter |
| Chromatic Chain carry | YES — carries across turns; completing a 3+ chain makes next turn's chain start at 2 |
| Aftershock memory | Current turn only — does not remember card effects across turns |
| Knowledge Bomb self-count | YES — its own correct Charge counts toward the total for the encounter |
| Conversion ratio | 1:1 — block converts to equal damage (10 block = 10 damage) |
| Phase Shift CC vs Iron Wave | Intentionally lower CC (12+12 vs 15+15 for Iron Wave CC) — per-play choice mode is the tradeoff |
| Reflex double-trigger | YES — 2 Reflex cards discarded in one turn = 6 block total, applied before enemy turn |
| Inscription application points | Fury: flat bonus added at step 3 of damage calc. Iron: block added at player turn start. Wisdom: triggers on CC resolution |
| Multiple same-type Inscriptions | Cannot stack — Pool = 1 per type, removed from game (not just exhausted) on play |
