# Full Run Bug Report — BATCH-2026-04-02-001
**Tester**: Full Run Bug Hunter | **Model**: claude-sonnet-4-6 | **Date**: 2026-04-02

## Run Summary
- **Floors attempted**: 1 (blocked from reaching floor 2 by CRITICAL stuck state)
- **Floors completed**: 0 (floor 1 in progress when stuck)
- **Total rooms visited**: combat (3), rewardRoom (3 — first 2 OK, 3rd stuck)
- **Room types visited**: combat (3), rewardRoom (3), shop (0), rest (0), mystery (0), elite (0), boss (0), cardReward (0)
- **Total combat encounters**: 3 (Pop Quiz, Index Weaver, Ink Slug)
- **Run outcome**: stuck — rewardRoom Phaser scene crash after 3rd combat
- **Total bugs found**: 5 distinct bugs (critical: 1, high: 1, medium: 2, low: 1)

## Verdict: FAIL

FAIL — 1 CRITICAL bug permanently blocks progression. After the 3rd combat encounter, the rewardRoom Phaser scene crashes with `TypeError: Cannot read properties of undefined (reading 'trigger')`. The screen remains at `rewardRoom` but the Phaser canvas renders as a black screen. `acceptReward()` returns `ok:true` each time but the screen never transitions — it loops infinitely.

---

## Run Flow Discovery Notes

The actual game flow differs from the test prompt spec. Documenting for future testers:

| Step | Expected (spec) | Actual |
|------|----------------|--------|
| 1 | `startRun()` → `domainSelect` | `startRun()` → `deckSelectionHub` |
| 2 | `selectDomain('general_knowledge')` | Click `button.panel--trivia` → `triviaDungeon` |
| 3 | `selectArchetype('balanced')` | Click `button.footer-start-btn` → `onboarding` |
| 4 | → `dungeonMap` | JS click `button.enter-btn` (canvas blocks normal click) → `dungeonMap` |
| 5 | `selectMapNode('map-node-r0-n0')` fails | `selectMapNode('r0-n0')` works (API prepends `map-node-`) |

**API methods `selectDomain()` and `selectArchetype()` are NOT wired to the current UI.** Both return `{"ok":false}`. The current flow uses the `deckSelectionHub` / `triviaDungeon` screens instead.

**Canvas blocks click-to-skip on onboarding:** The parallax canvas element sits on top of the "Click to skip" label, intercepting all pointer events. Must use `document.querySelector('button.enter-btn')?.click()` via JS.

---

## Room Type Coverage
| Room Type | Visited? | Count | Working? | Notes |
|-----------|----------|-------|----------|-------|
| combat | YES | 3 | YES | endTurn ok:false after enemy death is test harness issue, not game bug |
| elite | NO | 0 | ? | Not visited |
| boss | NO | 0 | ? | Not reached — stuck before end of floor |
| shop | NO | 0 | ? | Not reached due to stuck state |
| rest | NO | 0 | ? | Not reached due to stuck state |
| mystery | NO | 0 | ? | Not reached due to stuck state |
| treasure | NO | 0 | ? | — |
| rewardRoom | YES | 3 | PARTIAL | 1st: ok:false then ok:true (race condition), 2nd: ok:true fine, 3rd: STUCK — Phaser crash |
| cardReward | NO | 0 | ? | Never reached — rewardRoom always transitioned direct to dungeonMap (or stuck) |

---

