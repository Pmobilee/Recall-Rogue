# Full Run Playtest — BATCH-2026-04-16-003
**Date:** 2026-04-16  
**Tester:** Claude Sonnet (LLM agent)  
**Objective:** FULL RUN PLAYTEST v3 — POST CAMERA-CRASH FIX  
**Primary Goal:** Verify `acceptReward()` no longer crashes after the Phaser camera fix  
**Domain:** mixed  
**Simulated quiz accuracy:** ~60%  
**Docker agent ID:** `llm-playtest-BATCH-2026-04-16-003`  
**Container:** warm mode, SwiftShader WebGL 2.0  

---

## Run Summary

| Floor | Combat | Enemy | Result | Player HP (end) | Turns |
|-------|--------|-------|--------|----------------|-------|
| 1 | Combat 1 | Stonebound Sentinel (80 HP) | Win | 58/100 | ~9 |
| 2 | Combat 2 | Crystalline Defiler (78 HP) | Win | 58/100 | ~9 |
| 3 | Combat 3 | Mold Puff (52 HP) | Win | 30/100 | 14 |

**Final state:** Reached Floor 4 map after clearing 3 combat rooms. Run still active at end of session.

---

## PRIMARY FINDING: acceptReward() Camera Crash Fix — CONFIRMED ✅

`acceptReward()` was tested 3 times across all 3 combats. All 3 returned success.

| Test | Combat | Response |
|------|--------|----------|
| 1 | After Combat 1 (Floor 1) | `{ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}` |
| 2 | After Combat 2 (Floor 2) | `{ok: true, message: "Reward accepted via Phaser scene. Screen: dungeonMap"}` |
| 3 | After Combat 3 (Floor 3) | `{ok: true, message: "Reward accepted via Phaser scene. Screen: rewardRoom"}` |

Tests 1 and 2 auto-transitioned to `dungeonMap` correctly. Test 3 stayed on `rewardRoom` (reward card selection still open), required `navigate('dungeonMap')` to proceed. No camera crash occurred across any of the 3 transitions. Fix is stable.

**Note on test 3:** `acceptReward()` reported success but the screen stayed on `rewardRoom`. This may be normal behavior when there are card rewards still to be chosen, or it may be that `acceptReward()` handles gold/vials but the card selection phase requires a separate interaction. Worth investigating — see bugs section.

---

## BUGS FOUND

### BUG-1: Intermittent Phaser `drawImage` Crash — HIGH SEVERITY (RECURRING)
**Frequency:** 2 out of 3 map node transitions that led to combat  
**Trigger:** Clicking a combat node on the dungeon map immediately after returning from a reward room  
**Error:** `TypeError: Cannot read properties of null (reading 'drawImage')` at `Frame2.updateUVs` → `CombatScene.setEnemy` → `CombatBridge.syncCombatScene` / `encounterBridge.startEncounterForRoom`  
**Symptom:** Screen stays on `dungeonMap` after node click; `getScreen()` returns `dungeonMap`. However `getCombatState()` correctly returns combat data, meaning game logic loaded while visual scene failed.  
**Workaround:** Call `window.__rrPlay.navigate('combat')` after the failed click. The game logic is already running; the forced navigation makes the UI show the combat screen.  
**Reproducibility:** Occurred at r1-n0 transition (after Combat 1 reward) and r4-n0 transition (after Combat 2 reward). Both crashes followed an `acceptReward()` call that returned the player to the map.  
**Hypothesis:** Canvas context may be nullified during the reward→map scene transition and not yet re-initialized when the next combat starts. `setEnemy` fires before the canvas is ready.  
**Files:** `src/game/scenes/CombatScene.ts` (line ~917, `setEnemy`), `src/services/encounterBridge.ts`

### BUG-2: rewardRoom not auto-transitioning after acceptReward (Test 3)
**Severity:** LOW / UX issue  
**Trigger:** After Combat 3, `acceptReward()` returned `ok: true` but the screen stayed on `rewardRoom` for 10+ seconds. No automatic transition to `dungeonMap` occurred. Required `navigate('dungeonMap')` to continue.  
**Note:** Combats 1 and 2 transitioned correctly. This may be related to whether card rewards are shown — in test 3 there were 3 card rewards visible on the Phaser layer. The reward room has a "Continue" button in Phaser at (960, 950) but clicking it via DOM or PointerEvent canvas simulation had no effect.  
**Workaround:** `window.__rrPlay.navigate('dungeonMap')` works.

### BUG-3: Mystery Event Distractor Quality — MEDIUM (CONTENT)
**Event:** "The Inscription" mystery event (encountered Floor 2)  
**Question type:** Date / era question about baking history  
**Distractors:** "Jonathan Swift" and "Zinc" appeared as distractors for a question about when commercial baking powder was invented  
**Issue:** Both distractors are completely unrelated to the question domain (one is an author from 1700s, one is a chemical element). Quiz distractors should be plausible wrong answers in the same category, not random unrelated items.  
**Impact:** Trivializes the quiz — any player who doesn't know the answer can instantly eliminate obviously wrong distractors.  
**Affected deck:** mystery event distractor pool (not a regular deck card)

---

## SECONDARY FINDINGS

### FSRS Mastery Progression Observed
Cards gained mastery levels through correct charge-play answers across the run, with visible effect value increases:

| Card | Starting mastery | Ending mastery | Effect value change |
|------|-----------------|----------------|---------------------|
| Kuiper Belt (strike) | 0 | 5 | 4 → 8 |
| Yin-yang (strike) | 0 | 5 | 5 → 8 |
| Germany/Palau (strike) | 2 | 3 | 5 → 6 |
| Actaeon (strike) | 1 | 2 | 4 → 5 |
| Arsenic (strike) | 0 | 2 | 4 → 5 |
| Anode Oxidation (attack) | 0 | 3 | 4 → 6 |

