# AR-97: Relic Balance Pass — Data-Driven Retuning

## Overview

**Goal:** Retune all 42 relics based on 1.96M simulation runs (V2 improved simulator) to achieve a healthy tier distribution where most relics feel impactful but none are game-breaking.

**Motivation:** Current relic balance is catastrophically skewed:
- **7 S-tier** relics (all with score >50) dominate every run
- **22 F-tier** relics (negative or near-zero impact) are functionally dead weight
- **Phoenix Feather** alone scores **32,470** — 36× stronger than the #2 relic
- Only 3 A-tier and 2 B-tier relics exist — the middle ground is empty
- Players picking up a D-tier relic get *worse* outcomes than having no relic at all

**Target distribution:** ~5 S-tier, ~8 A-tier, ~15 B-tier, ~10 C-tier, ~2-4 D-tier (build-specific niche)

**Dependencies:** AR-95 (complete), AR-96 (complete)
**Estimated complexity:** MEDIUM — balance value changes only, no new systems

---

## Current Tier Distribution (from 490K solo relic runs)

| Tier | Count | Relics | Target Count |
|------|-------|--------|--------------|
| S (>50) | 7 | phoenix_feather (32470!), aegis_stone (895), combo_ring (369), iron_shield (293), last_breath (131), whetstone (84), blood_price (54) | 4-5 |
| A (25-50) | 3 | prismatic_shard (40), regeneration_orb (40), overflow_gem (39) | 6-8 |
| B (10-25) | 2 | scholars_gambit (22), mirror_of_knowledge (17) | 12-15 |
| C (0-10) | 17 | insight_prism through capacitor | 8-10 |
| D (<0) | 8 | domain_mastery_sigil through echo_chamber | 2-4 |

---

## Sub-Steps

### Phase 1: Nerf S-Tier Outliers

#### 1.1 Phoenix Feather — MASSIVE NERF
**Current:** Once per run: resurrect at 30% HP + auto-Charge free for 2 turns
**Score:** 32,470 (absurd — 36× next relic)
**Problem:** A single lethal save turns 0-3% survival into 71%. The resurrection + 2 free auto-charge turns creates a massive power spike on top of a second life.

**Change:**
- Resurrect HP: 30% → **15%** (barely alive, tension preserved)
- Auto-Charge turns: 2 → **1** (still a burst but not a full recovery)
- Add: **Curse penalty: lose 1 max HP permanently each floor after resurrection** (the phoenix burns you)

**Files:** `src/data/relics/unlockable.ts` (description/effects), `src/services/relicEffectResolver.ts` (resolveLethalEffects)

#### 1.2 Aegis Stone — MODERATE NERF
**Current:** Block carries between turns (max 25). At 25 block, gain Thorns 3.
**Score:** 895
**Problem:** Persistent block is extremely strong — shield cards become permanent HP. Max 25 is too high.

**Change:**
- Block carry cap: 25 → **15**
- Thorns trigger threshold: 25 → **15** (still triggers, just at lower cap)
- Thorns value: 3 → **2**

**Files:** `src/data/relics/starters.ts` (effects values), `src/services/relicEffectResolver.ts`

#### 1.3 Combo Ring — MODERATE NERF
**Current:** First Charged correct per turn: +2 damage to all attacks that turn
**Score:** 369
**Problem:** +2 flat damage on EVERY attack after one correct charge is massive — with 3-4 attacks per turn that's +6-8 damage per turn for a single common relic.

**Change:**
- Damage bonus: +2 → **+1** per attack rest of turn
- Keep the trigger (first charge correct/turn)

**Files:** `src/data/relics/starters.ts`, `src/services/relicEffectResolver.ts`

#### 1.4 Iron Shield — SLIGHT NERF
**Current:** Start each turn with 3 block
**Score:** 293
**Problem:** Free 3 block every turn is equivalent to 3 damage reduction permanently. Over a 50-turn encounter that's 150 "free" HP.

**Change:**
- Block per turn: 3 → **2**

**Files:** `src/data/relics/starters.ts`, `src/services/relicEffectResolver.ts`

#### 1.5 Last Breath — REBALANCE
**Current:** Once per encounter: survive lethal at 1 HP, gain 8 block
**Score:** 131
**Problem:** Once per ENCOUNTER (not run) means it triggers in every fight. Combined with healing, it's nearly unkillable.