## Screen Transition Log
| # | From Screen | To Screen | Expected | Match? | Anomalies |
|---|-------------|-----------|----------|--------|-----------|
| 1 | hub | deckSelectionHub | deckSelectionHub | YES | |
| 2 | deckSelectionHub | triviaDungeon | triviaDungeon | YES | |
| 3 | triviaDungeon | onboarding | dungeonMap | NO | Intermediate onboarding screen present |
| 4 | onboarding | dungeonMap | dungeonMap | YES | |
| 5 | dungeonMap | combat | combat | YES | r0-n0 = Pop Quiz |
| 6 | combat | rewardRoom | rewardRoom | YES | |
| 7 | rewardRoom | rewardRoom | cardReward | NO | First acceptReward: "RewardRoomScene not active" (timing race) |
| 8 | rewardRoom | dungeonMap | cardReward/dungeonMap | PARTIAL | 2nd call ok:true, bypassed cardReward entirely |
| 9 | dungeonMap | combat | combat | YES | r1-n0 = Index Weaver |
| 10 | combat | rewardRoom | rewardRoom | YES | Phaser error in recentEvents: "Cannot read blendModes" |
| 11 | rewardRoom | dungeonMap | cardReward/dungeonMap | YES | acceptReward ok:true, went to dungeonMap |
| 12 | dungeonMap | combat | combat | YES | r2-n0 = Ink Slug |
| 13 | combat | rewardRoom | rewardRoom | YES | |
| 14 | rewardRoom | **STUCK** | cardReward/dungeonMap | NO | **CRITICAL** infinite loop, Phaser crash |

---

## Bugs Found

### CRITICAL

### BUG-001 [CRITICAL] — rewardRoom Phaser scene crashes after 3rd combat, permanent stuck state
- **Screen**: rewardRoom
- **Action**: acceptReward() after 3rd combat encounter on floor 1
- **Expected**: Transition to cardReward or dungeonMap, rewards collected
- **Actual**: `acceptReward()` returns `{"ok":true,"message":"Reward accepted via Phaser scene. Screen: rewardRoom"}` every call, but the screen never transitions. Phaser canvas renders completely black. Run is permanently blocked.
- **Evidence**: `getRecentEvents()` shows persistent `[error] Unhandled rejection: Cannot read properties of undefined (reading 'trigger')` after each acceptReward call. Prior encounter also showed `[error] Uncaught TypeError: Cannot read properties of null (reading 'blendModes')`. Screenshot `rr-reward_f1.png` confirms black Phaser canvas with only HUD bar visible (100/100 HP, Floor 2, 52 gold — note HUD incorrectly shows "Floor 2" when player never delved, suggesting RunState corruption).
- **Run State**: `{"currency":52,"playerHp":100,"playerMaxHp":100}`, floor 1 run
- **Trigger**: Appears after 3+ combat encounters. 1st rewardRoom had race condition, 2nd worked, 3rd permanently broken.
- **Reproducible**: Consistent — reproduced on every test run of the full script
- **Root cause hypothesis**: Phaser RewardRoomScene has a lifecycle/cleanup bug. Scene likely leaves dirty state (uncleaned event listeners or undefined object references) from prior instantiation. The `trigger` property error suggests a Phaser EventEmitter or Phaser Scene system event handler is firing on an already-destroyed object. The `blendModes` error on encounter #2 may be the first sign of this degradation.

---

### HIGH

### BUG-002 [HIGH] — rewardRoom first acceptReward() call returns ok:false "RewardRoomScene not active" (race condition)
- **Screen**: rewardRoom
- **Action**: acceptReward() called immediately after getScreen() returns 'rewardRoom'
- **Expected**: ok:true, reward collected
- **Actual**: `{"ok":false,"message":"RewardRoomScene not active"}`
- **Evidence**: Observed on 1st rewardRoom entry only. Retrying after ~3 seconds returned ok:true and succeeded. The Svelte state store shows 'rewardRoom' before the Phaser scene has fully started.
- **Run State**: `{"currency":10,"playerHp":100,"playerMaxHp":100}`
- **Reproducible**: First rewardRoom entry only — subsequent retries succeed. Classic Svelte/Phaser sync race condition.

---

### MEDIUM

### BUG-003 [MEDIUM] — rewardRoom bypasses cardReward screen entirely (skip card selection)
- **Screen**: rewardRoom → dungeonMap (no cardReward intermediate)
- **Action**: acceptReward() in rewardRoom
- **Expected**: Transition to cardReward screen for card selection (per GDD post-combat sequence)
- **Actual**: `acceptReward()` transitions directly to dungeonMap, skipping cardReward entirely. The cardReward screen was never visited during this run.
- **Evidence**: Transition log entries 8 and 11 both show `rewardRoom -> dungeonMap`. No cardReward visits in room type coverage.
- **Reproducible**: Consistent across both working rewardRoom visits
- **Note**: May be by design if `acceptReward()` is supposed to auto-accept a card. Needs design intent clarification — the test prompt spec implies cardReward is a separate screen.

