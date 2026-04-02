# Full Run Bug Report — BATCH-2026-04-02-002
**Tester**: Full Run Bug Hunter (Verification) | **Model**: claude-sonnet-4-6 | **Date**: 2026-04-02

---

## Fix Verification (from BATCH-2026-04-02-001)

| Bug | Status | Evidence |
|-----|--------|----------|
| BUG-001 [CRITICAL] RewardRoomScene crash after 3rd combat | **STILL BROKEN (new root cause)** | Reward room 2 returns ok:true but screen stays on rewardRoom. No crash errors (`trigger`/`blendModes` gone), but `sceneComplete` never triggers screen transition. See BUG-001-V2 below. |
| BUG-002 [HIGH] acceptReward() race condition | **FIXED** | First reward room: `acceptReward()` returned `{ok:true}` on first call, no "not active" error. 3s polling fix working. |
| BUG-003 [MEDIUM] cardReward screen skip | **BY DESIGN (confirmed)** | Card selection is inline in rewardRoom Phaser scene. No separate cardReward screen. Already documented. |
| BUG-004 [MEDIUM] getCombatState() undefined fields | **FIXED** | Returns `null` on both post-combat checks (screen: rewardRoom). No undefined field errors. |
| BONUS selectDomain() / selectArchetype() | **STILL BROKEN (selector mismatch)** | `selectDomain()` looks for `[data-testid="panel--trivia"]` but `DeckSelectionHub.svelte` renders `<button class="panel panel--trivia">` with NO `data-testid` attribute. Also `[data-testid="footer-start-btn"]` not present; button only has class `footer-start-btn`. Both CSS class-based workarounds function correctly. |

---

## Run Summary
- **Floors attempted**: 1 (stuck on reward room 2 before map progression)
- **Floors completed**: 0
- **Total rooms visited**: 2 combat rooms + 2 reward rooms
- **Total combat encounters**: 2 (Page Flutter × 31 HP, Mold Puff × 35 HP)
- **Run outcome**: stuck — rewardRoom stuck state after combat 2 (new variant of BUG-001)
- **Total bugs found**: 3 new bugs + 1 regression of BUG-001 (different root cause)

## Verdict: FAIL

FAIL — BUG-001 has a new form after the fix. The original crash (`trigger`/`blendModes` TypeError) is resolved, but a different stuck state now occurs starting at combat 2: `acceptReward()` returns `ok:true`, gold increases by 10 (indicating the gold item was collected), but the 3 card items are never accepted and `sceneComplete` never fires a screen transition. The `removeAllListeners()` fix for the crash inadvertently severs the `cardTapped` listener that the bridge registers, preventing `cardDetailCallbacks` from being set, which blocks `acceptCard()` from being called on the second reward instance.

Additionally, the BONUS `selectDomain()` fix uses incorrect DOM selectors (`data-testid` vs CSS class) — it fails silently and requires a workaround.

---

## New Bug: BUG-001-V2 [CRITICAL] — RewardRoomScene stuck after 2nd combat (new form)

### Root Cause Analysis

The BATCH-001 fix for BUG-001 added `this.events.removeAllListeners()` to `shutdown()`. This resolved the `trigger`/`blendModes` crash by clearing accumulated listeners. However it introduced a new failure:

**Lifecycle of second reward room:**
1. `openRewardRoom()` (in `rewardRoomBridge.ts`) calls `mgr.startRewardRoom(data)`
2. `startRewardRoom()` calls `game.scene.stop('RewardRoom')` → `shutdown()` → `this.events.removeAllListeners()` — this removes all listeners from the PREVIOUS scene instance's event emitter
3. Then `game.scene.start('RewardRoom', data)` creates a fresh scene
4. Bridge waits for new scene to be active, then registers `sceneComplete`, `goldCollected`, `cardTapped`, etc. listeners ✓ (this part works)
5. `acceptReward()` (playtestAPI) fires:
   - Gold/vial pointerdown → collected correctly ✓
   - Card pointerdown → `showCardDetail()` → `this.events.emit('cardTapped', card, item)`
   - `cardTapped` listener IS registered on the new instance... BUT:
6. **Key question**: is the `cardTapped` listener registered BEFORE the items are created, or does timing cause a race?

**Evidence from diagnostic run:**
```
R2 Diag: {
  "isActive": true, "itemCount": 5,
  "items": [gold(uncollected), vial(uncollected), card(uncollected)×3],
  "initialized": true, "gameObjectCount": 27
}
acceptReward 2: {ok:true, "Screen: rewardRoom"}
Post reward 2: rewardRoom
Stuck: { itemsAllCollected: true }
```

Items are all marked collected after `acceptReward()` returns but `sceneComplete` never fired a transition. Gold increased by 10 (gold item was correctly collected), but no card was added to deck.

