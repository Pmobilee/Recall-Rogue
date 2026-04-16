# Full Run Playtest v4 — BATCH-2026-04-16-004

**Date:** 2026-04-16  
**Agent:** Claude Sonnet 4.6  
**Config:** Mixed domain, 60% accuracy simulation  
**Runs played:** 2 (Run 1 abandoned after map stuck; Run 2 played until stuck by same root cause)

---

## Run Summary

**Run 1** reached Floor 1, completing 1 proper combat (Pop Quiz, 30 HP) + 1 mystery event ("Ambush!" → Index Weaver, 42 HP). The mystery-triggered combat completed but left the CombatScene in a corrupted state (drawImage crash), blocking further map traversal from r2. Run abandoned.

**Run 2** reached Floor 1, completing 1 proper combat (Staple Bug, 54 HP) across 15 turns. HP: 100 → 17/100. Accepted reward successfully (BUG-2 confirmed). Second combat entered (Staple Bug again, 62 HP) but combat UI failed to render in DOM due to drawImage crash from Run 1's lingering Phaser scene in same browser session.

Neither run reached Floor 2 or Floor 3. The drawImage crash is the blocking issue.

---

## Verdict: ISSUES

BUG-2 is confirmed fixed. BUG-1 has a deeper root cause than the retry mechanism addresses — the `drawImage` crash causes a corrupted CombatScene state that blocks future map traversal and combat UI rendering, particularly when triggered by mystery-ambush combats.

---

## Bug Fix Verification (PRIMARY GOAL)

### BUG-1: drawImage crash — PARTIAL FIX / DEEPER ISSUE

**Status: STILL OCCURRING, root cause not resolved**

The crash fires as an unhandled rejection on every CombatScene that encounters a texture-not-ready condition:

```
"Unhandled rejection: Cannot read properties of null (reading 'drawImage')"
"Uncaught TypeError: Cannot read properties of null (reading 'drawImage')"
```

**What the retry does:** The 3x retry in `setEnemy` apparently allows combat to proceed visually in SOME cases. Run 2's Staple Bug combats loaded successfully despite these errors existing in the log from the prior run. Combat state was accessible via `getCombatState()`.

**What the retry does NOT fix:**
1. The unhandled Promise rejection still propagates and is logged.
2. When the crash hits a mystery-ambush combat (Run 1, Index Weaver), the CombatScene stays running as a zombie (18 FPS for 63 seconds) with Phaser objects rendering over the DungeonMap, but no DOM combat UI renders. Map node r2+ becomes untraversable because the Phaser scene never properly initializes a new combat.
3. In Run 2's second combat entry, the DOM `btn-end-turn` was missing — Phaser state was valid (`getCombatState` returned data) but no combat UI was rendered in DOM. Same failure mode.
4. The `getScreen()` API reports `dungeonMap` while `getCombatState()` returns valid combat data — the screen state is desynchronized.

**Evidence:** Log shows FPS dropping to 18 in CombatScene for 63s during Run 1 mystery combat, before the drawImage errors fired. The scene ran but crashed during initialization, leaving a ghost combat scene.

**Recommendation:** The unhandled rejection must be caught at the Promise level (not just retried inside `setEnemy`). The `drawImage` call likely comes from a texture that hasn't loaded into WebGL. Need to either await texture loading before calling draw, or catch the rejection in the calling Promise chain and transition to a fallback/retry state cleanly.

### BUG-2: rewardRoom stuck — CONFIRMED FIXED ✅

**Tested twice successfully:**

**Run 1, after Pop Quiz:**
```
acceptReward() → {ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}
getScreen() → "dungeonMap"
```

**Run 2, after Staple Bug (15-turn fight):**
```
acceptReward() → {ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}
getScreen() → "dungeonMap"
```

Both cases: instant transition, no crash, no stuck state. The force-continue fix is working correctly.

### BUG-3: Mystery distractor quality — OBSERVED

The mystery event "Ambush!" fired with a Continue-only choice button (`data-testid="mystery-continue"`), not a `.choice-btn` element. The `selectMysteryChoice(0)` API failed ("only 0 visible .choice-btn elements"). Had to fall back to `eval` clicking `mystery-continue` directly.

This is a secondary issue — `getMysteryEventChoices` only returns Continue-type events as `[{index: 0, text: "Continue"}]` but the `selectMysteryChoice` API doesn't handle Continue buttons. The distractor quality issue (documented in v3) was not separately observable since we only saw one mystery and it was an ambush.

---

## Balance & Difficulty (HP curve, enemy difficulty, combat turns)

**Run 1:**
- Pop Quiz (30 HP, 12 attack): 3 turns to kill. Player took 12 damage. Light.
- Index Weaver (42 HP, multi-attack 3 hits): 4+ turns. Player went from 96→43 HP before scene crashed. Multi-attacks hit for 22 total per turn — very punishing at low AP/block.

**Run 2:**
- Staple Bug (54 HP): 15 turns to kill. Player went from 100→17 HP. This enemy has a brutal regenerating 10 block every 2-3 turns. Most attack cards deal 4 base damage, so each turn only chips 4-9 HP after block. The fight was dramatically too long for a first-floor enemy.

**Balance concern (major):** Staple Bug with regenerating 10 block is extremely difficult for a run opener. 15 turns at low mastery is punishing and unfun. The player dealt on average only 2-3 net HP damage per turn through the block. With 5 AP available but only 3 starting AP, and most cards dealing 4 base damage, the math doesn't add up for a short combat. Recommend reducing Staple Bug block regeneration frequency or HP on floor 1.

