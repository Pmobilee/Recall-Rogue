# AR-107: Relic & Card Effect Audit — Find and Fix Every Broken Effect

## Overview

**Goal:** Systematically test every relic and card mechanic to verify they actually affect gameplay. The headless sim revealed that `resolveAttackModifiers` and `resolveShieldModifiers` are computed but never applied — meaning attack/shield-boosting relics have ZERO effect in the real game.

**Why:** The balance data is meaningless if half the relics don't work. Players pick Whetstone expecting +2 attack damage, but it does nothing. This undermines the entire relic economy and makes the game feel unrewarding.

**Scope:**
- 24 starter relics + 18 unlockable relics = 42 relics to audit
- 16 card mechanics (attack, shield, utility, buff, debuff, wild, etc.) to verify
- Wire `resolveAttackModifiers` and `resolveShieldModifiers` into the combat pipeline

---

## Phase 1: Automated Relic Audit

### Build: `tests/playtest/headless/relic-audit.ts`

For EACH relic, run 200 encounters WITH the relic and 200 WITHOUT, then compare:
- Average damage dealt per encounter
- Average damage taken per encounter
- Average turns per encounter
- Survival rate

Any relic that shows NO statistical difference (within noise margin) is broken.

### Expected Findings

**Known broken (resolveAttackModifiers never called):**
- whetstone (+2 attack) — flatDamageBonus
- combo_ring (+1 damage on first charge) — first_charge_turn_damage_bonus
- reckless_resolve (+4 damage, +20% damage taken) — conditional flatDamageBonus
- volatile_core (+5 attack when HP<30%) — low_hp_damage_bonus
- blood_price (+5 attack, lose 3 HP per attack) — cursed attack bonus
- overflow_gem (+1 damage per card played this turn) — per-card stacking

**Known broken (resolveShieldModifiers never called):**
- aegis_stone (carry 50% block between turns) — persistent block
- resonance_crystal (+2 block on shield cards) — flatShieldBonus

**Known working (wired into turnManager hooks):**
- iron_shield (+2 block/turn) — via resolveTurnStartEffects ✓
- steel_skin (-3 damage taken) — via resolveDamageTakenEffects ✓
- herbal_pouch (heal 8 post-combat) — via post-encounter healing ✓
- last_breath (survive lethal once) — via resolveLethalEffects ✓
- regeneration_orb (heal at turn end) — via resolveTurnEndEffects ✓

**Uncertain (need testing):**
- vitality_ring (+20 max HP) — applied at run start, not per-encounter
- swift_boots (+1 draw) — via resolveBaseDrawCount, may work
- gold_magnet (+30% gold) — economy, not combat
- merchants_favor (+1 shop option) — economy
- lucky_coin (random buff at encounter start) — via resolveEncounterStartEffects
- scavengers_eye (see card rewards before choosing) — UI only
- tag_magnet (extra tag card drops) — reward only
- adrenaline_shard (first quick play costs 0 AP) — AP modifier
- insight_prism (see enemy intents 1 turn ahead) — UI only
- memory_nexus (echo cards retain 50% charge) — echo system
- plague_flask (poison on correct answer) — via resolveCorrectAnswerEffects

---

## Phase 2: Fix the Wiring

### The core fix: Wire resolveAttackModifiers into cardEffectResolver.ts

The damage calculation in `cardEffectResolver.ts` computes `mechanicBaseValue` but never applies relic flat/percent bonuses. Fix:

```typescript
// In resolveCardEffect(), after computing mechanicBaseValue:
import { resolveAttackModifiers } from './relicEffectResolver';

// After base damage is computed, apply relic bonuses for attack cards
if (card.cardType === 'attack' && turnState.activeRelicIds.size > 0) {
  const atkMods = resolveAttackModifiers(turnState.activeRelicIds, {
    cardType: card.cardType,
    baseDamage: mechanicBaseValue,
    tier: card.tier,
    isEcho: card.isEcho,
    playMode,
    comboCount: turnState.comboCount,
    playerHpPct: turnState.playerState.hp / turnState.playerState.maxHp,
    isFirstAttack: !turnState.firstAttackUsed,
  });
  mechanicBaseValue += atkMods.flatDamageBonus;
  mechanicBaseValue = Math.round(mechanicBaseValue * (1 + atkMods.percentDamageBonus));
}
```

### Wire resolveShieldModifiers for shield cards

```typescript
if (card.cardType === 'shield' && turnState.activeRelicIds.size > 0) {
  const shieldMods = resolveShieldModifiers(turnState.activeRelicIds);
  mechanicBaseValue += shieldMods.flatShieldBonus;
}
```

---

## Phase 3: Fix Individual Relics

After wiring the resolvers, verify each relic category:

### Attack relics
- [ ] whetstone: +2 flat damage on attacks
- [ ] combo_ring: +1 damage on first charge per turn
- [ ] reckless_resolve: +4 damage, +20% damage taken (cursed)
- [ ] volatile_core: +5 attack when HP < 30%
- [ ] blood_price: +5 attack, -3 HP per attack (cursed)
- [ ] overflow_gem: +1 damage per card played this turn

### Shield relics
- [ ] aegis_stone: carry 50% block between turns
- [ ] resonance_crystal: +2 block on shield cards

### Turn-based relics (should already work)
- [ ] iron_shield: +2 block at turn start
- [ ] steel_skin: -3 damage taken
- [ ] regeneration_orb: heal at turn end
- [ ] last_breath: survive lethal once

### Unlockable relics
- [ ] chain_reactor: 6 splash damage per chain link
- [ ] echo_chamber: replay first chain card at 60%
- [ ] quicksilver_quill: fast answer bonus
- [ ] time_warp: extra turn on perfect combo
- [ ] crit_lens: crit chance on high combo
- [ ] thorn_crown: thorns damage
- [ ] bastions_will: block on shield plays
- [ ] festering_wound: poison on wrong answer
- [ ] capacitor: store unused AP
- [ ] double_down: double damage on streak
- [ ] scholars_crown: bonus on mastered cards
- [ ] domain_mastery_sigil: domain accuracy bonus
- [ ] phoenix_feather: revive once
- [ ] scholars_gambit: extra relic slot
- [ ] prismatic_shard: random element on wild
- [ ] mirror_of_knowledge: copy last card effect
- [ ] toxic_bloom: poison cloud
- [ ] echo_lens: echo charge bonus

---

## Phase 4: Re-run Balance Sim

After all fixes, re-run the full ascension sweep to see the REAL balance with working relics.

---

## Success Criteria

- [ ] Automated audit identifies all broken relics with statistical evidence
- [ ] resolveAttackModifiers wired into cardEffectResolver
- [ ] resolveShieldModifiers wired into cardEffectResolver
- [ ] All 24 starter relics show measurable combat impact
- [ ] Headless sim survival rates change meaningfully with relics
- [ ] Re-run produces updated balance data