### BUG-004 [MEDIUM] — getCombatState() returns undefined fields after enemy death, triggering false endTurn errors
- **Screen**: combat (post-enemy-death transition window)
- **Action**: getCombatState() called when getScreen() still returns 'combat' but enemy just died
- **Expected**: Either valid state or clear indication combat is over
- **Actual**: `{ap: undefined, hand: undefined, enemyHp: undefined}` returned during the brief window after enemy death but before screen transitions. endTurn() then returns ok:false.
- **Evidence**: Every combat encounter shows 12-15 turns of undefined fields after enemy dies. getScreen() is slow to reflect the transition.
- **Note**: Primarily affects test harnesses. In production the player has no mechanism to end turn after combat anyway. However, the getScreen()/getCombatState() inconsistency window could cause issues if any game code polls these simultaneously.

---

### LOW

### BUG-005 [LOW] — Phaser blendModes error on 2nd rewardRoom entry (possible precursor to BUG-001)
- **Screen**: rewardRoom (2nd encounter)
- **Action**: Entering rewardRoom after 2nd combat
- **Expected**: Clean scene initialization, no errors
- **Actual**: `Uncaught TypeError: Cannot read properties of null (reading 'blendModes')` appears in recentEvents during 2nd rewardRoom transition.
- **Evidence**: Observed in `getRecentEvents()` call during rewardRoom handling. Does not immediately block — acceptReward() succeeds. However this error preceding the BUG-001 crash on the very next rewardRoom suggests it is part of the same degradation path.
- **Reproducible**: First observed on 2nd rewardRoom. Likely correlates with BUG-001.

---

## Per-Encounter Combat Log
| # | Floor | Enemy | Turns | HP Before | HP After | Gold Gained | Cards Played | Bugs |
|---|-------|-------|-------|-----------|----------|-------------|--------------|------|
| 1 | 1 | Pop Quiz | 3 | 100 | 100 | +10 | ~6 | none |
| 2 | 1 | Index Weaver | 3 | 100 | 100 | +10 | ~6 | blendModes error in rewardRoom |
| 3 | 1 | Ink Slug | 3 | 100 | 100 | +12 | ~6 | rewardRoom STUCK (BUG-001) |

**Combat observations:**
- All 3 floor-1 enemies die in ~3 turns of charge plays. Enemy HP: Pop Quiz 28, Index Weaver 30, Ink Slug 42.
- Floor 1 balance appears intact — player takes no damage in these 3 encounters.
- `chargePlayCard(0, true)` works correctly, resolves quiz answer as correct, deals damage.
- `quickPlayCard(0)` also functional.
- Hand draws correctly — base 5 cards, some turns show 6-7 (card effects firing).
- `getCombatState()` returns accurate data during active combat turns.

---

## Layout Dump Anomaly Summary
- **dungeonMap**: `(no Phaser game running)` appears in layout dump despite map rendering correctly in Phaser screenshot. The layout dump Phaser detection does not recognize the dungeon map canvas as an active Phaser scene.
- **rewardRoom (stuck)**: Phaser canvas renders black — zero Phaser objects in layout dump. HUD shows "Floor 2" (corrupted state — player never delved). Screenshot `rr-reward_f1.png` confirms.

---

## Console Errors (Unique, Ordered by Severity)
- `Unhandled rejection: Cannot read properties of undefined (reading 'trigger')` — **CRITICAL** — Persistent in rewardRoom #3. Causes stuck state. Phaser EventEmitter/Scene event fire on destroyed object.
- `Uncaught TypeError: Cannot read properties of null (reading 'blendModes')` — **HIGH** — Observed in rewardRoom #2. Phaser rendering/texture initialization error.
- `Connecting to 'http://100.74.153.81:5175/api/game/cardback-updates' violates CSP directive` — LOW — Expected, external URL not in CSP allowlist. Non-blocking.
- `Failed to load resource: net::ERR_CONNECTION_REFUSED` — LOW — Follows CSP error above. Non-blocking.