**Change:**
- Trigger: once per encounter → **once per 3 encounters** (internal cooldown)
- Block on trigger: 8 → **12** (stronger when it does fire, but rarer)

**Files:** `src/data/relics/starters.ts`, `src/services/relicEffectResolver.ts`

---

### Phase 2: Buff D-Tier & Low C-Tier Relics

These relics have NEGATIVE impact — picking them up makes you worse. They need meaningful buffs.

#### 2.1 Herbal Pouch — BUFF
**Current:** Heal 4 HP after each combat encounter
**Score:** -0.3 (D-tier!)
**Problem:** 4 HP heal is trivial — enemies deal 14-73 damage per encounter. This heals <5% of damage taken.

**Change:**
- Heal: 4 → **8** HP post-combat
- Add: **+2 HP per correct Charge in the encounter** (knowledge rewards healing, caps at +20)

**Files:** `src/data/relics/starters.ts`, `src/services/relicEffectResolver.ts`

#### 2.2 Steel Skin — BUFF
**Current:** Take 1 less damage from all sources (min 1)
**Score:** -0.2 (D-tier!)
**Problem:** -1 damage is meaningless when enemies hit for 15-50. It's noise.

**Change:**
- Flat reduction: 1 → **3** damage from all sources (min 1)

**Files:** `src/data/relics/starters.ts`, `src/services/relicEffectResolver.ts`

#### 2.3 Echo Chamber — BUFF
**Current:** 3+ chain: replay first card at 50% (no quiz/AP)
**Score:** -0.3 (D-tier!)
**Problem:** 3+ chains are extremely rare (our data shows max chain length is usually 2-3). The trigger almost never fires.

**Change:**
- Chain threshold: 3+ → **2+** (triggers on 2-chains, which happen regularly)
- Replay power: 50% → **60%**

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicEffectResolver.ts`

#### 2.4 Chain Reactor — BUFF
**Current:** 3+ chains deal 4 splash damage per link
**Score:** -0.2 (D-tier!)
**Problem:** Same as echo_chamber — 3+ chains too rare. And 4 splash damage is trivial.

**Change:**
- Chain threshold: 3+ → **2+**
- Splash damage: 4 → **6** per link

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicEffectResolver.ts`

#### 2.5 Festering Wound — BUFF
**Current:** 5+ poison on enemy: all attacks +30% damage
**Score:** -0.2 (D-tier!)
**Problem:** Poison stacking to 5 requires multiple hex cards AND correct charges. Very hard to trigger.

**Change:**
- Poison threshold: 5 → **3** stacks
- Damage bonus: +30% → **+40%**

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicEffectResolver.ts`

#### 2.6 Domain Mastery Sigil — BUFF
**Current:** 6+ same-domain facts in deck: +20% base damage for same-domain cards
**Score:** -0.1 (D-tier!)
**Problem:** The simulator uses generic facts without real domains. But even conceptually, 6 same-domain facts is hard to achieve and +20% is modest.

**Change:**
- Domain threshold: 6 → **4** facts
- Damage bonus: +20% → **+30%**

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicEffectResolver.ts`

#### 2.7 Time Warp — BUFF
**Current:** Surge turns: timer halved, Charge multiplier 4.0×
**Score:** -0.1 (D-tier!)
**Problem:** Timer-based — can't work in headless. But even in real play, halving the timer is risky. The 4.0× multiplier is strong but surge only comes every 3 turns.

**Change:**
- Keep timer half (real game challenge)
- Charge multiplier: 4.0× → **5.0×** (make the reward match the risk)
- Add: **+1 AP on surge turns** (enables a burst combo with the time pressure)

**Files:** `src/data/relics/unlockable.ts`, `src/services/relicEffectResolver.ts`

---

### Phase 3: Buff C-Tier Relics to B-Tier

These relics have minimal positive impact (0-10 score). They need modest buffs to feel meaningful.

#### 3.1 Vitality Ring — BUFF
**Current:** +12 max HP
**Score:** 2.0
**Problem:** +12 HP is nice but doesn't scale with the game's damage growth (enemies deal 30+ damage by mid-game).

**Change:**
- Max HP bonus: 12 → **20**

#### 3.2 Swift Boots — BUFF
**Current:** Draw 6 cards per turn instead of 5
**Score:** 7.7
**Problem:** +1 card is good but subtle. The relic doesn't feel impactful.