**HP curve:** Both runs would have died before floor 2 against the Staple Bug pattern. At 17 HP with 25 HP for Run 2's second combat, death was nearly certain.

---

## Chain Strategy (momentum, mastery upgrades, charge decisions)

- Chain momentum is largely theoretical when every card is from a different domain (mixed deck). Chain types rarely aligned for free second charges.
- Charge attacks consistently answered correctly (~70% rate, slightly above the 60% target — new facts answered at 40% but returning facts at 80%+).
- The 2 AP cost for charge means only 1 charge per 3 AP is possible. With 3 starting AP and no AP relics, strategic options are limited.
- `chargePlayCard` with index tracking was unreliable — after playing a card, the indices shift and the next charge often targeted the wrong card type. This caused several "Not enough AP" failures in the logs.

**Recommendation:** The agent's index-based card selection is fragile due to shifting indices. The hand shifts after each play, requiring re-read of `getCombatState` after every card play for accurate targeting.

---

## FSRS Progression

- Cards seen across both runs: Kiribati independence, Vega pole star, Gun recoil, Osiris pharaoh, Chromosome theory, Mead ingredients, Martha Gellhorn, Wafer surfaces, Ronald Fisher
- Repeated appearances of `card_48` (gun recoil, strike) and `card_42`/`card_103` across turns suggest FSRS is not yet spacing these — they appear every 2-3 turns within the same run.
- `ap_phys1_recoil_gun` appeared in both Run 1 and Run 2, consistently answered correctly.

---

## Fun & Engagement (highlights/lowlights)

**Highlights:**
- Pop Quiz went down in 3 turns — felt satisfying and fast.
- Mystery "Ambush!" event with "The room seemed empty until the books started moving..." — great flavor, felt appropriately surprising.
- acceptReward transition is now smooth and instant — noticeably better than pre-fix.
- Piercing attacks (`mythology_folklore-pegasus-bellerophon-chimera`) available as reward showed good strategic depth potential.

**Lowlights:**
- Staple Bug at 15 turns was a marathon of attrition with no interesting decisions. Each turn: "play attacks, enemy blocks, take multi-attack damage." Zero strategic variation.
- HP reaching 17/100 on floor 1 enemy #1 of Run 2 is extremely punishing for a new player.
- Index Weaver (mystery ambush) multi-attack dealing 22 per turn at 3 hits is brutal for an early-floor surprise encounter.
- The game got stuck twice due to drawImage crash — very frustrating from a player perspective.

---

## Room Coverage (mystery/shop/rest — did you visit any?)

- **Mystery:** 1 mystery event visited (Run 1, r1-n0: "Ambush!"). Only option was Continue, which led to combat. No branching choices observed.
- **Shop:** Not reached.
- **Rest:** Not reached.
- **Elite:** Not reached.
- **Boss:** Not reached.

Both runs stuck on Floor 1 due to bug or HP depletion risk.

---

## Narration (every line captured)

`getNarrativeText()` returned `null` on every call throughout both runs. No narration text was presented at any map transition point. Either the narration system is inactive, or `getNarrativeText` is queried too early before text loads.

---

## Per-Encounter Log

| # | Run | Floor | Enemy | Turns | HP Before→After | Reward OK? | drawImage crash? |
|---|-----|-------|-------|-------|-----------------|------------|------------------|
| 1 | 1 | F1 | Pop Quiz (30 HP) | 3 | 100→88 | ✅ dungeonMap | No (0 errors at entry) |
| 2 | 1 | F1 | Index Weaver (42 HP, mystery ambush) | 4+ | 96→43 | ❌ No reward room (mystery flow) | YES — scene crashed, zombie Phaser |
| 3 | 2 | F1 | Staple Bug (54 HP) | 15 | 100→17 | ✅ dungeonMap | From session log (run 1 errors) |
| 4 | 2 | F1 | Staple Bug (62 HP) | — | 25 start | ❌ Combat UI not rendered | From session log (carry-over) |

---

## Raw Data

### drawImage Error Log (full)
```
"Unhandled rejection: Cannot read properties of null (reading 'drawImage')"
"Uncaught TypeError: Cannot read properties of null (reading 'drawImage')"
Low FPS alert: 31 fps in CombatScene for 3s
Low FPS alert: 18 fps in CombatScene for 63s
```
Both errors originated from Run 1's mystery-ambush combat (Index Weaver). Run 2's combats did not add new drawImage errors.

### Run States
- Run 1 abandoned: HP 43/100, gold 20, floor 1 stuck
- Run 2 end state: HP 25/100, gold 20, floor 1 stuck in ghost combat

### acceptReward() API responses (both clean)
```
Run 1: {ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}
Run 2: {ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}
```

### Mystery Event selectMysteryChoice() API bug
```
getMysteryEventChoices() → [{index: 0, text: "Continue"}]
selectMysteryChoice(0) → {ok: false, message: "Mystery choice 0 not found (only 0 visible .choice-btn elements)"}
```
Continue button has `data-testid="mystery-continue"` but is not a `.choice-btn`. The API needs to handle this button type.

### Cards Rewarded
- Run 1: Reinforce (history, shield, tier 1, ap_euro_u7_comte_positivism)
- Run 2: Piercing (mythology_folklore, attack, tier 1, mythology_folklore-pegasus-bellerophon-chimera)

### Enemy Intents Observed
- Pop Quiz: `attack` (Cap strike) 12 display dmg
- Index Weaver: `multi_attack` 3 hits (Fang barrage) 10-12 display dmg
- Staple Bug: `defend` (Harden shell) 10 block → `multi_attack` 2 hits (Chittering strike) 12 dmg → `attack` 22 dmg