Mastery progression is clearly working. Mastery 5 cap gives baseEffectValue = 8 for tier-1 strike cards.

### Poison Stacking Observed
Mold Puff applied poison via "Toxic cloud" debuff each turn (value: 2, turns: 3). Poison stacked additively on repeated applications:
- Turn 11: poison(2), 2 turns remaining
- Turn 12 (after Mold Puff used Toxic Cloud): poison(4), 2 turns remaining  
- Turn 13 (after another Toxic Cloud): poison(6), 2 turns remaining

Stacking behavior: `value` increments by 2 each time the debuff is applied. Turn-remaining stays at 2 after refresh. **Potential issue:** After multiple applications, the player took 18 (Spore burst) + 6 (poison tick) damage in one turn (turn 13→14). Total poison damage over the fight was significant for a floor-3 weak enemy.

### AP Economy Patterns
- Turn AP allocation: 3 base AP with 5 max. Charge costs 2 AP. This creates a regular pattern of 1 charge + 1 quick per turn (3 AP), occasionally 2 charges in a high-AP turn (4-5 AP).
- AP management became a recurring constraint — often ended turns with 1 AP unspent because available cards were charge-only and not enough AP remained.
- Observation: With 3 AP base (most turns), players can charge once and quick-play once. This feels slightly restrictive — the optimal play pattern is very predictable.

### Combat Pacing (Combat 3 deep dive)
- Combat 3 lasted 14 turns against a 52 HP enemy.
- Player took significant chip damage from poison + enemy attacks totaling 70 HP damage (100→30).
- 14 turns is noticeably long for a floor-3 enemy with 52 HP. Mold Puff's intent pattern alternated between Toxic Cloud (debuff) and Spore burst (18 damage). The debuff pattern meant low incoming damage most turns, allowing the player to use AP offensively. However the final "Spore burst" for 18 + poison(6) tick did 24 in one turn, which felt punishing for a relatively weak enemy.

---

## NARRATION CAPTURES

**Floor 1 narration:** `getNarrativeText()` returned `null` (no narration displayed at start of floor 1)  
**Other floors:** Narration not captured due to direct map node navigation after reward rooms

---

## API ISSUES / TOOLING NOTES

### enterNode not available
`window.__rrPlay.enterNode()` does not exist. Map navigation must use DOM click: `document.querySelector('[data-testid="map-node-r{row}-n{col}"]').click()`

### mysteryContinue / selectMysteryChoice confusion
- `selectMysteryChoice(index)` targets `.choice-btn` elements — used for quiz answer selection  
- The "Begin Quiz" trigger in mystery events uses a different button (`data-testid="mystery-continue"`, class `continue-btn`)  
- Both `mysteryContinue()` and DOM-click on the continue button worked at different points in the flow

### chargePlayCard with insufficient AP
`chargePlayCard(index, true)` returns `{ok: false, message: "Not enough AP to charge-play card N (needs 2, have 1)"}` — the card is NOT played. Must check `apRemaining` before attempting charge.

### Phaser Continue button not clickable via DOM
The "Continue" button in RewardRoom is a Phaser GameObjects.Text/Container, not a DOM element. PointerEvent canvas simulation did not trigger it. Only `navigate('dungeonMap')` reliably exits the reward room when the Phaser click isn't captured.

---

## TIMELINE

| Step | Action | Screen | Notes |
|------|--------|--------|-------|
| 1 | startRun (mixed) | startScreen | |
| 2 | selectDomain | dungeonMap | Floor 1 |
| 3 | Click r0-n0 | combat | Combat 1 start |
| 4–8 | Turns 1–9 | combat | vs Stonebound Sentinel 80 HP |
| 9 | acceptReward() | dungeonMap ✅ | No crash — FIX CONFIRMED #1 |
| 10 | Click r1-n0 | dungeonMap | **CRASH #1** — drawImage null |
| 11 | navigate('combat') | combat | Workaround applied |
| 12 | getCombatState | combat | Combat 2 data loaded fine |
| 13–18 | Turns 1–9 | combat | vs Crystalline Defiler 78 HP |
| 19 | acceptReward() | dungeonMap ✅ | No crash — FIX CONFIRMED #2 |
| 20 | Click r4-n0 | dungeonMap | **CRASH #2** — drawImage null |
| 21 | navigate('combat') | combat | Workaround applied |
| 22 | getCombatState | combat | Combat 3 data loaded fine |
| 23–36 | Turns 10–14 | combat | vs Mold Puff 52 HP |
| 37 | acceptReward() | rewardRoom ✅ | No crash — FIX CONFIRMED #3 |
| 38 | navigate('dungeonMap') | dungeonMap | Manual exit required |
| 39 | Session end | dungeonMap | Floor 4 reached |

---

## VERDICT

**Primary objective achieved.** `acceptReward()` camera crash is fixed — 3/3 tests passed with `ok: true` and no `drawImage` crash.

**Blocking issues remain:** The intermittent Phaser `drawImage` crash on combat entry (BUG-1) is a separate bug that occurs during the map→combat transition, not during `acceptReward()`. It appeared in 2 of 3 combat transitions. This needs investigation before the game is considered stable for a regular playthrough.

**Fun factor (observer notes):** The FSRS mastery curve is satisfying — watching a card go from baseEffectValue=4 to 8 over the course of a run makes progression feel real. The Mold Puff fight at floor 3 lasted too long (14 turns) and the stacking poison became oppressive. The mystery event distractor quality is a content issue that reduces quiz challenge.