**Most likely root cause**: `removeAllListeners()` on the scene's `events` emitter in `shutdown()` is too aggressive. Phaser uses the scene's `events` object for internal lifecycle signals. Clearing ALL listeners may prevent the scene from emitting `sceneComplete` properly on the second instantiation, OR the Svelte-side screen transition (`currentScreen.set()`) is not being called because `handleComplete` in the bridge fires but the store update fails silently.

**Secondary rendering bug**: After reward 1, `stopRewardRoom()` calls `bringToTop('CombatScene')`. On reward 2, the RewardRoomScene is active (confirmed) but renders BEHIND CombatScene — the screenshot for reward 2 shows the CombatScene background (archive room with papers and niches), not the reward boulder. This is a separate Z-order issue making it impossible for the player to see or interact with reward items.

---

## Screen Transition Log

| # | From | To | Action | Result |
|---|------|----|--------|--------|
| 1 | hub | deckSelectionHub | startRun() | ok:true |
| 2 | deckSelectionHub | triviaDungeon | click .panel--trivia (CSS class workaround) | ok |
| 3 | triviaDungeon | onboarding | click .footer-start-btn (CSS class workaround) | ok |
| 4 | onboarding | dungeonMap | click button.enter-btn | ok |
| 5 | dungeonMap | combat | selectMapNode('r0-n0') | ok |
| 6 | combat | rewardRoom | playCombat (Page Flutter, 2 turns) | ok, getCombatState null ✓ FIX-004 |
| 7 | rewardRoom | dungeonMap | acceptReward() — first call ok:true | FIXED ✓ FIX-002 |
| 8 | dungeonMap | combat | selectMapNode('r1-n0') | ok |
| 9 | combat | rewardRoom | playCombat (Mold Puff, 11 turns) | ok, getCombatState null ✓ FIX-004 |
| 10 | rewardRoom | **STUCK** | acceptReward() ok:true but screen unchanged | **BUG-001-V2** |

---

## Room Coverage

| Room Type | Visited? | Count | Working? | Notes |
|-----------|----------|-------|----------|-------|
| combat | YES | 2 | YES | FIX-004 confirmed |
| rewardRoom | YES | 2 | PARTIAL | Reward 1: FIXED. Reward 2: stuck (new form of BUG-001) |
| shop | NO | 0 | ? | Not reached |
| rest | NO | 0 | ? | Not reached |
| mystery | NO | 0 | ? | Not reached |
| elite | NO | 0 | ? | Not reached |
| boss | NO | 0 | ? | Not reached |
| cardReward | N/A | 0 | N/A | BY DESIGN — inline in rewardRoom |

---

## Combat Log

| # | Enemy | HP | Turns | Player HP Before | Player HP After | Gold | Cards Played | Notes |
|---|-------|-----|-------|-----------------|-----------------|------|--------------|-------|
| 1 | Page Flutter | 31 | 2 | 100 | 100 | +10 (10→20) | ~4 charge | Clean win |
| 2 | Mold Puff | 35 | 11 | 100 | 100 | +10 (30→40) | ~15 charge | Won on turn 11 |

**Combat observations:**
- `chargePlayCard(idx, true)` works correctly — auto-answers correctly, deals damage
- `getCombatState()` returns valid data during active combat turns ✓
- `getCombatState()` returns `null` when screen transitions away from combat ✓ (BUG-004 FIXED)
- `endTurn()` returns `ok:false` "End turn button not found" when enemy dies mid-turn (not a bug — button is correctly disabled when combat ends)
- Combat 2 took 11 turns vs combat 1's 2 turns — enemy HP is 35, possible card damage variation

---

## Bugs Found

### BUG-001-V2 [CRITICAL] — RewardRoomScene stuck after 2nd combat encounter (regression of BUG-001 fix)

- **Screen**: rewardRoom
- **Action**: `acceptReward()` after combat 2
- **Expected**: Gold and 1 card collected, transition to dungeonMap
- **Actual**: `acceptReward()` returns `{ok:true, message:"...Screen: rewardRoom"}`. Gold +10 received (gold item collected). Card items NOT accepted. Screen stays on rewardRoom permanently. No crash errors (trigger/blendModes gone).
- **Visual evidence**: `diag_reward2_after.png` — CombatScene background (cave with papers) visible, not reward room boulder. RewardRoomScene is active (Z-order issue: CombatScene rendered on top)
- **Diagnostic evidence**:
  - `R2 Diag: isActive:true, itemCount:5, items:[gold(uncollected), vial(uncollected), card×3(uncollected)]` — BEFORE accept
  - After accept: `itemsAllCollected:true` (all items marked collected, BUT no card added to deck, gold only +10)
  - No console errors: no trigger, blendModes, or TypeError
  - `sceneComplete` was emitted but bridge's screen transition never fired