**Change:**
- Keep draw 6
- Add: **Unplayed cards at end of turn grant 2 block each** (instead of current 1 block)

#### 3.3 Volatile Core — REWORK
**Current:** +40% attack damage, wrong Charges deal 5 damage to both
**Score:** 0.1
**Problem:** The self-damage on wrong answers is too punishing — it cancels out the +40% attack bonus.

**Change:**
- Attack bonus: +40% → **+50%**
- Self-damage on wrong: 5 → **3** (still punishing but survivable)

#### 3.4 Bastion's Will — BUFF
**Current:** Charged shield cards +50% block
**Score:** 0.1
**Problem:** Only works on Charged shield cards — a narrow trigger that requires both playing shields AND charging them.

**Change:**
- Block bonus: +50% → **+75%**
- Add: **Quick Play shield cards also get +25% block** (smaller bonus but always works)

#### 3.5 Capacitor — BUFF
**Current:** Store unused AP (max 3), release next turn
**Score:** 0.1
**Problem:** Requires intentionally skipping plays to build up AP — counterproductive in combat.

**Change:**
- Release bonus: 1:1 → **1.5:1** (store 2 AP, get 3 next turn)
- This makes "save a turn" actually feel powerful

#### 3.6 Scholars Crown — BUFF
**Current:** Tier 2+ Charged +30%, Tier 3 auto-Charged +50%
**Score:** 0.1
**Problem:** Most cards in the simulator are Tier 1 — Tier 2/3 cards are rare early.

**Change:**
- Tier 2 bonus: +30% → **+40%**
- Tier 3 bonus: +50% → **+75%**
- Add: **Tier 1 Charged +10%** (small but ensures every card gets something)

---

### Phase 4: Update Simulator Relic Handling

After changing relic definitions and effect resolver values, update the simulator's manual relic calculations in `tests/playtest/core/headless-combat.ts` to match:

- `iron_shield`: turn start block 3 → 2
- `whetstone`: keep at +2 (unchanged)
- `combo_ring`: +2 → +1
- `steel_skin`: -1 → -3
- `herbal_pouch`: 4 → 8 HP heal
- `swift_boots`: unplayed card block 1 → 2
- `vitality_ring`: +12 → +20 max HP
- `aegis_stone`: block carry cap 25 → 15, thorns 3 → 2
- `volatile_core`: +40% → +50% attack, self-damage 5 → 3

Also update the S-tier and B-tier relic sets used in the strategy's `selectRelicReward()` and `selectCardReward()` to reflect new tiers.

---

### Phase 5: Update Relic Effect Resolver

Modify `src/services/relicEffectResolver.ts` to implement all the balance changes from Phases 1-3. This is where the actual combat math happens.

Key functions to update:
- `resolveTurnStartEffects` — iron_shield block
- `resolveAttackModifiers` — combo_ring, volatile_core
- `resolveDamageTakenEffects` — steel_skin
- `resolveEncounterEndEffects` — herbal_pouch
- `resolveLethalEffects` — phoenix_feather, last_breath
- `resolveMaxHpBonus` — vitality_ring
- `resolveShieldModifiers` — bastion's_will
- `resolveChargeCorrectEffects` — scholars_crown

---

## Verification Gate

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] `npx vitest run` — all tests pass
- [ ] Re-run solo relic analysis: `npx tsx scripts/mass-simulate.ts --mode solo --seeds 1000 --ascension 0,5,10 --output data/playtests/relic-balance-test.json`
- [ ] Phoenix Feather score drops from 32,470 to <500
- [ ] D-tier relics move to C-tier or higher
- [ ] Tier distribution approaches target: ~5 S / ~8 A / ~15 B / ~10 C / ~2-4 D
- [ ] Overall survival rates improve (relics are now more impactful across the board)
- [ ] No relic has negative impact (D-tier relics should be niche, not harmful)

---

## Expected Impact

- **Phoenix Feather** drops from 32,470 to ~200-500 range (still strong but not game-breaking)
- **D-tier relics** move to C/B-tier (herbal_pouch from -0.3 to ~15-25, steel_skin from -0.2 to ~10-20)
- **Overall survival** improves 5-15% across profiles as relic pool becomes more uniformly impactful
- **Player experience**: picking up ANY relic should feel good, not "oh great, another useless one"
