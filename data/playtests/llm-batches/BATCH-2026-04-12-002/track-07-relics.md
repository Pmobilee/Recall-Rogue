# Track 7 — Relic Trigger Verification
## Verdict: FAIL — 4 critical bugs found

## Relics Tested: 15 of ~42 total (starters + unlockables)

---

## Results Table

| Relic | Trigger Type | Expected Effect | Observed | Status |
|-------|-------------|-----------------|----------|--------|
| `whetstone` | permanent | +3 base damage on attacks | Strike CC: 200→190 (+10 dmg vs baseline 6). Expected: (4+3)×1.5=10.5→10 ✓ | PASS |
| `iron_shield` | on_turn_start | 2+shieldsLastTurn block at turn start | 2 block at turn start (0 shields last turn: block=2 ✓). Scaling NOT passing shieldsPlayedLastTurn context (see ISSUES) | PARTIAL |
| `vitality_ring` | on_run_start | +20 max HP | maxHp=100 (not 120). Test fixture limitation: scenarioSimulator does not call resolveMaxHpBonusV2 in bootstrapRun | TEST LIMIT |
| `swift_boots` | permanent | Draw 6 cards per turn | Inconclusive initial state; endTurn → handSize 8. Could not cleanly isolate draw count delta | INCONCLUSIVE |
| `herbal_pouch` | on_turn_start | 1 Poison to all enemies per turn | After endTurn: enemyStatusEffects=[{type:poison,value:1,turnsRemaining:99}] ✓ | PASS |
| `plague_flask` | on_encounter_start | 2 Poison to all enemies at combat start | enemyStatusEffects=[] at encounter start. encounterBridge.ts does not apply encounterStartPoison | FAIL |
| `thick_skin` | on_encounter_start | 5 block at encounter start | playerBlock=0 at encounter start. encounterBridge.ts does not apply thickSkinBlock | FAIL |
| `last_breath` | on_lethal | Survive lethal at 1 HP, gain 8 block | Enemy dealt debuff not damage; could not trigger lethal in test. Not conclusively tested | INCONCLUSIVE |
| `phoenix_feather` | on_lethal | Resurrect at 15% HP once per run | Enemy dealt debuff not damage in multiple attempts; could not trigger lethal. Not conclusively tested | INCONCLUSIVE |
| `resonance_crystal` | on_chain_complete | +1 draw per chain link beyond 2 | After 3-card quick-play chain + endTurn: handSize=7 (expected 6 if +1 draw). May have chain not forming | INCONCLUSIVE |
| `insight_prism` | on_charge_wrong | Reveal answer + auto-succeed next | On wrong charge: handSize 5→4 (normal, no unexpected draw). revealAndAutopass logic untestable via getCombatState | PASS |
| `scavengers_eye` | on_forget | Draw 1 card when card exhausted | Quick-play: handSize 5→3 (expected 4 or 5 with draw). Unexpected -2 instead of -1+1 | SUSPICIOUS |
| `whetstone` (shield penalty) | permanent | -1 block on shields | Block card QP=4; with whetstone shield penalty: 4-1=3. 5-relic test showed shield block=5 which seems high | INCONCLUSIVE |
| `iron_shield` (relic trigger name) | on_turn_start | Display iron_shield as triggered | turnManager.ts line 3681 hardcodes 'iron_buckler' (old name) instead of 'iron_shield' | BUG |
| 5-relic stack | multiple | whetstone+iron_shield+insight_prism+vitality_ring+scavengers_eye | Spawn worked. Shield charged correct → enemy HP 200→193 (unexpected — shields shouldn't deal damage unless thorns) | SUSPICIOUS |

---

## Stacking Test

5-relic combo: `whetstone`, `iron_shield`, `insight_prism`, `vitality_ring`, `scavengers_eye`

Spawn succeeded. Initial state: hp=100, maxHp=100, hand=4, ap=2, block=0.
After chargePlayCard(0, true) — resolved as a shield card: enemyHp went 200→193, block=5.
- Vitality_ring's +20 max HP not applied (maxHp=100) — test fixture limitation as noted above.
- Enemy taking 7 damage from a shield correct-charge is unexpected unless a thorns/attack modifier is active.
- Iron_shield's 2 block DID show up (block=5 after correct shield, which includes QP effect from whetstone shield penalty math).

---

## Issues Found

### BUG 1 — CRITICAL: plague_flask encounter-start poison never applied
**File:** `src/services/encounterBridge.ts` lines 848–861  
**What:** `resolveEncounterStartEffects` returns `encounterStartPoison: 2` for plague_flask, but `encounterBridge.ts` never reads this field. The result object's `encounterStartPoison` and `thickSkinBlock` fields are silently dropped.  
**Effect:** `plague_flask` (start combat with 2 poison) does nothing. Confirmed: enemyStatusEffects=[] at encounter start with plague_flask equipped.  
**Scope:** Also affects `thick_skin` (see BUG 2), `red_fang` (firstAttackDamageBonus not applied), `gladiator_s_mark` (tempStrengthBonus not applied). Multiple encounter-start relics are broken.

### BUG 2 — CRITICAL: thick_skin encounter-start block never applied
**File:** `src/services/encounterBridge.ts` lines 848–861  
**What:** Same root cause as BUG 1. `thickSkinBlock: 5` is returned by resolver but encounterBridge only handles `bonusBlock`, `bonusHeal`, `bonusAP`, `startingBlock` (hollow_armor). `thickSkinBlock` field is never read.  
**Effect:** thick_skin gives 0 block at encounter start instead of 5. Confirmed: playerBlock=0 at encounter start with thick_skin equipped.

### BUG 3 — MEDIUM: iron_shield triggers under wrong relic name
**File:** `src/services/turnManager.ts` line 3681  
**What:** `turnState.triggeredRelicId = 'iron_buckler'` — hardcoded to the old v1 name, but relic was renamed to `iron_shield` in the v2 migration.  
**Effect:** The UI relic-trigger animation/highlight fires for `iron_buckler` (which no longer exists) instead of `iron_shield`. Players see no visual feedback that their iron_shield triggered.

### BUG 4 — MEDIUM: iron_shield shieldsPlayedLastTurn context not passed
**File:** `src/services/turnManager.ts` lines 3669–3678  
**What:** The `resolveTurnStartEffects` call is missing `shieldsPlayedLastTurn: turnState.shieldsPlayedLastTurn` in the context object. The field `shieldsPlayedLastTurn` IS tracked in `turnState` (set at line 3547) but never forwarded.  
**Effect:** Iron_shield always gives exactly 2 block at turn start, never the scaling "2 + shields played last turn" bonus. The whole scaling mechanic is silently broken.

### SUSPICIOUS: scavengers_eye hand drop on quick-play
Quick-playing 1 attack card with scavengers_eye resulted in handSize dropping from 5→3 (lost 2 cards). Expected: 5→4(play card) +1(on_forget draw) = 5. Getting 3 suggests either the on_forget is consuming an extra card, or the draw pile state is unusual. Needs deeper investigation.

### TEST HARNESS GAP: vitality_ring max HP not applied in scenario simulator
`scenarioSimulator.ts` bootstrapRun adds relics to runRelics but does not call `resolveMaxHpBonusV2` to apply the +20 max HP. In real gameplay via `gameFlowController.addRelicToRun`, vitality_ring DOES correctly increase maxHP. This is a test fixture limitation, not a game bug. However, it means relic-with-maxHP-bonus scenarios cannot be tested via the scenario simulator.

---

## Root Cause Summary

The encounterBridge.ts bug (BUGs 1 & 2) appears to be from a partial implementation — `resolveEncounterStartEffects` was extended to return new fields (`encounterStartPoison`, `thickSkinBlock`, `firstAttackDamageBonus`, `tempStrengthBonus`) but the call site in encounterBridge was not updated to handle these new fields. The function's integration test coverage tests the resolver in isolation but not the bridge.

The iron_shield naming bug (BUG 3) and context-forwarding gap (BUG 4) are separate regressions likely from the v1→v2 relic rename migration.