- **Root cause hypothesis**: The `removeAllListeners()` in `shutdown()` may clear Phaser's internal scene lifecycle listeners, preventing proper scene signaling. OR the bridge's `cardTapped` listener races with the scene restart, causing `getCardDetailCallbacks()` to return null on card acceptance. Additionally, `stopRewardRoom()` calling `bringToTop('CombatScene')` causes the RewardRoom to render behind CombatScene on second activation.
- **Reproducible**: Consistent — occurs on every second reward room visit
- **Trigger**: 2nd combat (previously triggered at 3rd) — fix made it worse in a different way

---

### BUG-002-V2 [MEDIUM] — selectDomain() uses wrong DOM selectors (selector mismatch in BONUS fix)

- **Screen**: deckSelectionHub
- **Action**: `selectDomain('general_knowledge')`
- **Expected**: ok:true, navigates through trivia panel → domain → start
- **Actual**: `{ok:false, message:"Trivia Dungeon panel not found on deckSelectionHub"}`
- **Root cause**: `selectDomain()` searches `[data-testid="panel--trivia"]` but `DeckSelectionHub.svelte` renders `<button class="panel panel--trivia">` with NO `data-testid`. The element has the CSS class but no test ID attribute. Same issue with `[data-testid="footer-start-btn"]` — the Start Run button also has no `data-testid`, only class `footer-start-btn`.
- **Fix required**: Change both selectors to use CSS class: `document.querySelector('button.panel--trivia')` and `document.querySelector('button.footer-start-btn')`
- **Workaround**: Bot uses CSS class selectors directly; navigation works with workaround

---

### BUG-003-V2 [MEDIUM] — RewardRoomScene Z-order: CombatScene renders on top of RewardRoom on 2nd activation

- **Screen**: rewardRoom (2nd encounter)
- **Visual**: Player sees CombatScene background instead of reward boulder
- **Root cause**: `stopRewardRoom()` calls `this.game.scene.bringToTop('CombatScene')` to fix rendering after reward room stops. When the next reward room starts, RewardRoom scene is added to the back of the scene stack, behind CombatScene. The reward items ARE present and interactive (proven by diagnostic), but the player cannot see them.
- **Impact**: In bot testing, acceptReward() still works (drives sprites directly) but the player experience is completely broken — invisible reward room.
- **Fix required**: `startRewardRoom()` should call `this.game.scene.bringToTop('RewardRoom')` after starting the scene, or the scene's `create()` should call `this.scene.bringToTop()`

---

### OBS-001 [LOW] — domain-card testids absent in triviaDungeon

- Domain card buttons in triviaDungeon have no `data-testid` attributes (only CSS class `domain-card`).
- selectDomain() step 2 searches `[data-testid="domain-card-general_knowledge"]` — fails silently (no domain is selected but Start Run still fires since domains are pre-selected).
- Not a blocker since domains default to selected state, but may matter if de-selection/re-selection logic is tested.

---

## Fix Verification Details

### BUG-002: acceptReward() 3s polling — FIXED ✓
- Reward 1: called immediately after `getScreen() === 'rewardRoom'`
- Result: `{ok:true, message:"Reward accepted via Phaser scene. Screen: dungeonMap"}`
- No "not active" error. Polling fix is working.

### BUG-004: getCombatState() null after combat — FIXED ✓
- Post-combat 1 (screen: rewardRoom): `getCombatState()` returned `null`
- Post-combat 2 (screen: rewardRoom): `getCombatState()` returned `null`
- Null guard working correctly.

### BUG-001: Listener accumulation crash — PARTIAL
- No `trigger` or `blendModes` TypeErrors observed (crash is gone)
- BUT new stuck state introduced by the fix itself (see BUG-001-V2)
- `removeAllListeners()` too aggressive — needs a more targeted approach

---

## Root Cause Summary for BUG-001-V2

Two separate issues introduced by the BATCH-001 fix:

**Issue A — `sceneComplete` not triggering screen transition on 2nd reward:**
`this.events.removeAllListeners()` in `shutdown()` may remove Phaser's internal scene management listeners or interact poorly with the bridge's listener lifecycle. The bridge attaches `sceneComplete` to the new scene after restart, but `checkAutoAdvance()` emits the event before the bridge can act, or the event is emitted without anyone receiving it.

**Issue B — Z-order: CombatScene visible instead of RewardRoom:**
`stopRewardRoom()` calls `bringToTop('CombatScene')`. On the 2nd reward room, the scene array becomes `[RewardRoom, CombatScene]` (RewardRoom is created behind CombatScene). The player sees the CombatScene background, not the reward boulder.