---

## Screenshots Captured
- `/tmp/rr-dungeonMap_initial.png`: Initial dungeonMap — 3 available combat nodes (red X sword icons) at row 0 bottom
- `/tmp/rr-reward_f1.png`: **The stuck rewardRoom** — entirely black Phaser canvas, HUD showing Floor 2 / 52g / 100 HP, unresponsive
- `/tmp/rr-final.png`: Final test state (same stuck rewardRoom)
- `/tmp/rr-phaser-screenshot.png`: DungeonMap (from exploration phase) — combat nodes visible correctly

---

## What Worked Well
- `startRun()`: ok:true, navigates to deckSelectionHub correctly
- `deckSelectionHub`: Both Trivia Dungeon and Study Temple panels render with correct content/icons
- `triviaDungeon`: 5/11 domain cards pre-selected. Locked domains clearly shown. Sub-deck chips with fact counts visible. Start Run button correctly enabled.
- Onboarding screen: Parallax backdrop renders correctly. "ENTER THE DEPTHS" + "Click to skip" visible.
- `dungeonMap`: Floor 1 renders with 22 total nodes. 3 available at row 0. Node hierarchy works correctly (row unlocked only after row 0 complete).
- `selectMapNode('r0-n0')`: Works correctly with short ID format. Navigates to combat.
- Combat (3 encounters): `chargePlayCard`, `quickPlayCard`, `getCombatState`, enemy HP tracking, gold gain all functional.
- `getRunState()`: Returns accurate currency/HP/maxHp throughout.
- `rewardRoom` (encounters 1-2): Works after appropriate delay (1st: retry needed), gold increases confirmed.
- `getRecentEvents()`: Accurately surfaces Phaser errors — critical for diagnosing BUG-001.

---

## Root Cause Hypothesis for BUG-001

The Phaser rewardRoom crash after 3+ encounters appears to be a Phaser Scene lifecycle leak:

1. `RewardRoomScene` is created and destroyed after each combat
2. After 2+ scene cycles, the scene leaves dirty state — likely an event listener on a Phaser object that is then destroyed, or a reference to a destroyed Phaser.Scene that gets called on the next instantiation
3. The `blendModes` error (encounter #2) is the first symptom — a `null` Phaser object being referenced during rendering setup
4. By encounter #3 the scene fails to fully initialize — the `trigger` error fires when trying to emit an event on an undefined/destroyed system
5. The screen store updates to `rewardRoom` (Svelte side) but the Phaser scene never becomes active, explaining why `acceptReward()` says ok:true (it fires the Phaser scene's accept method) but nothing renders

**Suggested investigation**: `RewardRoomScene.ts` — check `shutdown()` and `destroy()` for uncleaned references. Look for `this.events.on(...)` calls that aren't paired with `this.events.off(...)` on shutdown. Check if any static class-level variables accumulate state.

---

## Recommendations

| Priority | Issue | Action |
|----------|-------|--------|
| P0 | BUG-001: rewardRoom crash after 3rd combat | Audit `RewardRoomScene.ts` shutdown/destroy for event listener leaks and undefined object refs |
| P1 | BUG-002: Race condition on first acceptReward() | Add ready-check in debug bridge: poll Phaser scene isActive before returning from transition |
| P2 | BUG-003: cardReward screen skipped | Clarify intent — if acceptReward() auto-collects card, document it. If cardReward should appear, fix the flow. |
| P3 | BUG-004: getCombatState() undefined after death | Make getScreen() transition away from 'combat' synchronously when enemy HP hits 0 |
| P4 | API docs: selectDomain/selectArchetype stale | Update `__rrPlay` docs: mark these methods as deprecated/non-functional for Trivia Dungeon mode |
| P5 | Onboarding canvas pointer-events | Make "Click to skip" span have `pointer-events: none` override or position above canvas z-index |