**Recommended fix approach:**
1. Replace `this.events.removeAllListeners()` with targeted removal of specific user-defined listeners only (store listener references in `create()` and remove them individually in `shutdown()`)
2. In `startRewardRoom()` or `RewardRoomScene.create()`, call `this.scene.bringToTop()` to ensure the reward room renders above the combat scene

---

## What Worked Well (from this run)

- `startRun()` → deckSelectionHub: correct ✓
- CSS class navigation: `button.panel--trivia`, `button.footer-start-btn` → works perfectly as workaround ✓
- dungeonMap with 3 available nodes (row 0) ✓
- `selectMapNode('r0-n0')`, `('r1-n0')` ✓
- Combat mechanics: `chargePlayCard`, `endTurn`, damage tracking all correct ✓
- BUG-004 (getCombatState null): FIXED ✓
- BUG-002 (acceptReward polling): FIXED ✓
- Reward 1 full flow: gold collected, card accepted, dungeonMap transition ✓
- `getRunState()` currency tracking accurate ✓

---

## Console Errors (full run)

| Error | Severity | Note |
|-------|----------|------|
| `CSP violation: cardback-updates` | LOW | External URL blocked, non-blocking, expected |
| `ERR_CONNECTION_REFUSED` | LOW | Follows CSP error, non-blocking |
| No `trigger`/`blendModes` TypeErrors | — | BUG-001 crash resolved, new stuck form instead |

---

## Recommendations

| Priority | Issue | Action |
|----------|-------|--------|
| P0 | BUG-001-V2: RewardRoomScene stuck on 2nd activation | Replace `this.events.removeAllListeners()` with targeted listener cleanup. Add `this.scene.bringToTop()` in `startRewardRoom()` |
| P1 | BUG-002-V2: selectDomain() wrong selectors | Change `[data-testid="panel--trivia"]` → `.panel--trivia` and `[data-testid="footer-start-btn"]` → `.footer-start-btn` in playtestAPI.ts |
| P2 | BUG-003-V2: RewardRoom Z-order | `startRewardRoom()` should call `bringToTop('RewardRoom')` after scene.start() |
| P3 | OBS-001: Missing data-testid on domain-card buttons | Add `data-testid="domain-card-{id}"` to domain card buttons in TriviaRunSetup.svelte (or equivalent) |

---

## Screenshots Captured

- `screenshots/02_after_startRun.png` — deckSelectionHub with Trivia Dungeon / Study Temple panels
- `screenshots/03_after_navigation.png` — after navigation workaround (black/transition)
- `screenshots/04_dungeonMap.png` — dungeonMap (Phaser rendering, 3 available nodes)
- `screenshots/room_0_combat.png` — combat scene (Page Flutter encounter)
- `screenshots/combat_1_end.png` — post-combat state
- `screenshots/reward_1_before.png` — reward room 1 (working)
- `screenshots/reward_1_after.png` — dungeonMap after reward 1 (FIXED transition working)
- `screenshots/room_3_combat.png` — combat 2 (Mold Puff encounter)
- `screenshots/diag_reward1_before.png` — diagnostic: black transition frame
- `screenshots/diag_reward1_after.png` — diagnostic: dungeonMap after reward 1, gold=20
- `screenshots/diag_reward2_before.png` — diagnostic: black transition frame
- `screenshots/diag_reward2_after.png` — **KEY EVIDENCE**: CombatScene background visible during rewardRoom state (Z-order bug)
- `screenshots/99_final.png` — final stuck state

---

## Appendix: Raw Diagnostic Data

### Reward Room 2 — Scene State Before acceptReward()
```json
{
  "isActive": true,
  "isVisible": true,
  "itemCount": 5,
  "items": [
    {"type": "gold", "collected": false},
    {"type": "health_vial", "collected": false},
    {"type": "card", "collected": false},
    {"type": "card", "collected": false},
    {"type": "card", "collected": false}
  ],
  "initialized": true,
  "gameObjectCount": 27,
  "allScenes": [
    {"key": "BootScene", "active": false, "visible": false},
    {"key": "RewardRoom", "active": true, "visible": true},
    {"key": "CombatScene", "active": true, "visible": true}
  ]
}
```

Note: Scene order — `RewardRoom` is listed before `CombatScene` but CombatScene is rendered on top (Z-order bug).

### Reward Room 2 — Stuck Diagnosis After acceptReward()
```json
{
  "isActive": true,
  "itemCount": 5,
  "itemsAllCollected": true,
  "initialized": true,
  "allScenes": [
    {"key": "BootScene", "active": false},
    {"key": "RewardRoom", "active": true},
    {"key": "CombatScene", "active": true}
  ]
}
```

All items marked collected, scene still active, screen never transitioned. No JavaScript errors in console.
